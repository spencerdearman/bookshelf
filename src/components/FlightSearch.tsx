"use client";

import { useState } from "react";

interface LiveResult {
  live: boolean;
  callsign?: string;
  icao24?: string;
  latitude?: number;
  longitude?: number;
  altitude_ft?: number | null;
  speed_knots?: number | null;
  heading?: number | null;
  vertical_rate_fpm?: number | null;
  on_ground?: boolean;
  origin_country?: string;
  message?: string;
}

export default function FlightSearch({
  onResult,
}: {
  onResult?: (data: LiveResult) => void;
}) {
  const [airline, setAirline] = useState("");
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LiveResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const flight = `${airline.trim()}${number.trim()}`;
    if (!flight) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/flights/track?flight=${encodeURIComponent(flight)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }

      setResult(data);
      onResult?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tracking failed.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full border-b border-[#e5e5e5] bg-transparent py-2.5 font-mono text-[14px] text-[#1d1d1f] outline-none transition-colors placeholder:text-[#c7c7cc] focus:border-[#1d1d1f]";

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex gap-4">
          <div className="w-24">
            <label className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
              AIRLINE
            </label>
            <input
              type="text"
              value={airline}
              onChange={(e) => setAirline(e.target.value)}
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
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="1764"
              maxLength={6}
              className={inputClass}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading || (!airline.trim() && !number.trim())}
          className="w-full bg-[#1d1d1f] py-3 font-mono text-[12px] font-medium tracking-wider text-white transition-opacity hover:opacity-80 disabled:opacity-30"
        >
          {loading ? "TRACKING..." : "TRACK FLIGHT"}
        </button>
      </form>

      {error && (
        <p className="mt-4 font-mono text-[12px] text-[#86868b]">{error}</p>
      )}

      {result && (
        <div className="mt-6 border border-[#e5e5e5] bg-white p-5">
          {result.live ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[18px] font-bold text-[#1d1d1f]">
                  {result.callsign}
                </span>
                <span className="bg-[#1d1d1f] px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest text-white">
                  LIVE
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "ALT", value: result.altitude_ft != null ? `${result.altitude_ft.toLocaleString()} ft` : "\u2014" },
                  { label: "SPD", value: result.speed_knots != null ? `${result.speed_knots} kts` : "\u2014" },
                  { label: "HDG", value: result.heading != null ? `${result.heading}\u00B0` : "\u2014" },
                  { label: "V/S", value: result.vertical_rate_fpm != null ? `${result.vertical_rate_fpm > 0 ? "+" : ""}${result.vertical_rate_fpm} fpm` : "\u2014" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">{label}</p>
                    <p className="mt-0.5 font-mono text-[14px] font-semibold text-[#1d1d1f]">{value}</p>
                  </div>
                ))}
              </div>
              {result.latitude != null && result.longitude != null && (
                <p className="mt-3 font-mono text-[11px] text-[#aeaeb2]">
                  {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                </p>
              )}
            </>
          ) : (
            <p className="font-mono text-[13px] text-[#86868b]">
              {result.message || "Flight not currently airborne."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
