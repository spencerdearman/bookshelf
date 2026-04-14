import { NextRequest } from "next/server";
import { fetchStates, expandCallsign, StateVector } from "@/lib/opensky";
import { lookupFlight } from "@/lib/flightaware";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const flight = searchParams.get("flight");

  if (!flight) {
    return Response.json(
      { error: "flight parameter is required (e.g. UA881)" },
      { status: 400 }
    );
  }

  const callsigns = expandCallsign(flight);

  try {
    // --- Strategy 1: FlightAware (works for all flights including oceanic) ---
    for (const cs of callsigns) {
      const fa = await lookupFlight(cs);
      if (!fa) continue;

      // Get the top-level flight entry for live data
      const html = await fetch(
        `https://www.flightaware.com/live/flight/${encodeURIComponent(cs)}`,
        { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36" } }
      ).then((r) => r.text());

      const match = html.match(
        /var\s+trackpollBootstrap\s*=\s*(\{[\s\S]*?\});\s*(?:var|<\/script>)/
      );

      if (match) {
        const data = JSON.parse(match[1]);
        const flights = data.flights as Record<string, Record<string, unknown>> | undefined;
        if (flights) {
          for (const entry of Object.values(flights)) {
            const status = entry.flightStatus as string | undefined;
            if (status === "airborne" || status === "En Route") {
              const alt = entry.altitude as number | null;
              const gs = entry.groundspeed as number | null;
              const hdg = entry.heading as number | null;
              const track = entry.track as { coord: [number, number]; alt: number; gs: number }[] | undefined;

              // Get last known position from track
              let lat: number | null = null;
              let lng: number | null = null;
              if (track && track.length > 0) {
                const last = track[track.length - 1];
                lng = last.coord[0];
                lat = last.coord[1];
              }

              const leg = fa.match;
              return Response.json({
                live: true,
                source: "flightaware",
                callsign: (entry.displayIdent as string) ?? cs,
                latitude: lat,
                longitude: lng,
                altitude_ft: alt ? alt * 100 : null,
                speed_knots: gs ?? null,
                heading: hdg ?? null,
                on_ground: false,
                origin: leg?.origin.iata || null,
                destination: leg?.destination.iata || null,
                aircraft: leg?.aircraftFriendly || leg?.aircraft || null,
              });
            }

            // Flight exists but not airborne — return schedule info
            if (fa.match) {
              const leg = fa.match;
              return Response.json({
                live: false,
                source: "flightaware",
                callsign: (entry.displayIdent as string) ?? cs,
                origin: leg.origin.iata || null,
                destination: leg.destination.iata || null,
                aircraft: leg.aircraftFriendly || leg.aircraft || null,
                flight_status: status || null,
                message: status === "arrived"
                  ? "Flight has arrived."
                  : `Flight status: ${status || "unknown"}.`,
              });
            }
          }
        }
      }
    }

    // --- Strategy 2: OpenSky (fallback for flights with ADS-B coverage) ---
    let state: StateVector | null = null;
    for (const cs of callsigns) {
      const results = await fetchStates(cs);
      const match = results.find(
        (r) => r.callsign.replace(/\s+/g, "") === cs
      );
      if (match) {
        state = match;
        break;
      }
    }

    if (state) {
      const speedKnots = state.velocity != null ? Math.round(state.velocity * 1.944) : null;
      const altFeet = state.geoAltitude != null
        ? Math.round(state.geoAltitude * 3.281)
        : state.baroAltitude != null
          ? Math.round(state.baroAltitude * 3.281)
          : null;

      return Response.json({
        live: true,
        source: "opensky",
        callsign: state.callsign,
        icao24: state.icao24,
        latitude: state.latitude,
        longitude: state.longitude,
        altitude_ft: altFeet,
        speed_knots: speedKnots,
        heading: state.heading != null ? Math.round(state.heading) : null,
        on_ground: state.onGround,
        origin_country: state.originCountry,
      });
    }

    return Response.json({
      live: false,
      callsigns_tried: callsigns,
      message: "Flight not found. Check the flight number and try again.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("429")) {
      return Response.json(
        { error: "Rate limited. Try again shortly." },
        { status: 429 }
      );
    }
    return Response.json({ error: message }, { status: 502 });
  }
}
