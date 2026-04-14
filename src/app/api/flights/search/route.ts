import { NextRequest } from "next/server";
import { fetchDepartures, fetchArrivals, expandCallsign } from "@/lib/opensky";
import { findAirport } from "@/lib/airports";
import { lookupFlight, searchRoute } from "@/lib/flightaware";

export const runtime = "edge";

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

    // Destination filter
    if (destIata) {
      const destTarget = toIata(destIata);
      const destIcaoCode = toIcao(destIata);
      const matched: typeof flights = [];
      const unknowns: typeof flights = [];

      for (const f of flights) {
        const arr = f.estArrivalAirport;
        if (arr) {
          if (toIata(arr) === destTarget || arr === destIcaoCode) {
            matched.push(f);
          }
        } else {
          unknowns.push(f);
        }
      }

      // Only enrich unknowns if we have some OpenSky matches already
      // (otherwise skip straight to route search which is faster)
      if (matched.length > 0 && unknowns.length > 0) {
        for (const f of unknowns.slice(0, 5)) {
          const cs = (f.callsign ?? "").trim();
          if (!cs) continue;
          try {
            const result = await lookupFlight(cs, airport);
            if (result?.match) {
              const arrIata = result.match.destination.iata || toIata(result.match.destination.icao);
              f.estArrivalAirport = result.match.destination.icao || null;
              if (arrIata === destTarget) {
                matched.push(f);
              }
            }
          } catch { /* skip */ }
        }
      }

      // If STILL 0 results, search FlightAware for flights on this route
      if (matched.length === 0) {
        try {
          const airlinePrefix = airline
            ? expandCallsign(`${airline}1`).map((c) => c.replace(/\d+$/, ""))[0]
            : undefined;
          const routeCallsigns = await searchRoute(airport, destIcaoCode, airlinePrefix);

          for (const cs of routeCallsigns.slice(0, 5)) {
            try {
              const faResult = await lookupFlight(cs, airport);
              if (!faResult?.match) continue;
              const leg = faResult.match;
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
                  estDepartureAirportHorizDistance: 0,
                  estDepartureAirportVertDistance: 0,
                  estArrivalAirportHorizDistance: 0,
                  estArrivalAirportVertDistance: 0,
                  departureAirportCandidatesCount: 0,
                  arrivalAirportCandidatesCount: 0,
                });
              }
            } catch { /* skip */ }
          }
        } catch { /* skip route search */ }
      }

      return Response.json({ flights: matched });
    }

    return Response.json({ flights });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}
