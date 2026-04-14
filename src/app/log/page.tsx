"use client";

import { useState, useCallback } from "react";
import { useSession, useUser } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import FlightMap from "@/components/FlightMap";

interface FlightResult {
  callsign: string;
  fa_flight_id: string;
  origin_iata: string;
  origin_city: string;
  dest_iata: string;
  dest_city: string;
  aircraft_type: string | null;
  status: string | null;
  progress_percent: number | null;
  route_distance: number | null;
  gate_origin: string | null;
  gate_destination: string | null;
  terminal_origin: string | null;
  scheduled_out: string | null;
  actual_out: string | null;
  scheduled_in: string | null;
  actual_in: string | null;
}

type Tab = "search" | "track" | "manual";

export default function LogFlightPage() {
  const { session } = useSession();
  const { user, isLoaded } = useUser();
  const [tab, setTab] = useState<Tab>("search");

  // Search state
  const [airport, setAirport] = useState("");
  const [destFilter, setDestFilter] = useState("");
  const [airlineFilter, setAirlineFilter] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FlightResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());

  // Track state
  const [trackAirline, setTrackAirline] = useState("");
  const [trackNumber, setTrackNumber] = useState("");
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackResult, setTrackResult] = useState<Record<string, unknown> | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  // Manual state
  const [manualData, setManualData] = useState({
    flight_number: "", departure_iata: "", arrival_iata: "", date: "",
    aircraft_type: "", airline_name: "",
  });
  const [notes, setNotes] = useState("");

  // --- Search ---
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const origin = airport.trim().toUpperCase();
    const dest = destFilter.trim().toUpperCase();
    if ((!origin && !dest) || !date) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const params = new URLSearchParams({ airport: origin || dest, date });
      if (dest && origin) params.set("dest", dest);
      if (airlineFilter.trim()) params.set("airline", airlineFilter.trim());

      const res = await fetch(`/api/flights/search?${params}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `Error (${res.status})`);

      const flights: FlightResult[] = data.flights ?? [];
      if (flights.length === 0) {
        setError(data.error || data.message || "No flights found. Try a different date or adjust your filters.");
      } else {
        setResults(flights);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  // --- Save from search ---
  const handleSaveFlight = useCallback(async (flight: FlightResult) => {
    if (!session || !user) return;
    const key = flight.fa_flight_id || flight.callsign;
    setSaving((prev) => new Set(prev).add(key));

    try {
      const supabase = createClerkSupabaseClient(() =>
        session.getToken({ template: "supabase" })
      );
      await supabase.from("profiles").upsert({ clerk_id: user.id }, { onConflict: "clerk_id" });

      const { error } = await supabase.from("flights").insert({
        user_id: user.id,
        flight_number: flight.callsign,
        departure_iata: flight.origin_iata,
        arrival_iata: flight.dest_iata,
        scheduled_departure: flight.actual_out || flight.scheduled_out || new Date().toISOString(),
        scheduled_arrival: flight.actual_in || flight.scheduled_in || null,
        aircraft_type: flight.aircraft_type,
      });

      if (error) {
        alert(`Error: ${error.message}`);
      } else {
        setSaved((prev) => new Set(prev).add(key));
      }
    } finally {
      setSaving((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }
  }, [session, user]);

  // --- Track ---
  async function handleTrack(e: React.FormEvent) {
    e.preventDefault();
    const flight = `${trackAirline.trim()}${trackNumber.trim()}`;
    if (!flight) return;
    setTrackLoading(true);
    setTrackError(null);
    setTrackResult(null);
    try {
      const res = await fetch(`/api/flights/track?flight=${encodeURIComponent(flight)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error (${res.status})`);
      setTrackResult(data);
    } catch (err) {
      setTrackError(err instanceof Error ? err.message : "Tracking failed.");
    } finally {
      setTrackLoading(false);
    }
  }

  async function handleSaveTracked() {
    if (!session || !user || !trackResult) return;
    const supabase = createClerkSupabaseClient(() =>
      session.getToken({ template: "supabase" })
    );
    await supabase.from("profiles").upsert({ clerk_id: user.id }, { onConflict: "clerk_id" });
    const { error } = await supabase.from("flights").insert({
      user_id: user.id,
      flight_number: String(trackResult.callsign ?? ""),
      departure_iata: String(trackResult.origin ?? ""),
      arrival_iata: String(trackResult.destination ?? ""),
      scheduled_departure: new Date().toISOString(),
      aircraft_type: trackResult.aircraft ? String(trackResult.aircraft) : null,
    });
    if (error) alert(`Error: ${error.message}`);
    else alert("Flight saved to logbook!");
  }

  // --- Manual ---
  async function handleManualSave(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !user) return;
    if (!manualData.flight_number || !manualData.departure_iata || !manualData.arrival_iata || !manualData.date) return;
    const supabase = createClerkSupabaseClient(() =>
      session.getToken({ template: "supabase" })
    );
    await supabase.from("profiles").upsert({ clerk_id: user.id }, { onConflict: "clerk_id" });
    const { error } = await supabase.from("flights").insert({
      user_id: user.id,
      flight_number: manualData.flight_number.toUpperCase(),
      departure_iata: manualData.departure_iata.toUpperCase(),
      arrival_iata: manualData.arrival_iata.toUpperCase(),
      scheduled_departure: new Date(manualData.date).toISOString(),
      aircraft_type: manualData.aircraft_type || null,
      airline_name: manualData.airline_name || null,
      notes: notes || null,
    });
    if (error) alert(`Error: ${error.message}`);
    else {
      setManualData({ flight_number: "", departure_iata: "", arrival_iata: "", date: "", aircraft_type: "", airline_name: "" });
      setNotes("");
      alert("Flight logged!");
    }
  }

  if (!isLoaded || !session) {
    return <div className="flex flex-1 items-center justify-center"><div className="spinner" /></div>;
  }

  const inputClass = "w-full border-b border-[#e5e5e5] bg-transparent py-2.5 font-mono text-[14px] text-[#1d1d1f] outline-none transition-colors placeholder:text-[#c7c7cc] focus:border-[#1d1d1f]";

  const tabs: { key: Tab; label: string }[] = [
    { key: "search", label: "SEARCH" },
    { key: "track", label: "TRACK" },
    { key: "manual", label: "MANUAL" },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-[520px] px-5 py-10">
        <h1 className="font-mono text-[22px] font-bold tracking-tight text-[#1d1d1f]">Search Flights</h1>

        <div className="mt-6 flex gap-px border border-[#e5e5e5]">
          {tabs.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2 font-mono text-[11px] font-medium tracking-wider transition-colors ${tab === key ? "bg-[#1d1d1f] text-white" : "bg-white text-[#86868b] hover:text-[#1d1d1f]"}`}
            >{label}</button>
          ))}
        </div>

        {/* ── SEARCH TAB ── */}
        {tab === "search" && (
          <>
            <form onSubmit={handleSearch} className="mt-8 space-y-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">ORIGIN</label>
                  <input type="text" value={airport} onChange={(e) => setAirport(e.target.value)} placeholder="IAD" maxLength={4} className={inputClass} />
                </div>
                <div className="flex-1">
                  <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">DEST</label>
                  <input type="text" value={destFilter} onChange={(e) => setDestFilter(e.target.value)} placeholder="Any" maxLength={4} className={inputClass} />
                </div>
                <div className="flex-1">
                  <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">DATE</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
                </div>
                <div className="w-16">
                  <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">AIRLINE</label>
                  <input type="text" value={airlineFilter} onChange={(e) => setAirlineFilter(e.target.value)} placeholder="UA" maxLength={3} className={inputClass} />
                </div>
              </div>
              <button type="submit" disabled={loading || (!airport.trim() && !destFilter.trim()) || !date}
                className={`w-full py-3 font-mono text-[12px] font-medium tracking-wider text-white transition-opacity hover:opacity-80 disabled:opacity-30 ${loading ? "search-loading" : "bg-[#1d1d1f]"}`}
              >{loading ? "SEARCHING..." : "SEARCH"}</button>
            </form>

            {error && <p className="mt-6 font-mono text-[12px] text-[#86868b]">{error}</p>}

            {results.length > 0 && (
              <div className="mt-8">
                <p className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">{results.length} RESULTS</p>
                <div className="mt-3 border-t border-[#e5e5e5]">
                  {results.map((flight) => {
                    const key = flight.fa_flight_id || flight.callsign;
                    const depTime = flight.actual_out || flight.scheduled_out;
                    return (
                      <div key={key} className="flex items-center gap-4 border-b border-[#e5e5e5] py-3.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono text-[14px] font-semibold text-[#1d1d1f]">{flight.callsign}</span>
                            {flight.aircraft_type && <span className="text-[11px] text-[#aeaeb2]">{flight.aircraft_type}</span>}
                          </div>
                          <div className="mt-0.5 font-mono text-[12px] text-[#86868b]">
                            <span className="text-[#1d1d1f]">{flight.origin_iata}</span>
                            {" \u2192 "}
                            <span className="text-[#1d1d1f]">{flight.dest_iata}</span>
                            {flight.gate_origin && ` \u00B7 Gate ${flight.gate_origin}`}
                            {depTime && ` \u00B7 ${new Date(depTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`}
                          </div>
                          {flight.status && (
                            <p className="mt-0.5 font-mono text-[10px] text-[#aeaeb2]">{flight.status}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleSaveFlight(flight)}
                          disabled={saved.has(key) || saving.has(key)}
                          className={`font-mono text-[11px] font-medium tracking-wider transition-opacity ${
                            saved.has(key) ? "text-[#c7c7cc]" : saving.has(key) ? "text-[#86868b]" : "text-[#1d1d1f] underline underline-offset-2 hover:opacity-60"
                          }`}
                        >{saved.has(key) ? "ADDED" : saving.has(key) ? "SAVING..." : "ADD"}</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── TRACK TAB ── */}
        {tab === "track" && (
          <>
            <form onSubmit={handleTrack} className="mt-8 space-y-6">
              <div className="flex gap-4">
                <div className="w-24">
                  <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">AIRLINE</label>
                  <input type="text" value={trackAirline} onChange={(e) => setTrackAirline(e.target.value)} placeholder="UA" maxLength={3} className={inputClass} />
                </div>
                <div className="flex-1">
                  <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">FLIGHT NO.</label>
                  <input type="text" value={trackNumber} onChange={(e) => setTrackNumber(e.target.value)} placeholder="1764" maxLength={6} className={inputClass} />
                </div>
              </div>
              <button type="submit" disabled={trackLoading || (!trackAirline.trim() && !trackNumber.trim())}
                className="w-full bg-[#1d1d1f] py-3 font-mono text-[12px] font-medium tracking-wider text-white transition-opacity hover:opacity-80 disabled:opacity-30"
              >{trackLoading ? "TRACKING..." : "TRACK FLIGHT"}</button>
            </form>

            {trackError && <p className="mt-4 font-mono text-[12px] text-[#86868b]">{trackError}</p>}

            {trackResult && (
              <div className="mt-6 border border-[#e5e5e5] bg-white p-5">
                {trackResult.callsign ? (
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[18px] font-bold text-[#1d1d1f]">{String(trackResult.callsign)}</span>
                    {trackResult.live ? (
                      <span className="bg-[#1d1d1f] px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest text-white">LIVE</span>
                    ) : null}
                  </div>
                ) : null}

                {trackResult.origin || trackResult.destination ? (
                  <p className="mt-2 font-mono text-[13px] text-[#86868b]">
                    {String(trackResult.origin || "?")} {"\u2192"} {String(trackResult.destination || "?")}
                    {trackResult.aircraft ? <span className="ml-2 text-[11px] text-[#aeaeb2]">{String(trackResult.aircraft)}</span> : null}
                  </p>
                ) : null}

                {trackResult.live ? (
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    {[
                      { label: "ALT", value: trackResult.altitude_ft != null ? `${(trackResult.altitude_ft as number).toLocaleString()} ft` : "\u2014" },
                      { label: "SPD", value: trackResult.speed_knots != null ? `${trackResult.speed_knots} kts` : "\u2014" },
                      { label: "HDG", value: trackResult.heading != null ? `${trackResult.heading}\u00B0` : "\u2014" },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">{label}</p>
                        <p className="mt-0.5 font-mono text-[14px] font-semibold text-[#1d1d1f]">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : trackResult.message ? (
                  <p className="mt-2 font-mono text-[12px] text-[#aeaeb2]">{String(trackResult.message)}</p>
                ) : null}

                {trackResult.latitude != null && trackResult.longitude != null && (
                  <p className="mt-3 font-mono text-[11px] text-[#aeaeb2]">
                    {(trackResult.latitude as number).toFixed(4)}, {(trackResult.longitude as number).toFixed(4)}
                  </p>
                )}

                <button onClick={handleSaveTracked}
                  className="mt-4 w-full border border-[#e5e5e5] bg-white py-2.5 font-mono text-[11px] font-medium tracking-wider text-[#1d1d1f] transition-colors hover:bg-[#fafafa]"
                >ADD TO LOGBOOK</button>
              </div>
            )}
          </>
        )}

        {/* ── MANUAL TAB ── */}
        {tab === "manual" && (
          <form onSubmit={handleManualSave} className="mt-8 space-y-6">
            <div className="flex gap-6">
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">FLIGHT</label>
                <input type="text" value={manualData.flight_number} onChange={(e) => setManualData({ ...manualData, flight_number: e.target.value })} placeholder="UA123" className={inputClass} />
              </div>
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">DATE</label>
                <input type="date" value={manualData.date} onChange={(e) => setManualData({ ...manualData, date: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">FROM</label>
                <input type="text" value={manualData.departure_iata} onChange={(e) => setManualData({ ...manualData, departure_iata: e.target.value })} placeholder="IAD" maxLength={4} className={inputClass} />
              </div>
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">TO</label>
                <input type="text" value={manualData.arrival_iata} onChange={(e) => setManualData({ ...manualData, arrival_iata: e.target.value })} placeholder="LAX" maxLength={4} className={inputClass} />
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">AIRCRAFT</label>
                <input type="text" value={manualData.aircraft_type} onChange={(e) => setManualData({ ...manualData, aircraft_type: e.target.value })} placeholder="Optional" className={inputClass} />
              </div>
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">AIRLINE</label>
                <input type="text" value={manualData.airline_name} onChange={(e) => setManualData({ ...manualData, airline_name: e.target.value })} placeholder="Optional" className={inputClass} />
              </div>
            </div>
            <div>
              <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">NOTES</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className={inputClass} />
            </div>
            <button type="submit" disabled={!manualData.flight_number || !manualData.departure_iata || !manualData.arrival_iata || !manualData.date}
              className="w-full bg-[#1d1d1f] py-3 font-mono text-[12px] font-medium tracking-wider text-white transition-opacity hover:opacity-80 disabled:opacity-30"
            >LOG FLIGHT</button>
          </form>
        )}
      </main>
    </div>
  );
}
