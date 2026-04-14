import { NextRequest } from "next/server";
import { fetchStates, expandCallsign } from "@/lib/opensky";
import { lookupFlight } from "@/lib/flightaware";
import { findAirport } from "@/lib/airports";

/**
 * GET /api/flights/refresh?callsign=UAL1764&departure_icao=KIAD
 *
 * Scrapes FlightAware for rich flight data and checks OpenSky for live position.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const callsign = searchParams.get("callsign");
  const departureIcao = searchParams.get("departure_icao") ?? undefined;

  if (!callsign) {
    return Response.json({ error: "callsign required" }, { status: 400 });
  }

  try {
    const callsigns = expandCallsign(callsign);

    // --- FlightAware lookup ---
    for (const cs of callsigns) {
      const result = await lookupFlight(cs, departureIcao);
      if (!result?.match) continue;

      const m = result.match;
      const arrCode = m.destination.iata || m.destination.icao;
      const arr = findAirport(arrCode);

      // Check OpenSky for live position
      let live = null;
      for (const cs2 of callsigns) {
        const states = await fetchStates(cs2);
        const st = states.find((s) => s.callsign.replace(/\s+/g, "") === cs2);
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

      return Response.json({
        updated: true,
        arrival_iata: m.destination.iata || m.destination.icao,
        arrival_icao: m.destination.icao,
        departure_iata: m.origin.iata || m.origin.icao,
        arr_lat: arr?.lat ?? null,
        arr_lng: arr?.lng ?? null,
        // Rich data
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
        status: live ? "in_flight" : (m.status === "L" ? "landed" : "scheduled"),
        live,
      });
    }

    // --- Fallback: OpenSky live only ---
    for (const cs of callsigns) {
      const states = await fetchStates(cs);
      const st = states.find((s) => s.callsign.replace(/\s+/g, "") === cs);
      if (st && st.latitude != null && st.longitude != null) {
        return Response.json({
          updated: true,
          status: "in_flight",
          live: {
            latitude: st.latitude,
            longitude: st.longitude,
            altitude_ft: st.geoAltitude != null ? Math.round(st.geoAltitude * 3.281) : null,
            speed_knots: st.velocity != null ? Math.round(st.velocity * 1.944) : null,
            heading: st.heading != null ? Math.round(st.heading) : null,
          },
        });
      }
    }

    return Response.json({ updated: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}
