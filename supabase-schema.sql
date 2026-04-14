-- Vector: Flight Tracking App — Supabase Schema
-- Run this in the Supabase SQL editor.

-- 1. Profiles
CREATE TABLE IF NOT EXISTS profiles (
  clerk_id   TEXT PRIMARY KEY,
  home_airport TEXT,
  total_miles  NUMERIC DEFAULT 0,
  total_flights INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_read_own"  ON profiles FOR SELECT USING (clerk_id = auth.jwt()->>'sub');
CREATE POLICY "profiles_write_own" ON profiles FOR INSERT WITH CHECK (clerk_id = auth.jwt()->>'sub');
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (clerk_id = auth.jwt()->>'sub');
-- Public leaderboard read
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT USING (true);

-- 2. Flights
CREATE TABLE IF NOT EXISTS flights (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             TEXT NOT NULL,
  flight_number       TEXT NOT NULL,
  airline_code        TEXT,
  departure_iata      TEXT NOT NULL,
  arrival_iata        TEXT NOT NULL,
  scheduled_departure TIMESTAMPTZ NOT NULL,
  scheduled_arrival   TIMESTAMPTZ,
  actual_departure    TIMESTAMPTZ,
  actual_arrival      TIMESTAMPTZ,
  tail_number         TEXT,
  status              TEXT DEFAULT 'scheduled',
  gate                TEXT,
  terminal            TEXT,
  aircraft_type       TEXT,
  airline_name        TEXT,
  distance_nm         NUMERIC,
  notes               TEXT,
  icao24              TEXT,
  dep_lat             DOUBLE PRECISION,
  dep_lng             DOUBLE PRECISION,
  arr_lat             DOUBLE PRECISION,
  arr_lng             DOUBLE PRECISION,
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE flights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flights_read_own"   ON flights FOR SELECT USING (user_id = auth.jwt()->>'sub');
CREATE POLICY "flights_insert_own" ON flights FOR INSERT WITH CHECK (user_id = auth.jwt()->>'sub');
CREATE POLICY "flights_update_own" ON flights FOR UPDATE USING (user_id = auth.jwt()->>'sub');
CREATE POLICY "flights_delete_own" ON flights FOR DELETE USING (user_id = auth.jwt()->>'sub');

-- 3. Share Links
CREATE TABLE IF NOT EXISTS share_links (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flight_id  UUID NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
);

ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "share_links_owner"  ON share_links FOR ALL USING (user_id = auth.jwt()->>'sub');
-- Allow public read so shared pages work without auth
CREATE POLICY "share_links_public_read" ON share_links FOR SELECT USING (true);
-- Allow public read of flights via share link
CREATE POLICY "flights_shared_read" ON flights FOR SELECT
  USING (
    id IN (
      SELECT flight_id FROM share_links
      WHERE (expires_at IS NULL OR expires_at > now())
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_flights_user   ON flights(user_id);
CREATE INDEX IF NOT EXISTS idx_flights_depart ON flights(scheduled_departure);
CREATE INDEX IF NOT EXISTS idx_share_flight   ON share_links(flight_id);
