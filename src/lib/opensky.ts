const TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const API_BASE = "https://opensky-network.org/api";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.OPENSKY_CLIENT_ID!,
      client_secret: process.env.OPENSKY_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenSky token error: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 30) * 1000;
  return cachedToken!;
}

// ---------- Types ----------

export interface OpenSkyFlight {
  icao24: string;
  firstSeen: number;
  estDepartureAirport: string | null;
  lastSeen: number;
  estArrivalAirport: string | null;
  callsign: string | null;
  estDepartureAirportHorizDistance: number;
  estDepartureAirportVertDistance: number;
  estArrivalAirportHorizDistance: number;
  estArrivalAirportVertDistance: number;
  departureAirportCandidatesCount: number;
  arrivalAirportCandidatesCount: number;
}

export interface StateVector {
  icao24: string;
  callsign: string;
  originCountry: string;
  longitude: number | null;
  latitude: number | null;
  baroAltitude: number | null;
  onGround: boolean;
  velocity: number | null;    // m/s
  heading: number | null;     // degrees
  verticalRate: number | null;
  geoAltitude: number | null;
}

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

  // Try to split into airline + number
  const match = clean.match(/^([A-Z]{2})(\d+)$/);
  if (match) {
    const icao = AIRLINE_IATA_TO_ICAO[match[1]];
    if (icao) {
      results.unshift(`${icao}${match[2]}`);
    }
  }
  return [...new Set(results)];
}

// ---------- API calls ----------

export async function fetchDepartures(
  airport: string,
  begin: number,
  end: number
): Promise<OpenSkyFlight[]> {
  const token = await getToken();
  const url = `${API_BASE}/flights/departure?airport=${encodeURIComponent(airport)}&begin=${begin}&end=${end}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`OpenSky API error: ${res.status}`);

  return res.json();
}

export async function fetchArrivals(
  airport: string,
  begin: number,
  end: number
): Promise<OpenSkyFlight[]> {
  const token = await getToken();
  const url = `${API_BASE}/flights/arrival?airport=${encodeURIComponent(airport)}&begin=${begin}&end=${end}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`OpenSky API error: ${res.status}`);

  return res.json();
}

/**
 * Fetch live state vectors. Optionally filter by callsign.
 * Returns current positions, altitudes, velocities.
 */
export async function fetchStates(callsign?: string): Promise<StateVector[]> {
  const token = await getToken();
  let url = `${API_BASE}/states/all`;
  if (callsign) {
    // Pad callsign to 8 chars with spaces (OpenSky format)
    url += `?callsign=${encodeURIComponent(callsign)}`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 404 || res.status === 429) return [];
    throw new Error(`OpenSky states error: ${res.status}`);
  }

  const data = await res.json();
  if (!data.states) return [];

  return data.states.map((s: (string | number | boolean | null)[]) => ({
    icao24: s[0] as string,
    callsign: ((s[1] as string) ?? "").trim(),
    originCountry: s[2] as string,
    longitude: s[5] as number | null,
    latitude: s[6] as number | null,
    baroAltitude: s[7] as number | null,
    onGround: s[8] as boolean,
    velocity: s[9] as number | null,
    heading: s[10] as number | null,
    verticalRate: s[11] as number | null,
    geoAltitude: s[13] as number | null,
  }));
}

/**
 * Fetch flights for a specific aircraft by ICAO24 transponder code.
 * Useful for looking up arrival airports after a flight has landed.
 */
export async function fetchFlightsByAircraft(
  icao24: string,
  begin: number,
  end: number
): Promise<OpenSkyFlight[]> {
  const token = await getToken();
  const url = `${API_BASE}/flights/aircraft?icao24=${encodeURIComponent(icao24.toLowerCase())}&begin=${begin}&end=${end}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`OpenSky aircraft lookup error: ${res.status}`);

  return res.json();
}
