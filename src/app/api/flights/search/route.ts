import { NextRequest } from "next/server";
import { getAirportDepartures, getFlightsBetween, AeroFlight } from "@/lib/aeroapi";
import { findAirport } from "@/lib/airports";

export const maxDuration = 30;

function toIcao(code: string): string {
  const upper = code.toUpperCase().trim();
  const airport = findAirport(upper);
  if (airport) return airport.icao;
  if (upper.length === 3) return `K${upper}`;
  return upper;
}

function toAeroFormat(f: AeroFlight) {
  return {
    callsign: f.ident_iata || f.ident_icao || f.ident,
    ident_icao: f.ident_icao,
    fa_flight_id: f.fa_flight_id,
    origin_iata: f.origin.code_iata,
    origin_icao: f.origin.code_icao,
    origin_name: f.origin.name,
    origin_city: f.origin.city,
    dest_iata: f.destination.code_iata,
    dest_icao: f.destination.code_icao,
    dest_name: f.destination.name,
    dest_city: f.destination.city,
    aircraft_type: f.aircraft_type,
    status: f.status,
    progress_percent: f.progress_percent,
    route_distance: f.route_distance,
    filed_airspeed: f.filed_airspeed,
    filed_altitude: f.filed_altitude,
    route: f.route,
    gate_origin: f.gate_origin,
    gate_destination: f.gate_destination,
    terminal_origin: f.terminal_origin,
    terminal_destination: f.terminal_destination,
    scheduled_out: f.scheduled_out,
    actual_out: f.actual_out,
    scheduled_in: f.scheduled_in,
    actual_in: f.actual_in,
    departure_delay: f.departure_delay,
    arrival_delay: f.arrival_delay,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawAirport = searchParams.get("airport");
  const date = searchParams.get("date");
  const dest = searchParams.get("dest")?.toUpperCase().trim() || null;
  const airline = searchParams.get("airline")?.toUpperCase().trim() || null;

  if (!rawAirport || !date) {
    return Response.json({ error: "airport and date are required" }, { status: 400 });
  }

  const airportIcao = toIcao(rawAirport);
  const startDate = `${date}T00:00:00Z`;
  const endDate = `${date}T23:59:59Z`;

  try {
    let flights: AeroFlight[];

    if (dest) {
      // Origin + Destination: use the flights-between endpoint
      const destIcao = toIcao(dest);
      flights = await getFlightsBetween(airportIcao, destIcao, {
        start: startDate,
        end: endDate,
        connection: "nonstop",
      });
    } else {
      // Origin only: get departures
      flights = await getAirportDepartures(airportIcao, {
        start: startDate,
        end: endDate,
        type: "Airline",
        airline: airline || undefined,
      });
    }

    // Airline filter (for origin+dest searches where API doesn't filter)
    if (airline && dest) {
      const af = airline.toUpperCase();
      flights = flights.filter((f) => {
        const iata = (f.ident_iata || "").toUpperCase();
        const icao = (f.ident_icao || "").toUpperCase();
        return iata.startsWith(af) || icao.startsWith(af);
      });
    }

    // Deduplicate by fa_flight_id
    const seen = new Set<string>();
    flights = flights.filter((f) => {
      if (!f.fa_flight_id || seen.has(f.fa_flight_id)) return false;
      seen.add(f.fa_flight_id);
      return true;
    });

    return Response.json({
      flights: flights.map(toAeroFormat),
      source: "aeroapi",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}
