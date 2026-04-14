"use client";

import { useState } from "react";
import { useSession, useUser } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";

interface FlightResult {
  icao24: string;
  callsign: string | null;
  estDepartureAirport: string | null;
  estArrivalAirport: string | null;
  firstSeen: number;
  lastSeen: number;
}

export default function LogFlightPage() {
  const { session } = useSession();
  const { user, isLoaded } = useUser();
  const [airport, setAirport] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FlightResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");

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
    if (!airport.trim() || !date) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch(
        `/api/flights/search?airport=${encodeURIComponent(airport.trim().toUpperCase())}&date=${date}`
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `API error (${res.status})`);
      }

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

    await supabase.from("profiles").upsert(
      { clerk_id: user.id },
      { onConflict: "clerk_id" }
    );

    const departure = new Date(flight.firstSeen * 1000).toISOString();
    const arrival = new Date(flight.lastSeen * 1000).toISOString();

    const { error } = await supabase.from("flights").insert({
      user_id: user.id,
      flight_number: (flight.callsign ?? "").trim(),
      departure_iata: flight.estDepartureAirport ?? "",
      arrival_iata: flight.estArrivalAirport ?? "",
      scheduled_departure: departure,
      scheduled_arrival: arrival,
      notes: notes || null,
    });

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      const key = `${flight.icao24}-${flight.firstSeen}`;
      setSaved((prev) => new Set(prev).add(key));
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

  if (!isLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-[14px] text-[#86868b]">Sign in to log flights.</p>
      </div>
    );
  }

  const inputClass =
    "w-full border-b border-[#e5e5e5] bg-transparent py-2.5 font-mono text-[14px] text-[#1d1d1f] outline-none transition-colors placeholder:text-[#c7c7cc] focus:border-[#1d1d1f]";

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-[520px] px-5 py-10">
        <h1 className="font-mono text-[22px] font-bold tracking-tight text-[#1d1d1f]">
          Log Flight
        </h1>

        {/* Toggle */}
        <div className="mt-6 flex gap-px border border-[#e5e5e5]">
          <button
            onClick={() => setManual(false)}
            className={`flex-1 py-2 font-mono text-[11px] font-medium tracking-wider transition-colors ${
              !manual
                ? "bg-[#1d1d1f] text-white"
                : "bg-white text-[#86868b] hover:text-[#1d1d1f]"
            }`}
          >
            SEARCH
          </button>
          <button
            onClick={() => setManual(true)}
            className={`flex-1 py-2 font-mono text-[11px] font-medium tracking-wider transition-colors ${
              manual
                ? "bg-[#1d1d1f] text-white"
                : "bg-white text-[#86868b] hover:text-[#1d1d1f]"
            }`}
          >
            MANUAL
          </button>
        </div>

        {!manual ? (
          <>
            <form onSubmit={handleSearch} className="mt-8 space-y-6">
              <div className="flex gap-6">
                <div className="flex-1">
                  <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">AIRPORT</label>
                  <input
                    type="text"
                    value={airport}
                    onChange={(e) => setAirport(e.target.value)}
                    placeholder="IAD"
                    maxLength={4}
                    className={inputClass}
                  />
                </div>
                <div className="flex-1">
                  <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">DATE</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">NOTES</label>
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

            {results.length > 0 && (
              <div className="mt-8">
                <p className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                  {results.length} RESULTS
                </p>
                <div className="mt-3 border-t border-[#e5e5e5]">
                  {results.map((flight) => {
                    const key = `${flight.icao24}-${flight.firstSeen}`;
                    const depTime = new Date(flight.firstSeen * 1000);
                    const arrTime = new Date(flight.lastSeen * 1000);
                    const hasArrival = !!flight.estArrivalAirport;
                    return (
                      <div key={key} className="flex items-center gap-4 border-b border-[#e5e5e5] py-3.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono text-[14px] font-semibold text-[#1d1d1f]">
                              {(flight.callsign ?? "").trim() || flight.icao24}
                            </span>
                            {!hasArrival && (
                              <span className="font-mono text-[10px] tracking-wider text-[#86868b]">
                                EN ROUTE
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 font-mono text-[12px] text-[#86868b]">
                            {flight.estDepartureAirport}
                            {" \u2192 "}
                            {hasArrival ? flight.estArrivalAirport : "\u2014"}
                            {" \u00B7 "}
                            {depTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                            {"\u2013"}
                            {arrTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
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
            )}
          </>
        ) : (
          <form onSubmit={handleManualSave} className="mt-8 space-y-6">
            <div className="flex gap-6">
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">FLIGHT</label>
                <input
                  type="text"
                  value={manualData.flight_number}
                  onChange={(e) => setManualData({ ...manualData, flight_number: e.target.value })}
                  placeholder="UA123"
                  className={inputClass}
                />
              </div>
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">DATE</label>
                <input
                  type="date"
                  value={manualData.date}
                  onChange={(e) => setManualData({ ...manualData, date: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">FROM</label>
                <input
                  type="text"
                  value={manualData.departure_iata}
                  onChange={(e) => setManualData({ ...manualData, departure_iata: e.target.value })}
                  placeholder="IAD"
                  maxLength={4}
                  className={inputClass}
                />
              </div>
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">TO</label>
                <input
                  type="text"
                  value={manualData.arrival_iata}
                  onChange={(e) => setManualData({ ...manualData, arrival_iata: e.target.value })}
                  placeholder="LAX"
                  maxLength={4}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">AIRCRAFT</label>
                <input
                  type="text"
                  value={manualData.aircraft_type}
                  onChange={(e) => setManualData({ ...manualData, aircraft_type: e.target.value })}
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
              <div className="flex-1">
                <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">AIRLINE</label>
                <input
                  type="text"
                  value={manualData.airline_name}
                  onChange={(e) => setManualData({ ...manualData, airline_name: e.target.value })}
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">NOTES</label>
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
              disabled={!manualData.flight_number || !manualData.departure_iata || !manualData.arrival_iata || !manualData.date}
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
