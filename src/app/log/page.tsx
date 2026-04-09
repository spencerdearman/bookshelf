"use client";

import { useState, useEffect } from "react";
import { useSession, useUser } from "@clerk/nextjs";
import { createClerkSupabaseClient, haversineNm } from "@/lib/supabase";
import { Search, Plane, Plus } from "lucide-react";

interface FlightResult {
  flight_number: string;
  departure_iata: string;
  departure_name: string;
  departure_lat: number;
  departure_lon: number;
  arrival_iata: string;
  arrival_name: string;
  arrival_lat: number;
  arrival_lon: number;
  scheduled_departure: string;
  scheduled_arrival: string;
  aircraft_type: string | null;
  airline_name: string | null;
}

export default function LogFlightPage() {
  const { session } = useSession();
  const { user } = useUser();
  const [flightNumber, setFlightNumber] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FlightResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");

  // Manual entry state
  const [manual, setManual] = useState(false);
  const [manualData, setManualData] = useState({
    flight_number: "",
    departure_iata: "",
    arrival_iata: "",
    date: "",
    aircraft_type: "",
    airline_name: "",
  });

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!flightNumber.trim() || !date) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch(
        `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(flightNumber.trim().toUpperCase())}/${date}`,
        {
          headers: {
            "x-rapidapi-host": "aerodatabox.p.rapidapi.com",
            "x-rapidapi-key": process.env.NEXT_PUBLIC_RAPID_API_KEY ?? "",
          },
        }
      );

      if (!res.ok) {
        if (res.status === 404) {
          setError("Flight not found. Try a different number or date, or add manually.");
        } else {
          throw new Error(`API error (${res.status})`);
        }
        return;
      }

      const data = await res.json();
      const flights: FlightResult[] = (Array.isArray(data) ? data : [data])
        .filter((f: Record<string, unknown>) => f.departure && f.arrival)
        .map((f: Record<string, Record<string, unknown>>) => ({
          flight_number: flightNumber.trim().toUpperCase(),
          departure_iata: (f.departure?.airport as Record<string, string>)?.iata ?? "",
          departure_name: (f.departure?.airport as Record<string, string>)?.name ?? "",
          departure_lat: (f.departure?.airport as Record<string, unknown>)?.lat as number ?? 0,
          departure_lon: (f.departure?.airport as Record<string, unknown>)?.lon as number ?? 0,
          arrival_iata: (f.arrival?.airport as Record<string, string>)?.iata ?? "",
          arrival_name: (f.arrival?.airport as Record<string, string>)?.name ?? "",
          arrival_lat: (f.arrival?.airport as Record<string, unknown>)?.lat as number ?? 0,
          arrival_lon: (f.arrival?.airport as Record<string, unknown>)?.lon as number ?? 0,
          scheduled_departure: (f.departure?.scheduledTime as Record<string, string>)?.utc ?? "",
          scheduled_arrival: (f.arrival?.scheduledTime as Record<string, string>)?.utc ?? "",
          aircraft_type: (f.aircraft as Record<string, string>)?.model ?? null,
          airline_name: (f.airline as Record<string, string>)?.name ?? null,
        }));

      if (flights.length === 0) {
        setError("No flight data found. Try adding manually.");
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

    // Ensure profile exists
    await supabase.from("profiles").upsert(
      { clerk_id: user.id },
      { onConflict: "clerk_id" }
    );

    const distance = Math.round(
      haversineNm(flight.departure_lat, flight.departure_lon, flight.arrival_lat, flight.arrival_lon)
    );

    const { error } = await supabase.from("flights").insert({
      user_id: user.id,
      flight_number: flight.flight_number,
      departure_iata: flight.departure_iata,
      arrival_iata: flight.arrival_iata,
      scheduled_departure: flight.scheduled_departure,
      scheduled_arrival: flight.scheduled_arrival,
      aircraft_type: flight.aircraft_type,
      airline_name: flight.airline_name,
      distance_nm: distance || null,
      notes: notes || null,
    });

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      setSaved((prev) => new Set(prev).add(flight.scheduled_departure));
    }
  }

  async function handleManualSave(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !user) return;
    if (!manualData.flight_number || !manualData.departure_iata || !manualData.arrival_iata || !manualData.date) return;

    const supabase = createClerkSupabaseClient(() =>
      session.getToken({ template: "supabase" })
    );

    await supabase.from("profiles").upsert(
      { clerk_id: user.id },
      { onConflict: "clerk_id" }
    );

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

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      setManualData({ flight_number: "", departure_iata: "", arrival_iata: "", date: "", aircraft_type: "", airline_name: "" });
      setNotes("");
      alert("Flight logged!");
    }
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-slate-400">Sign in to log flights.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Log a Flight
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Search by flight number or add manually.
        </p>

        {/* Toggle */}
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => setManual(false)}
            className={`rounded-xl px-4 py-2 text-xs font-medium transition-all duration-200 ${
              !manual
                ? "bg-blue-500 text-white"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <Search className="mr-1.5 inline h-3.5 w-3.5" />
            Search
          </button>
          <button
            onClick={() => setManual(true)}
            className={`rounded-xl px-4 py-2 text-xs font-medium transition-all duration-200 ${
              manual
                ? "bg-blue-500 text-white"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            <Plus className="mr-1.5 inline h-3.5 w-3.5" />
            Manual
          </button>
        </div>

        {!manual ? (
          <>
            <form onSubmit={handleSearch} className="mt-6 space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Flight Number</label>
                  <input
                    type="text"
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value)}
                    placeholder="UA123"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-500/50 focus:bg-white/[0.08]"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-all focus:border-blue-500/50 focus:bg-white/[0.08] [color-scheme:dark]"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Notes (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Window seat, great view of the Rockies..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-500/50 focus:bg-white/[0.08]"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !flightNumber.trim() || !date}
                className="w-full rounded-xl bg-blue-500 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-blue-400 disabled:opacity-40 disabled:hover:bg-blue-500"
              >
                {loading ? "Searching..." : "Search Flight"}
              </button>
            </form>

            {error && (
              <p className="mt-4 text-center text-sm text-red-400">{error}</p>
            )}

            {results.length > 0 && (
              <div className="mt-6 space-y-3">
                {results.map((flight, i) => (
                  <div key={i} className="glass flex items-center gap-4 rounded-2xl p-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                      <Plane className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-white">
                          {flight.flight_number}
                        </span>
                        {flight.airline_name && (
                          <span className="text-xs text-slate-500">{flight.airline_name}</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                        <span className="font-mono font-medium text-slate-300">{flight.departure_iata}</span>
                        <span className="text-slate-600">→</span>
                        <span className="font-mono font-medium text-slate-300">{flight.arrival_iata}</span>
                        {flight.aircraft_type && (
                          <>
                            <span className="text-slate-600">·</span>
                            <span>{flight.aircraft_type}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSaveFlight(flight)}
                      disabled={saved.has(flight.scheduled_departure)}
                      className="rounded-xl bg-blue-500 px-4 py-2 text-xs font-medium text-white transition-all duration-200 hover:bg-blue-400 disabled:bg-white/5 disabled:text-slate-500"
                    >
                      {saved.has(flight.scheduled_departure) ? "Logged" : "Add to Log"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleManualSave} className="mt-6 space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Flight Number</label>
                <input
                  type="text"
                  value={manualData.flight_number}
                  onChange={(e) => setManualData({ ...manualData, flight_number: e.target.value })}
                  placeholder="UA123"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-500/50 focus:bg-white/[0.08]"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Date</label>
                <input
                  type="date"
                  value={manualData.date}
                  onChange={(e) => setManualData({ ...manualData, date: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-all focus:border-blue-500/50 focus:bg-white/[0.08] [color-scheme:dark]"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-slate-400">From (IATA)</label>
                <input
                  type="text"
                  value={manualData.departure_iata}
                  onChange={(e) => setManualData({ ...manualData, departure_iata: e.target.value })}
                  placeholder="ORD"
                  maxLength={3}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-500/50 focus:bg-white/[0.08]"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-slate-400">To (IATA)</label>
                <input
                  type="text"
                  value={manualData.arrival_iata}
                  onChange={(e) => setManualData({ ...manualData, arrival_iata: e.target.value })}
                  placeholder="LAX"
                  maxLength={3}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-500/50 focus:bg-white/[0.08]"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Aircraft (optional)</label>
                <input
                  type="text"
                  value={manualData.aircraft_type}
                  onChange={(e) => setManualData({ ...manualData, aircraft_type: e.target.value })}
                  placeholder="Boeing 737-800"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-500/50 focus:bg-white/[0.08]"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Airline (optional)</label>
                <input
                  type="text"
                  value={manualData.airline_name}
                  onChange={(e) => setManualData({ ...manualData, airline_name: e.target.value })}
                  placeholder="United Airlines"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-500/50 focus:bg-white/[0.08]"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Window seat, great view of the Rockies..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-blue-500/50 focus:bg-white/[0.08]"
              />
            </div>
            <button
              type="submit"
              disabled={!manualData.flight_number || !manualData.departure_iata || !manualData.arrival_iata || !manualData.date}
              className="w-full rounded-xl bg-blue-500 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-blue-400 disabled:opacity-40 disabled:hover:bg-blue-500"
            >
              Log Flight
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
