import { NextRequest } from "next/server";
import { fetchDepartures, fetchArrivals, expandCallsign } from "@/lib/opensky";
import { findAirport } from "@/lib/airports";

export const maxDuration = 30;

function toIcao(code: string): string {
  const upper = code.toUpperCase().trim();
  const airport = findAirport(upper);
  if (airport) return airport.icao;
  if (upper.length === 3) return `K${upper}`;
  return upper;
}

function toIata(code: string): string {
  const c = code.toUpperCase().trim();
  if (!c) return c;
  const airport = findAirport(c);
  if (airport) return airport.iata;
  if (c.length === 4 && c.startsWith("K")) return c.slice(1);
  return c;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawAirport = searchParams.get("airport");
  const date = searchParams.get("date");
  const mode = searchParams.get("mode") ?? "departures";
  const destIata = searchParams.get("dest")?.toUpperCase().trim() || null;
  const airline = searchParams.get("airline")?.toUpperCase().trim() || null;

  if (!rawAirport || !date) {
    return Response.json({ error: "airport and date are required" }, { status: 400 });
  }

  const airport = toIcao(rawAirport);
  const dayStart = new Date(`${date}T00:00:00Z`);
  const dayEnd = new Date(`${date}T23:59:59Z`);
  const begin = Math.floor(dayStart.getTime() / 1000);
  const end = Math.floor(dayEnd.getTime() / 1000);

  try {
    let flights = mode === "arrivals"
      ? await fetchArrivals(airport, begin, end)
      : await fetchDepartures(airport, begin, end);

    // Filter to flights with callsigns
    flights = flights.filter((f) => f.callsign?.trim());

    // Airline filter
    if (airline) {
      const prefixes = expandCallsign(`${airline}1`).map((c) => c.replace(/\d+$/, ""));
      flights = flights.filter((f) => {
        const cs = (f.callsign ?? "").trim().toUpperCase();
        return prefixes.some((p) => cs.startsWith(p));
      });
    }

    // Destination filter — match against known OpenSky arrivals only
    // Flights with unknown destinations are kept so the client can enrich them
    if (destIata) {
      const destTarget = toIata(destIata);
      const destIcaoCode = toIcao(destIata);

      flights = flights.filter((f) => {
        const arr = f.estArrivalAirport;
        if (!arr) return true; // Unknown — keep it, client will resolve
        return toIata(arr) === destTarget || arr === destIcaoCode;
      });
    }

    return Response.json({ flights });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}
