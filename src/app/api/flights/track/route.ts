import { NextRequest } from "next/server";
import { getFlightByIdent, getFlightPosition, AeroFlight, expandCallsign } from "@/lib/aeroapi";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const flight = searchParams.get("flight");

  if (!flight) {
    return Response.json({ error: "flight parameter is required (e.g. UA881)" }, { status: 400 });
  }

  // expandCallsign converts UA881 -> [UAL881, UA881]
  const callsigns = expandCallsign(flight);

  try {
    for (const cs of callsigns) {
      let flights: AeroFlight[];
      try {
        flights = await getFlightByIdent(cs);
      } catch {
        continue;
      }
      if (flights.length === 0) continue;

      // Get the most recent flight
      const f = flights[0];
      const isLive = f.progress_percent != null && f.progress_percent > 0 && f.progress_percent < 100;

      // Try to get live position
      let lat: number | null = null;
      let lng: number | null = null;
      let alt: number | null = null;
      let spd: number | null = null;
      let hdg: number | null = null;

      if (isLive && f.fa_flight_id) {
        try {
          const pos = await getFlightPosition(f.fa_flight_id);
          if (pos) {
            lat = pos.latitude;
            lng = pos.longitude;
            alt = pos.altitude * 100; // hundreds of feet -> feet
            spd = pos.groundspeed;
            hdg = pos.heading;
          }
        } catch { /* position unavailable */ }
      }

      return Response.json({
        live: isLive,
        source: "aeroapi",
        callsign: f.ident_iata || f.ident_icao || f.ident,
        origin: f.origin.code_iata || f.origin.code_icao,
        destination: f.destination.code_iata || f.destination.code_icao,
        aircraft: f.aircraft_type,
        flight_status: f.status,
        progress_percent: f.progress_percent,
        latitude: lat,
        longitude: lng,
        altitude_ft: alt,
        speed_knots: spd,
        heading: hdg,
        message: isLive ? null : (f.status || "Flight not currently airborne."),
      });
    }

    return Response.json({
      live: false,
      message: "Flight not found. Check the flight number and try again.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}
