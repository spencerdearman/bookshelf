"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, useUser } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import FlightMap from "@/components/FlightMap";

interface EnrichedData {
  arrival_iata?: string;
  aircraft_type?: string;
  aircraft_friendly?: string;
  loading?: boolean;
}

interface FlightResult {
  icao24: string;
  callsign: string | null;
  estDepartureAirport: string | null;
  estArrivalAirport: string | null;
  firstSeen: number;
  lastSeen: number;
}

type Tab = "search" | "track" | "manual";

/** Convert ICAO code to IATA: KIAD → IAD, EGLL stays EGLL. */
function toIata(code: string): string {
  const c = code.toUpperCase().trim();
  // US airports: strip K prefix (KIAD → IAD, KJFK → JFK)
  if (c.length === 4 && c.startsWith("K")) return c.slice(1);
  return c;
}

export default function LogFlightPage() {
  const { session } = useSession();
  const { user, isLoaded } = useUser();
  const [tab, setTab] = useState<Tab>("search");

  // Search state
  const [airport, setAirport] = useState("");
  const [destFilter, setDestFilter] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FlightResult[]>([]);
  const [enriched, setEnriched] = useState<Map<string, EnrichedData>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");

  // Track state
  const [trackAirline, setTrackAirline] = useState("");
  const [trackNumber, setTrackNumber] = useState("");
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackResult, setTrackResult] = useState<Record<string, unknown> | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  // Manual state
  const [manualData, setManualData] = useState({
    flight_number: "",
    departure_iata: "",
    arrival_iata: "",
    date: "",
    aircraft_type: "",
    airline_name: "",
    gate: "",
    terminal: "",
  });

  // --- Auto-enrich results missing destinations ---
  const enrichFlights = useCallback(async (flights: FlightResult[]) => {
    const toEnrich = flights.filter(
      (f) => !f.estArrivalAirport && f.callsign?.trim()
    );
    // Deduplicate by callsign
    const seen = new Set<string>();
    const unique = toEnrich.filter((f) => {
      const cs = f.callsign!.trim();
      if (seen.has(cs)) return false;
      seen.add(cs);
      return true;
    });

    // Mark as loading
    const init = new Map<string, EnrichedData>();
    for (const f of unique) {
      init.set(f.callsign!.trim(), { loading: true });
    }
    setEnriched(new Map(init));

    // Enrich sequentially (avoid hammering FlightAware)
    const updated = new Map(init);
    for (const f of unique.slice(0, 20)) {
      const cs = f.callsign!.trim();
      try {
        const params = new URLSearchParams({ callsign: cs });
        if (f.estDepartureAirport) params.set("departure_icao", f.estDepartureAirport);
        const res = await fetch(`/api/flights/refresh?${params}`);
        const data = await res.json();
        updated.set(cs, {
          arrival_iata: data.arrival_iata || undefined,
          aircraft_type: data.aircraft_type || undefined,
          aircraft_friendly: data.aircraft_friendly || undefined,
          loading: false,
        });
      } catch {
        updated.set(cs, { loading: false });
      }
      setEnriched(new Map(updated));
    }
  }, []);

  useEffect(() => {
    if (results.length > 0 && results.some((r) => !r.estArrivalAirport)) {
      enrichFlights(results);
    }
  }, [results]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Search by airport ---
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!airport.trim() || !date) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setEnriched(new Map());

    try {
      const res = await fetch(
        `/api/flights/search?airport=${encodeURIComponent(airport.trim().toUpperCase())}&date=${date}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error (${res.status})`);

      const flights: FlightResult[] = (data.flights ?? []).filter(
        (f: FlightResult) => f.callsign?.trim()
      );

      if (flights.length === 0) {
        setError("No flights found. Try a different date or add manually.");
      } else {
        setResults(flights);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveFlight(flight: FlightResult) {
    if (!session || !user) return;

    const supabase = createClerkSupabaseClient(() =>
      session.getToken({ template: "supabase" })
    );

    await supabase
      .from("profiles")
      .upsert({ clerk_id: user.id }, { onConflict: "clerk_id" });

    const departure = new Date(flight.firstSeen * 1000).toISOString();
    const arrival = new Date(flight.lastSeen * 1000).toISOString();
    const callsign = (flight.callsign ?? "").trim();

    let arrivalIata = flight.estArrivalAirport ?? "";
    let aircraftType: string | null = null;

    // If destination is missing, try FlightAware
    if (!arrivalIata && callsign) {
      try {
        const params = new URLSearchParams({ callsign });
        if (flight.estDepartureAirport) {
          params.set("departure_icao", flight.estDepartureAirport);
        }
        const res = await fetch(`/api/flights/refresh?${params}`);
        const data = await res.json();
        if (data.arrival_iata) arrivalIata = data.arrival_iata;
        if (data.aircraft_type) aircraftType = data.aircraft_type;
      } catch {
        // proceed without destination
      }
    }

    const { error } = await supabase.from("flights").insert({
      user_id: user.id,
      flight_number: callsign,
      departure_iata: toIata(flight.estDepartureAirport ?? ""),
      arrival_iata: toIata(arrivalIata),
      scheduled_departure: departure,
      scheduled_arrival: arrival,
      aircraft_type: aircraftType,
      notes: notes || null,
    });

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      const key = `${flight.icao24}-${flight.firstSeen}`;
      setSaved((prev) => new Set(prev).add(key));
    }
  }

  // --- Track by flight number ---
  async function handleTrack(e: React.FormEvent) {
    e.preventDefault();
    const flight = `${trackAirline.trim()}${trackNumber.trim()}`;
    if (!flight) return;

    setTrackLoading(true);
    setTrackError(null);
    setTrackResult(null);

    try {
      const res = await fetch(
        `/api/flights/track?flight=${encodeURIComponent(flight)}`
      );
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
    if (!session || !user || !trackResult || !trackResult.live) return;

    const supabase = createClerkSupabaseClient(() =>
      session.getToken({ template: "supabase" })
    );

    await supabase
      .from("profiles")
      .upsert({ clerk_id: user.id }, { onConflict: "clerk_id" });

    const { error } = await supabase.from("flights").insert({
      user_id: user.id,
      flight_number: (trackResult.callsign as string) ?? "",
      departure_iata: "",
      arrival_iata: "",
      scheduled_departure: new Date().toISOString(),
      notes: notes || null,
    });

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      alert("Flight saved to logbook!");
    }
  }

  // --- Manual entry ---
  async function handleManualSave(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !user) return;
    if (
      !manualData.flight_number ||
      !manualData.departure_iata ||
      !manualData.arrival_iata ||
      !manualData.date
    )
      return;

    const supabase = createClerkSupabaseClient(() =>
      session.getToken({ template: "supabase" })
    );

    await supabase
      .from("profiles")
      .upsert({ clerk_id: user.id }, { onConflict: "clerk_id" });

    const { error } = await supabase.from("flights").insert({
      user_id: user.id,
      flight_number: manualData.flight_number.toUpperCase(),
      departure_iata: toIata(manualData.departure_iata),
      arrival_iata: toIata(manualData.arrival_iata),
      scheduled_departure: new Date(manualData.date).toISOString(),
      aircraft_type: manualData.aircraft_type || null,
      airline_name: manualData.airline_name || null,
      notes: notes || null,
    });

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      setManualData({
        flight_number: "",
        departure_iata: "",
        arrival_iata: "",
        date: "",
        aircraft_type: "",
        airline_name: "",
        gate: "",
        terminal: "",
      });
      setNotes("");
      alert("Flight logged!");
    }
  }

  if (!isLoaded || !session) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  const inputClass =
    "w-full border-b border-[#e5e5e5] bg-transparent py-2.5 font-mono text-[14px] text-[#1d1d1f] outline-none transition-colors placeholder:text-[#c7c7cc] focus:border-[#1d1d1f]";

  const tabs: { key: Tab; label: string }[] = [
    { key: "search", label: "SEARCH" },
    { key: "track", label: "TRACK" },
    { key: "manual", label: "MANUAL" },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-[520px] px-5 py-10">
        <h1 className="font-mono text-[22px] font-bold tracking-tight text-[#1d1d1f]">
          Log Flight
        </h1>

        {/* Tabs */}
        <div className="mt-6 flex gap-px border border-[#e5e5e5]">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2 font-mono text-[11px] font-medium tracking-wider transition-colors ${
                tab === key
                  ? "bg-[#1d1d1f] text-white"
                  : "bg-white text-[#86868b] hover:text-[#1d1d1f]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search tab */}
        {tab === "search" && (
          <>
            <form onSubmit={handleSearch} className="mt-8 space-y-6">
              <div className="flex gap-6">
                <div className="flex-1">
                  <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                    ORIGIN
                  </label>
                  <input
                    type="text"
                    value={airport}
                    onChange={(e) => setAirport(e.target.value)}
                    placeholder="IAD"
                    maxLength={4}
                    className={inputClass}
                  />
                </div>
                <div className="w-20">
                  <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                    DEST
                  </label>
                  <input
                    type="text"
                    value={destFilter}
                    onChange={(e) => setDestFilter(e.target.value)}
                    placeholder="Any"
                    maxLength={4}
                    className={inputClass}
                  />
                </div>
                <div className="flex-1">
                  <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                    DATE
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                  NOTES
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !airport.trim() || !date}
                className="w-full bg-[#1d1d1f] py-3 font-mono text-[12px] font-medium tracking-wider text-white transition-opacity hover:opacity-80 disabled:opacity-30"
              >
                {loading ? "SEARCHING..." : "SEARCH"}
              </button>
            </form>

            {error && (
              <p className="mt-6 font-mono text-[12px] text-[#86868b]">{error}</p>
            )}

            {results.length > 0 && (() => {
              const df = destFilter.toUpperCase().trim();
              const filtered = df
                ? results.filter((f) => {
                    const arrDirect = toIata(f.estArrivalAirport ?? "");
                    const cs = (f.callsign ?? "").trim();
                    const arrEnriched = cs ? toIata(enriched.get(cs)?.arrival_iata ?? "") : "";
                    return arrDirect === df || arrEnriched === df;
                  })
                : results;
              return (
              <div className="mt-8">
                <p className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                  {filtered.length} RESULTS{df ? ` TO ${df}` : ""}
                </p>
                <div className="mt-3 border-t border-[#e5e5e5]">
                  {filtered.map((flight) => {
                    const key = `${flight.icao24}-${flight.firstSeen}`;
                    const cs = (flight.callsign ?? "").trim();
                    const depTime = new Date(flight.firstSeen * 1000);
                    const arrTime = new Date(flight.lastSeen * 1000);
                    const extra = cs ? enriched.get(cs) : undefined;
                    const dest = flight.estArrivalAirport || extra?.arrival_iata;
                    const acType = extra?.aircraft_friendly || extra?.aircraft_type;
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-4 border-b border-[#e5e5e5] py-3.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono text-[14px] font-semibold text-[#1d1d1f]">
                              {cs || flight.icao24}
                            </span>
                            {acType && (
                              <span className="text-[11px] text-[#aeaeb2]">{acType}</span>
                            )}
                          </div>
                          <div className="mt-0.5 font-mono text-[12px] text-[#86868b]">
                            {toIata(flight.estDepartureAirport ?? "")}
                            {" \u2192 "}
                            {dest ? (
                              <span className="text-[#1d1d1f]">{toIata(dest)}</span>
                            ) : extra?.loading ? (
                              <span className="text-[#c7c7cc]">loading...</span>
                            ) : (
                              "\u2014"
                            )}
                            {" \u00B7 "}
                            {depTime.toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                            {"\u2013"}
                            {arrTime.toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </div>
                        </div>
                        <button
                          onClick={() => handleSaveFlight(flight)}
                          disabled={saved.has(key)}
                          className={`font-mono text-[11px] font-medium tracking-wider transition-opacity ${
                            saved.has(key)
                              ? "text-[#c7c7cc]"
                              : "text-[#1d1d1f] underline underline-offset-2 hover:opacity-60"
                          }`}
                        >
                          {saved.has(key) ? "ADDED" : "ADD"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })()}
          </>
        )}

        {/* Track tab */}
        {tab === "track" && (
          <>
            <form onSubmit={handleTrack} className="mt-8 space-y-6">
              <div className="flex gap-4">
                <div className="w-24">
                  <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                    AIRLINE
                  </label>
                  <input
                    type="text"
                    value={trackAirline}
                    onChange={(e) => setTrackAirline(e.target.value)}
                    placeholder="UA"
                    maxLength={3}
                    className={inputClass}
                  />
                </div>
                <div className="flex-1">
                  <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                    FLIGHT NO.
                  </label>
                  <input
                    type="text"
                    value={trackNumber}
                    onChange={(e) => setTrackNumber(e.target.value)}
                    placeholder="1764"
                    maxLength={6}
                    className={inputClass}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={
                  trackLoading ||
                  (!trackAirline.trim() && !trackNumber.trim())
                }
                className="w-full bg-[#1d1d1f] py-3 font-mono text-[12px] font-medium tracking-wider text-white transition-opacity hover:opacity-80 disabled:opacity-30"
              >
                {trackLoading ? "TRACKING..." : "TRACK FLIGHT"}
              </button>
            </form>

            {trackError && (
              <p className="mt-4 font-mono text-[12px] text-[#86868b]">
                {trackError}
              </p>
            )}

            {trackResult && (
              <div className="mt-6 border border-[#e5e5e5] bg-white p-5">
                {trackResult.live ? (
                  <>
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-[18px] font-bold text-[#1d1d1f]">
                        {trackResult.callsign as string}
                      </span>
                      <span className="bg-[#1d1d1f] px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest text-white">
                        LIVE
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {[
                        {
                          label: "ALT",
                          value:
                            trackResult.altitude_ft != null
                              ? `${(trackResult.altitude_ft as number).toLocaleString()} ft`
                              : "\u2014",
                        },
                        {
                          label: "SPD",
                          value:
                            trackResult.speed_knots != null
                              ? `${trackResult.speed_knots} kts`
                              : "\u2014",
                        },
                        {
                          label: "HDG",
                          value:
                            trackResult.heading != null
                              ? `${trackResult.heading}\u00B0`
                              : "\u2014",
                        },
                        {
                          label: "V/S",
                          value:
                            trackResult.vertical_rate_fpm != null
                              ? `${(trackResult.vertical_rate_fpm as number) > 0 ? "+" : ""}${trackResult.vertical_rate_fpm} fpm`
                              : "\u2014",
                        },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                            {label}
                          </p>
                          <p className="mt-0.5 font-mono text-[14px] font-semibold text-[#1d1d1f]">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Mini map */}
                    {trackResult.latitude != null &&
                      trackResult.longitude != null && (
                        <div className="mt-4 h-[200px] border border-[#e5e5e5]">
                          <FlightMap
                            aircraft={{
                              lat: trackResult.latitude as number,
                              lng: trackResult.longitude as number,
                            }}
                          />
                        </div>
                      )}

                    <button
                      onClick={handleSaveTracked}
                      className="mt-4 w-full border border-[#e5e5e5] bg-white py-2.5 font-mono text-[11px] font-medium tracking-wider text-[#1d1d1f] transition-colors hover:bg-[#fafafa]"
                    >
                      SAVE TO LOGBOOK
                    </button>
                  </>
                ) : (
                  <p className="font-mono text-[13px] text-[#86868b]">
                    {(trackResult.message as string) ||
                      "Flight not currently airborne."}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* Manual tab */}
        {tab === "manual" && (
          <form onSubmit={handleManualSave} className="mt-8 space-y-6">
            <div className="flex gap-6">
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                  FLIGHT
                </label>
                <input
                  type="text"
                  value={manualData.flight_number}
                  onChange={(e) =>
                    setManualData({ ...manualData, flight_number: e.target.value })
                  }
                  placeholder="UA123"
                  className={inputClass}
                />
              </div>
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                  DATE
                </label>
                <input
                  type="date"
                  value={manualData.date}
                  onChange={(e) =>
                    setManualData({ ...manualData, date: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                  FROM
                </label>
                <input
                  type="text"
                  value={manualData.departure_iata}
                  onChange={(e) =>
                    setManualData({ ...manualData, departure_iata: e.target.value })
                  }
                  placeholder="IAD"
                  maxLength={4}
                  className={inputClass}
                />
              </div>
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                  TO
                </label>
                <input
                  type="text"
                  value={manualData.arrival_iata}
                  onChange={(e) =>
                    setManualData({ ...manualData, arrival_iata: e.target.value })
                  }
                  placeholder="LAX"
                  maxLength={4}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                  AIRCRAFT
                </label>
                <input
                  type="text"
                  value={manualData.aircraft_type}
                  onChange={(e) =>
                    setManualData({ ...manualData, aircraft_type: e.target.value })
                  }
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                  AIRLINE
                </label>
                <input
                  type="text"
                  value={manualData.airline_name}
                  onChange={(e) =>
                    setManualData({ ...manualData, airline_name: e.target.value })
                  }
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                  TERMINAL
                </label>
                <input
                  type="text"
                  value={manualData.terminal}
                  onChange={(e) =>
                    setManualData({ ...manualData, terminal: e.target.value })
                  }
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                  GATE
                </label>
                <input
                  type="text"
                  value={manualData.gate}
                  onChange={(e) =>
                    setManualData({ ...manualData, gate: e.target.value })
                  }
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                NOTES
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={
                !manualData.flight_number ||
                !manualData.departure_iata ||
                !manualData.arrival_iata ||
                !manualData.date
              }
              className="w-full bg-[#1d1d1f] py-3 font-mono text-[12px] font-medium tracking-wider text-white transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              LOG FLIGHT
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
