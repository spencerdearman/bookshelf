/**
 * FlightAware AeroAPI client.
 * Docs: https://aeroapi.flightaware.com/aeroapi
 */

const BASE = "https://aeroapi.flightaware.com/aeroapi";

// ---------- IATA → ICAO airline code mapping ----------

const AIRLINE_IATA_TO_ICAO: Record<string, string> = {
  AA:"AAL",UA:"UAL",DL:"DAL",WN:"SWA",B6:"JBU",AS:"ASA",NK:"NKS",
  F9:"FFT",HA:"HAL",SY:"SCX",G4:"AAY",QX:"QXE",OH:"COM",YX:"RPA",
  BA:"BAW",LH:"DLH",AF:"AFR",KL:"KLM",LX:"SWR",SK:"SAS",AY:"FIN",
  IB:"IBE",TP:"TAP",EI:"EIN",FR:"RYR",U2:"EZY",W6:"WZZ",
  AC:"ACA",WS:"WJA",
  EK:"UAE",QR:"QTR",TK:"THY",EY:"ETD",SV:"SVA",
  NH:"ANA",JL:"JAL",SQ:"SIA",CX:"CPA",QF:"QFA",NZ:"ANZ",
  CA:"CCA",MU:"CES",CZ:"CSN",
  AM:"AMX",AV:"AVA",CM:"CMP",LA:"LAN",
};

/** Convert a user-typed flight number like "UA1764" into ICAO callsigns to try. */
export function expandCallsign(input: string): string[] {
  const clean = input.toUpperCase().replace(/\s+/g, "");
  const results: string[] = [clean];
  const match = clean.match(/^([A-Z]{2})(\d+)$/);
  if (match) {
    const icao = AIRLINE_IATA_TO_ICAO[match[1]];
    if (icao) results.unshift(`${icao}${match[2]}`);
  }
  return [...new Set(results)];
}

function headers() {
  return { "x-apikey": process.env.FLIGHTAWARE_API_KEY! };
}

export interface AeroFlight {
  ident: string;
  ident_icao: string;
  ident_iata: string;
  fa_flight_id: string;
  origin: { code_icao: string; code_iata: string; name: string; city: string };
  destination: { code_icao: string; code_iata: string; name: string; city: string };
  aircraft_type: string | null;
  status: string | null;
  progress_percent: number | null;
  route_distance: number | null;
  filed_airspeed: number | null;
  filed_altitude: number | null;
  route: string | null;
  gate_origin: string | null;
  gate_destination: string | null;
  terminal_origin: string | null;
  terminal_destination: string | null;
  scheduled_out: string | null;
  actual_out: string | null;
  scheduled_off: string | null;
  actual_off: string | null;
  scheduled_on: string | null;
  actual_on: string | null;
  scheduled_in: string | null;
  actual_in: string | null;
  departure_delay: number | null;
  arrival_delay: number | null;
}

function parseFlight(f: Record<string, unknown>): AeroFlight {
  const orig = (f.origin as Record<string, string>) ?? {};
  const dest = (f.destination as Record<string, string>) ?? {};
  return {
    ident: (f.ident as string) ?? "",
    ident_icao: (f.ident_icao as string) ?? "",
    ident_iata: (f.ident_iata as string) ?? "",
    fa_flight_id: (f.fa_flight_id as string) ?? "",
    origin: { code_icao: orig.code_icao ?? "", code_iata: orig.code_iata ?? "", name: orig.name ?? "", city: orig.city ?? "" },
    destination: { code_icao: dest.code_icao ?? "", code_iata: dest.code_iata ?? "", name: dest.name ?? "", city: dest.city ?? "" },
    aircraft_type: (f.aircraft_type as string) ?? null,
    status: (f.status as string) ?? null,
    progress_percent: (f.progress_percent as number) ?? null,
    route_distance: (f.route_distance as number) ?? null,
    filed_airspeed: (f.filed_airspeed as number) ?? null,
    filed_altitude: (f.filed_altitude as number) ?? null,
    route: (f.route as string) ?? null,
    gate_origin: (f.gate_origin as string) ?? null,
    gate_destination: (f.gate_destination as string) ?? null,
    terminal_origin: (f.terminal_origin as string) ?? null,
    terminal_destination: (f.terminal_destination as string) ?? null,
    scheduled_out: (f.scheduled_out as string) ?? null,
    actual_out: (f.actual_out as string) ?? null,
    scheduled_off: (f.scheduled_off as string) ?? null,
    actual_off: (f.actual_off as string) ?? null,
    scheduled_on: (f.scheduled_on as string) ?? null,
    actual_on: (f.actual_on as string) ?? null,
    scheduled_in: (f.scheduled_in as string) ?? null,
    actual_in: (f.actual_in as string) ?? null,
    departure_delay: (f.departure_delay as number) ?? null,
    arrival_delay: (f.arrival_delay as number) ?? null,
  };
}

/** Get departures from an airport. */
export async function getAirportDepartures(
  airportCode: string,
  opts?: { airline?: string; start?: string; end?: string; type?: string }
): Promise<AeroFlight[]> {
  const params = new URLSearchParams();
  if (opts?.airline) params.set("airline", opts.airline);
  if (opts?.start) params.set("start", opts.start);
  if (opts?.end) params.set("end", opts.end);
  if (opts?.type) params.set("type", opts.type);

  const res = await fetch(`${BASE}/airports/${airportCode}/flights/departures?${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`AeroAPI ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return ((data.departures ?? []) as Record<string, unknown>[]).map(parseFlight);
}

/** Get flights between two airports. */
export async function getFlightsBetween(
  originCode: string,
  destCode: string,
  opts?: { start?: string; end?: string; connection?: string }
): Promise<AeroFlight[]> {
  const params = new URLSearchParams();
  if (opts?.start) params.set("start", opts.start);
  if (opts?.end) params.set("end", opts.end);
  if (opts?.connection) params.set("connection", opts.connection);

  const res = await fetch(`${BASE}/airports/${originCode}/flights/to/${destCode}?${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`AeroAPI ${res.status}: ${res.statusText}`);
  const data = await res.json();

  // This endpoint returns { flights: [{ segments: [...] }] }
  const results: AeroFlight[] = [];
  for (const entry of (data.flights ?? []) as Record<string, unknown>[]) {
    const segments = (entry.segments ?? []) as Record<string, unknown>[];
    for (const seg of segments) {
      results.push(parseFlight(seg));
    }
  }
  return results;
}

/** Get flight info by ident (callsign). */
export async function getFlightByIdent(
  ident: string,
  opts?: { start?: string; end?: string }
): Promise<AeroFlight[]> {
  const params = new URLSearchParams();
  params.set("ident_type", "designator");
  if (opts?.start) params.set("start", opts.start);
  if (opts?.end) params.set("end", opts.end);

  const res = await fetch(`${BASE}/flights/${ident}?${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`AeroAPI ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return ((data.flights ?? []) as Record<string, unknown>[]).map(parseFlight);
}

/** Get live position for a flight. */
export async function getFlightPosition(
  faFlightId: string
): Promise<{ latitude: number; longitude: number; altitude: number; groundspeed: number; heading: number } | null> {
  const res = await fetch(`${BASE}/flights/${faFlightId}/position`, { headers: headers() });
  if (!res.ok) return null;
  const data = await res.json();
  const pos = data.last_position;
  if (!pos || pos.latitude == null) return null;
  return {
    latitude: pos.latitude,
    longitude: pos.longitude,
    altitude: pos.altitude ?? 0,
    groundspeed: pos.groundspeed ?? 0,
    heading: pos.heading ?? 0,
  };
}
