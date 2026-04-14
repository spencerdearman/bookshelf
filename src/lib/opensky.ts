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
  // Refresh 30s before expiry
  tokenExpiresAt = Date.now() + (data.expires_in - 30) * 1000;
  return cachedToken!;
}

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
