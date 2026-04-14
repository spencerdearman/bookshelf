import { NextRequest } from "next/server";
import { fetchStates, expandCallsign } from "@/lib/opensky";
import { lookupFlight } from "@/lib/flightaware";
import { findAirport } from "@/lib/airports";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const callsign = searchParams.get("callsign");
  const departureIcao = searchParams.get("departure_icao") ?? undefined;

  if (!callsign) {
    return Response.json({ error: "callsign required" }, { status: 400 });
  }

  const callsigns = expandCallsign(callsign);
  let faData: Record<string, unknown> | null = null;
  let live: Record<string, unknown> | null = null;

  // --- Step 1: Try FlightAware (wrapped in try/catch so failures don't kill the request) ---
  try {
    for (const cs of callsigns) {
      const result = await lookupFlight(cs, departureIcao);
      if (!result?.match) continue;

      const m = result.match;
      const arrCode = m.destination.iata || m.destination.icao;
      const arr = findAirport(arrCode);

      faData = {
        updated: true,
        arrival_iata: m.destination.iata || m.destination.icao,
        arrival_icao: m.destination.icao,
        departure_iata: m.origin.iata || m.origin.icao,
        arr_lat: arr?.lat ?? null,
        arr_lng: arr?.lng ?? null,
        aircraft_type: m.aircraft,
        aircraft_friendly: m.aircraftFriendly,
        flight_status: m.status,
        origin_gate: m.origin.gate,
        origin_terminal: m.origin.terminal,
        dest_gate: m.destination.gate,
        dest_terminal: m.destination.terminal,
        gate_departure: m.gateDeparture,
        gate_arrival: m.gateArrival,
        takeoff: m.takeoff,
        landing: m.landing,
        route: m.route,
        direct_distance_mi: m.directDistanceMi,
        planned_distance_mi: m.plannedDistanceMi,
        planned_speed_kts: m.plannedSpeedKts,
        planned_altitude_ft: m.plannedAltitude ? m.plannedAltitude * 100 : null,
        fuel_burn_gal: m.fuelBurnGal,
      };
      break;
    }
  } catch {
    // FlightAware failed (blocked, timeout, etc.) — continue without it
  }

  // --- Step 2: Try OpenSky for live position ---
  try {
    for (const cs of callsigns) {
      const states = await fetchStates(cs);
      const st = states.find((s) => s.callsign.replace(/\s+/g, "") === cs);
      if (st && st.latitude != null && st.longitude != null) {
        live = {
          latitude: st.latitude,
          longitude: st.longitude,
          altitude_ft: st.geoAltitude != null ? Math.round(st.geoAltitude * 3.281) : null,
          speed_knots: st.velocity != null ? Math.round(st.velocity * 1.944) : null,
          heading: st.heading != null ? Math.round(st.heading) : null,
        };
        break;
      }
    }
  } catch {
    // OpenSky failed — continue without it
  }

  // --- Combine results ---
  if (faData) {
    return Response.json({
      ...faData,
      status: live ? "in_flight" : (faData.flight_status === "arrived" ? "landed" : "scheduled"),
      live,
    });
  }

  if (live) {
    return Response.json({ updated: true, status: "in_flight", live });
  }

  return Response.json({ updated: false });
}
