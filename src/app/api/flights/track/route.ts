import { NextRequest } from "next/server";
import { fetchStates, expandCallsign, StateVector } from "@/lib/opensky";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const flight = searchParams.get("flight");

  if (!flight) {
    return Response.json(
      { error: "flight parameter is required (e.g. UA1764)" },
      { status: 400 }
    );
  }

  const callsigns = expandCallsign(flight);

  try {
    let state: StateVector | null = null;

    for (const cs of callsigns) {
      const results = await fetchStates(cs);
      // Verify the returned callsign actually matches (OpenSky does prefix matching)
      const match = results.find(
        (r) => r.callsign.replace(/\s+/g, "") === cs
      );
      if (match) {
        state = match;
        break;
      }
    }

    if (!state) {
      return Response.json({
        live: false,
        callsigns_tried: callsigns,
        message: "Flight not currently airborne or callsign not found.",
      });
    }

    // Convert m/s → knots, meters → feet
    const speedKnots = state.velocity != null ? Math.round(state.velocity * 1.944) : null;
    const altFeet = state.geoAltitude != null
      ? Math.round(state.geoAltitude * 3.281)
      : state.baroAltitude != null
        ? Math.round(state.baroAltitude * 3.281)
        : null;

    return Response.json({
      live: true,
      callsign: state.callsign,
      icao24: state.icao24,
      latitude: state.latitude,
      longitude: state.longitude,
      altitude_ft: altFeet,
      speed_knots: speedKnots,
      heading: state.heading != null ? Math.round(state.heading) : null,
      vertical_rate_fpm: state.verticalRate != null ? Math.round(state.verticalRate * 196.85) : null,
      on_ground: state.onGround,
      origin_country: state.originCountry,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("429")) {
      return Response.json(
        { error: "Rate limited by flight data provider. Try again shortly." },
        { status: 429 }
      );
    }
    return Response.json({ error: message }, { status: 502 });
  }
}
