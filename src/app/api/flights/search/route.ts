import { NextRequest } from "next/server";
import { fetchDepartures } from "@/lib/opensky";

/**
 * Convert user input to ICAO code.
 * US airports: 3-letter IATA codes get a "K" prefix (e.g. IAD → KIAD).
 * 4-letter codes are assumed to already be ICAO.
 */
function toIcao(code: string): string {
  const upper = code.toUpperCase().trim();
  if (upper.length === 3) return `K${upper}`;
  return upper;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawAirport = searchParams.get("airport");
  const date = searchParams.get("date"); // YYYY-MM-DD

  if (!rawAirport || !date) {
    return Response.json(
      { error: "airport and date are required" },
      { status: 400 }
    );
  }

  const airport = toIcao(rawAirport);

  // Convert date to unix timestamps (full day)
  const dayStart = new Date(`${date}T00:00:00Z`);
  const dayEnd = new Date(`${date}T23:59:59Z`);
  const begin = Math.floor(dayStart.getTime() / 1000);
  const end = Math.floor(dayEnd.getTime() / 1000);

  try {
    const flights = await fetchDepartures(airport, begin, end);
    return Response.json({ flights });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}
