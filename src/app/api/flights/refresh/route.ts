import { NextRequest } from "next/server";
import { getFlightByIdent, getFlightPosition, AeroFlight, expandCallsign } from "@/lib/aeroapi";
import { findAirport } from "@/lib/airports";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const callsign = searchParams.get("callsign");

  if (!callsign) {
    return Response.json({ error: "callsign required" }, { status: 400 });
  }

  const callsigns = expandCallsign(callsign);

  try {
    for (const cs of callsigns) {
      let flights: AeroFlight[];
      try {
        flights = await getFlightByIdent(cs);
      } catch {
        continue;
      }
      if (flights.length === 0) continue;

      const f = flights[0];
      const arrCode = f.destination.code_iata || f.destination.code_icao;
      const arr = findAirport(arrCode);
      const isLive = f.progress_percent != null && f.progress_percent > 0 && f.progress_percent < 100;

      // Get live position if in flight
      let live = null;
      if (isLive && f.fa_flight_id) {
        try {
          const pos = await getFlightPosition(f.fa_flight_id);
          if (pos) {
            live = {
              latitude: pos.latitude,
              longitude: pos.longitude,
              altitude_ft: pos.altitude * 100,
              speed_knots: pos.groundspeed,
              heading: pos.heading,
            };
          }
        } catch { /* position unavailable */ }
      }

      return Response.json({
        updated: true,
        arrival_iata: f.destination.code_iata,
        arrival_icao: f.destination.code_icao,
        departure_iata: f.origin.code_iata,
        arr_lat: arr?.lat ?? null,
        arr_lng: arr?.lng ?? null,
        aircraft_type: f.aircraft_type,
        aircraft_friendly: f.aircraft_type,
        flight_status: f.status,
        origin_gate: f.gate_origin,
        origin_terminal: f.terminal_origin,
        dest_gate: f.gate_destination,
        dest_terminal: f.terminal_destination,
        gate_departure: { scheduled: f.scheduled_out, actual: f.actual_out },
        gate_arrival: { scheduled: f.scheduled_in, actual: f.actual_in },
        takeoff: { scheduled: null, actual: null },
        landing: { scheduled: null, actual: null },
        route: f.route,
        direct_distance_mi: f.route_distance,
        planned_speed_kts: f.filed_airspeed,
        planned_altitude_ft: f.filed_altitude ? f.filed_altitude * 100 : null,
        progress_percent: f.progress_percent,
        status: isLive ? "in_flight" : (f.status?.includes("Arrived") ? "landed" : "scheduled"),
        live,
      });
    }

    return Response.json({ updated: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}
