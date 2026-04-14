# Vector

A flight tracking and logbook web application. Search flights by origin, destination, and airline. Track live flights in real time. Build a personal logbook of everywhere you've flown.

## Features

- **Flight Search** — Search departures from any airport by date. Filter by destination and airline code. Supports both IATA (IAD) and ICAO (KIAD) codes with automatic conversion, including international airports (HNL, HND, LHR, etc.)
- **Live Flight Tracking** — Track any active flight by airline code and flight number. Displays real-time altitude, speed, heading, and position. Works for oceanic and international flights via FlightAware.
- **Flight Logbook** — Save flights to a personal logbook with departure/arrival airports, aircraft type, and timestamps. Click any flight to view a detail page with route map, gate information, and full FlightAware data.
- **Route Map** — Great-circle arc routes rendered on Mapbox with origin/destination markers and live aircraft position interpolated along the curve. Handles antimeridian crossings for transpacific routes.
- **Dashboard** — Overview of total flights, hours, nautical miles, and unique airports. Full route map showing every flight you've taken. Live flight tracker sidebar.
- **Leaderboard** — Compare flight counts and airport coverage with other users.
- **Share Flights** — Generate shareable links for individual flights viewable without authentication.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/) |
| Authentication | [Clerk](https://clerk.com/) |
| Database | [Supabase](https://supabase.com/) (PostgreSQL + RLS) |
| Maps | [Mapbox GL JS](https://www.mapbox.com/) via react-map-gl |
| Flight Data | [OpenSky Network](https://opensky-network.org/) API + [FlightAware](https://www.flightaware.com/) |

## Data Pipeline

Flight search uses a multi-source pipeline:

1. **OpenSky Network** — Primary source for airport departure/arrival queries. Returns flight callsigns, ICAO24 transponder codes, and timestamps for a given airport and date.
2. **FlightAware** — Enriches OpenSky results with destination airports, aircraft types, gate/terminal info, and scheduled times. Acts as the primary source for live flight tracking (global coverage including oceanic flights). Also provides route-based search when OpenSky has data gaps.
3. **Airport Database** — Built-in database of 60+ major airports with ICAO/IATA codes, coordinates, and city names. Handles code conversion (RJTT to HND, PHNL to HNL, etc.) for proper filtering and map rendering.

## Project Structure

```
src/
  app/
    page.tsx              # Dashboard with stats, route map, recent flights
    log/page.tsx          # Search/Track/Manual flight entry
    logbook/page.tsx      # Personal flight logbook
    leaderboard/page.tsx  # Comparative leaderboard
    flight/[id]/page.tsx  # Flight detail with map and FlightAware data
    shared/[id]/page.tsx  # Public shared flight view
    api/
      flights/
        search/route.ts   # Airport departure/arrival search with dest filtering
        track/route.ts    # Live flight tracking by callsign
        refresh/route.ts  # Flight data enrichment via FlightAware
      share/route.ts      # Share link creation and resolution
  components/
    FlightCard.tsx        # Flight display card (full and compact modes)
    FlightMap.tsx         # Single-route Mapbox map with great-circle arc
    AllRoutesMap.tsx       # Multi-route dashboard map
    FlightSearch.tsx       # Live flight tracker form
  lib/
    opensky.ts            # OpenSky Network API client
    flightaware.ts        # FlightAware scraper (trackpollBootstrap + route search)
    airports.ts           # Airport code database and coordinate lookup
    supabase.ts           # Supabase client with Clerk auth integration
```

## Database Schema

```sql
-- User profiles
profiles (clerk_id TEXT PK, home_airport, total_miles, total_flights)

-- Flight records
flights (id UUID PK, user_id, flight_number, departure_iata, arrival_iata,
         scheduled_departure, scheduled_arrival, aircraft_type, airline_name,
         distance_nm, notes)

-- Shareable flight links
share_links (id UUID PK, flight_id FK, user_id, expires_at)
```

All tables use Row Level Security scoped to the Clerk user ID.

## Getting Started

### Prerequisites

- Node.js 18+
- Accounts: [Clerk](https://clerk.com/), [Supabase](https://supabase.com/), [Mapbox](https://www.mapbox.com/), [OpenSky Network](https://opensky-network.org/)

### Setup

```bash
git clone <repo-url>
cd dbs-assignment-3
npm install
```

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-supabase-anon-key>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
CLERK_SECRET_KEY=<your-clerk-secret-key>
OPENSKY_CLIENT_ID=<your-opensky-client-id>
OPENSKY_CLIENT_SECRET=<your-opensky-client-secret>
NEXT_PUBLIC_MAPBOX_TOKEN=<your-mapbox-public-token>
```

Run the SQL in `supabase-schema.sql` in your Supabase SQL editor to create the tables and RLS policies.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Design

Minimal black and white interface with monospace typography (Geist Mono). No color accents. Thin borders, generous whitespace, uppercase tracking labels. Inspired by Apple.com's navigation aesthetic.
