/**
 * FlightAware scraper — extracts rich flight data from public FlightAware pages.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export interface FlightAwareLeg {
  origin: { iata: string; icao: string; name: string; coord: [number, number]; gate: string | null; terminal: string | null };
  destination: { iata: string; icao: string; name: string; coord: [number, number]; gate: string | null; terminal: string | null };
  aircraft: string | null;
  aircraftFriendly: string | null;
  flightId: string;
  status: string | null;
  // Times (unix seconds)
  gateDeparture: { scheduled: number | null; actual: number | null };
  gateArrival: { scheduled: number | null; actual: number | null };
  takeoff: { scheduled: number | null; actual: number | null };
  landing: { scheduled: number | null; actual: number | null };
  // Flight plan
  route: string | null;
  directDistanceMi: number | null;
  plannedDistanceMi: number | null;
  plannedSpeedKts: number | null;
  plannedAltitude: number | null; // hundreds of feet
  fuelBurnGal: number | null;
}

export interface FlightAwareResult {
  callsign: string;
  legs: FlightAwareLeg[];
  match: FlightAwareLeg | null;
}

export async function lookupFlight(
  callsign: string,
  departureIcao?: string
): Promise<FlightAwareResult | null> {
  const url = `https://www.flightaware.com/live/flight/${encodeURIComponent(callsign)}`;

  const res = await fetch(url, {
    headers: { "User-Agent": UA },
  });

  if (!res.ok) return null;

  const html = await res.text();

  const match = html.match(
    /var\s+trackpollBootstrap\s*=\s*(\{[\s\S]*?\});\s*(?:var|<\/script>)/
  );

  if (!match) return parseMetaTags(html, callsign);

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return parseMetaTags(html, callsign);
  }

  const flights = data.flights as Record<string, unknown> | undefined;
  if (!flights) return null;

  const legs: FlightAwareLeg[] = [];

  for (const entry of Object.values(flights)) {
    const activityLog = (entry as Record<string, unknown>).activityLog as Record<string, unknown> | undefined;
    if (!activityLog) continue;

    const flightList = activityLog.flights as unknown[] | undefined;
    if (!flightList) continue;

    for (const f of flightList) {
      const leg = parseLeg(f as Record<string, unknown>);
      if (leg) legs.push(leg);
    }
  }

  if (legs.length === 0) return null;

  let best: FlightAwareLeg | null = null;
  if (departureIcao) {
    const dep = departureIcao.toUpperCase();
    best = legs.find((l) => l.origin.icao === dep) ?? null;
  }
  if (!best) best = legs[legs.length - 1];

  return { callsign, legs, match: best };
}

function ts(obj: Record<string, unknown> | undefined, key: string): number | null {
  if (!obj) return null;
  const v = obj[key];
  return typeof v === "number" ? v : null;
}

function parseLeg(f: Record<string, unknown>): FlightAwareLeg | null {
  const origin = f.origin as Record<string, unknown> | null;
  const dest = f.destination as Record<string, unknown> | null;
  if (!origin || !dest) return null;

  const oIata = (origin.iata as string) ?? "";
  const oIcao = (origin.icao as string) ?? "";
  const dIata = (dest.iata as string) ?? "";
  const dIcao = (dest.icao as string) ?? "";
  if (!oIcao && !oIata) return null;
  if (!dIcao && !dIata) return null;

  const takeoffTimes = f.takeoffTimes as Record<string, unknown> | undefined;
  const landingTimes = f.landingTimes as Record<string, unknown> | undefined;
  const gateDep = f.gateDepartureTimes as Record<string, unknown> | undefined;
  const gateArr = f.gateArrivalTimes as Record<string, unknown> | undefined;
  const plan = f.flightPlan as Record<string, unknown> | undefined;
  const fuel = plan?.fuelBurn as Record<string, unknown> | undefined;

  return {
    origin: {
      iata: oIata,
      icao: oIcao,
      name: (origin.friendlyName as string) ?? "",
      coord: (origin.coord as [number, number]) ?? [0, 0],
      gate: (origin.gate as string) ?? null,
      terminal: (origin.terminal as string) ?? null,
    },
    destination: {
      iata: dIata,
      icao: dIcao,
      name: (dest.friendlyName as string) ?? "",
      coord: (dest.coord as [number, number]) ?? [0, 0],
      gate: (dest.gate as string) ?? null,
      terminal: (dest.terminal as string) ?? null,
    },
    aircraft: (f.aircraftType as string) ?? null,
    aircraftFriendly: (f.aircraftTypeFriendly as string) ?? null,
    flightId: (f.flightId as string) ?? "",
    status: (f.flightStatus as string) ?? null,
    gateDeparture: { scheduled: ts(gateDep, "scheduled"), actual: ts(gateDep, "actual") },
    gateArrival: { scheduled: ts(gateArr, "scheduled"), actual: ts(gateArr, "actual") },
    takeoff: { scheduled: ts(takeoffTimes, "scheduled"), actual: ts(takeoffTimes, "actual") },
    landing: { scheduled: ts(landingTimes, "scheduled"), actual: ts(landingTimes, "actual") },
    route: (plan?.route as string) ?? null,
    directDistanceMi: typeof plan?.directDistance === "number" ? plan.directDistance : null,
    plannedDistanceMi: typeof plan?.plannedDistance === "number" ? plan.plannedDistance : null,
    plannedSpeedKts: typeof plan?.speed === "number" ? plan.speed : null,
    plannedAltitude: typeof plan?.altitude === "number" ? plan.altitude : null,
    fuelBurnGal: typeof fuel?.gallons === "number" ? fuel.gallons : null,
  };
}

function parseMetaTags(html: string, callsign: string): FlightAwareResult | null {
  const originMatch = html.match(/<meta\s+name="origin"\s+content="([^"]+)"/);
  const destMatch = html.match(/<meta\s+name="destination"\s+content="([^"]+)"/);
  if (!originMatch || !destMatch) return null;

  const leg: FlightAwareLeg = {
    origin: { iata: "", icao: originMatch[1], name: "", coord: [0, 0], gate: null, terminal: null },
    destination: { iata: "", icao: destMatch[1], name: "", coord: [0, 0], gate: null, terminal: null },
    aircraft: null, aircraftFriendly: null, flightId: "", status: null,
    gateDeparture: { scheduled: null, actual: null },
    gateArrival: { scheduled: null, actual: null },
    takeoff: { scheduled: null, actual: null },
    landing: { scheduled: null, actual: null },
    route: null, directDistanceMi: null, plannedDistanceMi: null,
    plannedSpeedKts: null, plannedAltitude: null, fuelBurnGal: null,
  };

  return { callsign, legs: [leg], match: leg };
}

/**
 * Search FlightAware for flights between two airports.
 * Returns callsigns (e.g. ["UAL881", "ANA111"]).
 */
export async function searchRoute(
  originIcao: string,
  destIcao: string,
  airlinePrefix?: string
): Promise<string[]> {
  const url = `https://www.flightaware.com/live/findflight?origin=${encodeURIComponent(originIcao)}&destination=${encodeURIComponent(destIcao)}`;

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];

  const html = await res.text();

  // Extract callsigns (ICAO format: 2-3 letter airline + digits)
  const matches = html.match(/(?:[A-Z]{2,3})\d{1,5}/g) ?? [];
  const unique = [...new Set(matches)];

  if (airlinePrefix) {
    const prefix = airlinePrefix.toUpperCase();
    return unique.filter((cs) => cs.startsWith(prefix));
  }
  return unique;
}
