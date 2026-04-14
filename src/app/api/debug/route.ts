export async function GET() {
  const results: Record<string, string> = {};

  // Test 1: OpenSky token endpoint
  try {
    const res = await fetch(
      "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: process.env.OPENSKY_CLIENT_ID || "missing",
          client_secret: process.env.OPENSKY_CLIENT_SECRET || "missing",
        }),
      }
    );
    results.opensky_token = `${res.status} ${res.statusText}`;
    if (!res.ok) {
      const body = await res.text();
      results.opensky_token_body = body.slice(0, 200);
    }
  } catch (e) {
    results.opensky_token = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Test 2: OpenSky API (small request)
  try {
    const now = Math.floor(Date.now() / 1000);
    const res = await fetch(
      `https://opensky-network.org/api/flights/departure?airport=KJFK&begin=${now - 7200}&end=${now}`
    );
    results.opensky_api = `${res.status} ${res.statusText}`;
  } catch (e) {
    results.opensky_api = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Test 3: FlightAware
  try {
    const res = await fetch("https://www.flightaware.com/live/flight/UAL1", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    results.flightaware = `${res.status} ${res.statusText}`;
  } catch (e) {
    results.flightaware = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Test 4: Env vars present
  results.env_opensky_id = process.env.OPENSKY_CLIENT_ID ? "set" : "MISSING";
  results.env_opensky_secret = process.env.OPENSKY_CLIENT_SECRET ? "set" : "MISSING";
  results.env_mapbox = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? "set" : "MISSING";

  return Response.json(results);
}
