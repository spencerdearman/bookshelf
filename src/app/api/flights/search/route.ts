import { NextRequest } from "next/server";
import { fetchDepartures, fetchArrivals, expandCallsign } from "@/lib/opensky";
import { findAirport } from "@/lib/airports";
import { lookupFlight, searchRoute } from "@/lib/flightaware";

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
  const originIata = toIata(rawAirport);
  const dayStart = new Date(`${date}T00:00:00Z`);
  const dayEnd = new Date(`${date}T23:59:59Z`);
  const begin = Math.floor(dayStart.getTime() / 1000);
  const end = Math.floor(dayEnd.getTime() / 1000);

  // ── Strategy 1: If origin+dest provided, use FlightAware route search ──
  if (destIata) {
    const destIcaoCode = toIcao(destIata);
    const destTarget = toIata(destIata);

    try {
      // Get airline prefix for filtering
      const airlinePrefix = airline
        ? expandCallsign(`${airline}1`).map((c) => c.replace(/\d+$/, ""))[0]
        : undefined;

      // Search FlightAware for flights between these airports
      const callsigns = await searchRoute(airport, destIcaoCode, airlinePrefix);
      const matched: {
        icao24: string; firstSeen: number; estDepartureAirport: string | null;
        lastSeen: number; estArrivalAirport: string | null; callsign: string | null;
        estDepartureAirportHorizDistance: number; estDepartureAirportVertDistance: number;
        estArrivalAirportHorizDistance: number; estArrivalAirportVertDistance: number;
        departureAirportCandidatesCount: number; arrivalAirportCandidatesCount: number;
      }[] = [];

      for (const cs of callsigns.slice(0, 8)) {
        try {
          const result = await lookupFlight(cs, airport);
          if (!result?.match) continue;
          const leg = result.match;
          const legOrig = leg.origin.iata || toIata(leg.origin.icao);
          const legDest = leg.destination.iata || toIata(leg.destination.icao);
          if (legOrig === originIata && legDest === destTarget) {
            matched.push({
              icao24: "",
              firstSeen: leg.takeoff.actual ?? leg.takeoff.scheduled ?? begin,
              estDepartureAirport: leg.origin.icao || airport,
              lastSeen: leg.landing.actual ?? leg.landing.scheduled ?? end,
              estArrivalAirport: leg.destination.icao || destIcaoCode,
              callsign: cs,
              estDepartureAirportHorizDistance: 0, estDepartureAirportVertDistance: 0,
              estArrivalAirportHorizDistance: 0, estArrivalAirportVertDistance: 0,
              departureAirportCandidatesCount: 0, arrivalAirportCandidatesCount: 0,
            });
          }
        } catch { /* skip individual lookup failures */ }
      }

      if (matched.length > 0) {
        return Response.json({ flights: matched });
      }
    } catch { /* FlightAware route search failed, try OpenSky below */ }
  }

  // ── Strategy 2: OpenSky (works locally, may fail on Vercel) ──
  try {
    let flights = mode === "arrivals"
      ? await fetchArrivals(airport, begin, end)
      : await fetchDepartures(airport, begin, end);

    flights = flights.filter((f) => f.callsign?.trim());

    // Airline filter
    if (airline) {
      const prefixes = expandCallsign(`${airline}1`).map((c) => c.replace(/\d+$/, ""));
      flights = flights.filter((f) => {
        const cs = (f.callsign ?? "").trim().toUpperCase();
        return prefixes.some((p) => cs.startsWith(p));
      });
    }

    // Dest filter on OpenSky results
    if (destIata) {
      const destTarget = toIata(destIata);
      const destIcaoCode = toIcao(destIata);
      flights = flights.filter((f) => {
        const arr = f.estArrivalAirport;
        if (!arr) return true; // Unknown — keep, client can resolve
        return toIata(arr) === destTarget || arr === destIcaoCode;
      });
    }

    return Response.json({ flights });
  } catch {
    // OpenSky also failed
  }

  // ── Both failed ──
  if (destIata) {
    return Response.json({
      flights: [],
      message: "Flight data providers are temporarily unreachable. Try again shortly.",
    });
  }

  return Response.json({
    flights: [],
    error: "Flight data is temporarily unavailable. Try adding a destination to search via FlightAware.",
  });
}
