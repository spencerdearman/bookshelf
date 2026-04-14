"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useSession, useUser } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { findAirport } from "@/lib/airports";
import FlightCard, { type FlightData } from "@/components/FlightCard";
import FlightMap from "@/components/FlightMap";

interface LiveData {
  latitude: number;
  longitude: number;
  altitude_ft: number | null;
  speed_knots: number | null;
  heading: number | null;
}

interface RichData {
  aircraft_friendly?: string;
  origin_gate?: string;
  origin_terminal?: string;
  dest_gate?: string;
  dest_terminal?: string;
  gate_departure?: { scheduled: number | null; actual: number | null };
  gate_arrival?: { scheduled: number | null; actual: number | null };
  takeoff?: { scheduled: number | null; actual: number | null };
  landing?: { scheduled: number | null; actual: number | null };
  route?: string;
  direct_distance_mi?: number;
  planned_distance_mi?: number;
  planned_speed_kts?: number;
  planned_altitude_ft?: number;
  fuel_burn_gal?: number;
}

function fmtTime(ts: number | null | undefined): string {
  if (!ts) return "\u2014";
  return new Date(ts * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

export default function FlightDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { session } = useSession();
  const { user } = useUser();
  const [flight, setFlight] = useState<FlightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [richData, setRichData] = useState<RichData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!session || !user) return;

    const supabase = createClerkSupabaseClient(() =>
      session.getToken({ template: "supabase" })
    );

    supabase
      .from("flights")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setFlight(data);
        setLoading(false);
      });
  }, [session, user, id]);

  // Auto-refresh: always fetch rich data from FlightAware
  const refreshFlight = useCallback(async () => {
    if (!flight || !session) return;
    setRefreshing(true);

    try {
      const params = new URLSearchParams();
      params.set("callsign", flight.flight_number);
      if (flight.departure_iata) {
        params.set("departure_icao", flight.departure_iata);
      }

      const res = await fetch(`/api/flights/refresh?${params}`);
      if (!res.ok) { setRefreshing(false); return; }
      const data = await res.json();

      if (data.updated) {
        const supabase = createClerkSupabaseClient(() =>
          session.getToken({ template: "supabase" })
        );

        // Only update columns that exist in the original schema
        const updates: Record<string, unknown> = {};
        if (data.arrival_iata && !flight.arrival_iata) updates.arrival_iata = data.arrival_iata;
        if (data.aircraft_type && !flight.aircraft_type) updates.aircraft_type = data.aircraft_type;

        if (Object.keys(updates).length > 0) {
          await supabase.from("flights").update(updates).eq("id", flight.id);
          setFlight((prev) => prev ? { ...prev, ...updates } as FlightData : prev);
        }

        // Store rich data for display
        setRichData({
          aircraft_friendly: data.aircraft_friendly,
          origin_gate: data.origin_gate,
          origin_terminal: data.origin_terminal,
          dest_gate: data.dest_gate,
          dest_terminal: data.dest_terminal,
          gate_departure: data.gate_departure,
          gate_arrival: data.gate_arrival,
          takeoff: data.takeoff,
          landing: data.landing,
          route: data.route,
          direct_distance_mi: data.direct_distance_mi,
          planned_distance_mi: data.planned_distance_mi,
          planned_speed_kts: data.planned_speed_kts,
          planned_altitude_ft: data.planned_altitude_ft,
          fuel_burn_gal: data.fuel_burn_gal,
        });

        if (data.live) setLiveData(data.live);
      }
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  }, [flight, session]);

  useEffect(() => {
    if (flight) refreshFlight();
  }, [flight?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleShare() {
    if (!flight || !user) return;
    setSharing(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flight_id: flight.id, user_id: user.id }),
      });
      const data = await res.json();
      if (data.id) {
        const url = `${window.location.origin}/shared/${data.id}`;
        setShareUrl(url);
        await navigator.clipboard.writeText(url);
      }
    } catch {} finally { setSharing(false); }
  }

  async function handleDelete() {
    if (!session || !flight) return;
    if (!confirm(`Remove ${flight.flight_number} from your logbook?`)) return;
    const supabase = createClerkSupabaseClient(() =>
      session.getToken({ template: "supabase" })
    );
    await supabase.from("flights").delete().eq("id", flight.id);
    window.location.href = "/logbook";
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!flight) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="font-mono text-[14px] text-[#86868b]">Flight not found.</p>
      </div>
    );
  }

  const dep = findAirport(flight.departure_iata);
  const arr = flight.arrival_iata ? findAirport(flight.arrival_iata) : undefined;
  const rd = richData;

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-[680px] px-5 py-10">
        <a href="/logbook" className="font-mono text-[11px] text-[#86868b] transition-colors hover:text-[#1d1d1f]">
          &larr; LOGBOOK
        </a>

        {/* Flight card */}
        <div className="mt-4">
          <FlightCard flight={flight} />
        </div>

        {/* Loading indicator */}
        {refreshing && (
          <div className="mt-3 flex items-center gap-2 px-1">
            <div className="spinner" />
            <span className="font-mono text-[11px] text-[#86868b]">Loading flight details...</span>
          </div>
        )}

        {/* Rich flight details from FlightAware */}
        {rd && (
          <div className="mt-3 border border-[#e5e5e5]">
            {/* Aircraft info */}
            {rd.aircraft_friendly && (
              <div className="border-b border-[#e5e5e5] px-5 py-3">
                <p className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">AIRCRAFT</p>
                <p className="mt-0.5 font-mono text-[13px] text-[#1d1d1f]">{rd.aircraft_friendly}</p>
              </div>
            )}

            {/* Times grid */}
            {(rd.gate_departure?.scheduled || rd.takeoff?.scheduled) && (
              <div className="grid grid-cols-2 border-b border-[#e5e5e5]">
                {/* Departure times */}
                <div className="border-r border-[#e5e5e5] px-5 py-3">
                  <p className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">DEPARTURE</p>
                  {rd.gate_departure?.scheduled && (
                    <div className="mt-2">
                      <p className="font-mono text-[9px] tracking-wider text-[#aeaeb2]">GATE</p>
                      <p className="font-mono text-[13px] text-[#1d1d1f]">
                        {fmtTime(rd.gate_departure.actual ?? rd.gate_departure.scheduled)}
                      </p>
                      {rd.gate_departure.actual && rd.gate_departure.scheduled &&
                        rd.gate_departure.actual !== rd.gate_departure.scheduled && (
                        <p className="font-mono text-[10px] text-[#aeaeb2] line-through">
                          {fmtTime(rd.gate_departure.scheduled)}
                        </p>
                      )}
                    </div>
                  )}
                  {rd.takeoff?.scheduled && (
                    <div className="mt-2">
                      <p className="font-mono text-[9px] tracking-wider text-[#aeaeb2]">TAKEOFF</p>
                      <p className="font-mono text-[13px] text-[#1d1d1f]">
                        {fmtTime(rd.takeoff.actual ?? rd.takeoff.scheduled)}
                      </p>
                    </div>
                  )}
                  {rd.origin_gate && (
                    <p className="mt-2 font-mono text-[11px] text-[#86868b]">
                      Gate {rd.origin_gate}{rd.origin_terminal ? ` \u00B7 Terminal ${rd.origin_terminal}` : ""}
                    </p>
                  )}
                </div>

                {/* Arrival times */}
                <div className="px-5 py-3">
                  <p className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">ARRIVAL</p>
                  {rd.landing?.scheduled && (
                    <div className="mt-2">
                      <p className="font-mono text-[9px] tracking-wider text-[#aeaeb2]">LANDING</p>
                      <p className="font-mono text-[13px] text-[#1d1d1f]">
                        {fmtTime(rd.landing.actual ?? rd.landing.scheduled)}
                      </p>
                    </div>
                  )}
                  {rd.gate_arrival?.scheduled && (
                    <div className="mt-2">
                      <p className="font-mono text-[9px] tracking-wider text-[#aeaeb2]">GATE</p>
                      <p className="font-mono text-[13px] text-[#1d1d1f]">
                        {fmtTime(rd.gate_arrival.actual ?? rd.gate_arrival.scheduled)}
                      </p>
                      {rd.gate_arrival.actual && rd.gate_arrival.scheduled &&
                        rd.gate_arrival.actual !== rd.gate_arrival.scheduled && (
                        <p className="font-mono text-[10px] text-[#aeaeb2] line-through">
                          {fmtTime(rd.gate_arrival.scheduled)}
                        </p>
                      )}
                    </div>
                  )}
                  {rd.dest_gate && (
                    <p className="mt-2 font-mono text-[11px] text-[#86868b]">
                      Gate {rd.dest_gate}{rd.dest_terminal ? ` \u00B7 Terminal ${rd.dest_terminal}` : ""}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Flight data row */}
            {(rd.direct_distance_mi || rd.planned_speed_kts || rd.planned_altitude_ft) && (
              <div className="grid grid-cols-3 border-b border-[#e5e5e5]">
                <div className="px-5 py-3">
                  <p className="font-mono text-[9px] tracking-wider text-[#aeaeb2]">DISTANCE</p>
                  <p className="font-mono text-[13px] text-[#1d1d1f]">
                    {rd.direct_distance_mi ? `${rd.direct_distance_mi.toLocaleString()} mi` : "\u2014"}
                  </p>
                </div>
                <div className="border-x border-[#e5e5e5] px-5 py-3">
                  <p className="font-mono text-[9px] tracking-wider text-[#aeaeb2]">SPEED</p>
                  <p className="font-mono text-[13px] text-[#1d1d1f]">
                    {rd.planned_speed_kts ? `${rd.planned_speed_kts} kts` : "\u2014"}
                  </p>
                </div>
                <div className="px-5 py-3">
                  <p className="font-mono text-[9px] tracking-wider text-[#aeaeb2]">ALTITUDE</p>
                  <p className="font-mono text-[13px] text-[#1d1d1f]">
                    {rd.planned_altitude_ft ? `${rd.planned_altitude_ft.toLocaleString()} ft` : "\u2014"}
                  </p>
                </div>
              </div>
            )}

            {/* Route */}
            {rd.route && (
              <div className="px-5 py-3">
                <p className="font-mono text-[9px] tracking-wider text-[#aeaeb2]">ROUTE</p>
                <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-[#86868b] break-all">
                  {rd.route}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Live telemetry */}
        {liveData && (
          <div className="mt-3 grid grid-cols-3 gap-px border border-[#e5e5e5]">
            {[
              { label: "ALT", value: liveData.altitude_ft != null ? `${liveData.altitude_ft.toLocaleString()} ft` : "\u2014" },
              { label: "SPD", value: liveData.speed_knots != null ? `${liveData.speed_knots} kts` : "\u2014" },
              { label: "HDG", value: liveData.heading != null ? `${liveData.heading}\u00B0` : "\u2014" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white p-3">
                <p className="font-mono text-[9px] font-medium tracking-widest text-[#86868b]">{label}</p>
                <p className="font-mono text-[14px] font-semibold text-[#1d1d1f]">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Map */}
        {(dep || arr) && (() => {
          // Compute flight progress (0–1)
          let progress: number | undefined;
          if (liveData && rd) {
            const depTime = rd.takeoff?.actual ?? rd.takeoff?.scheduled ?? rd.gate_departure?.actual ?? rd.gate_departure?.scheduled;
            const arrTime = rd.landing?.scheduled ?? rd.gate_arrival?.scheduled;
            if (depTime && arrTime) {
              const now = Date.now() / 1000;
              progress = Math.max(0, Math.min(1, (now - depTime) / (arrTime - depTime)));
            }
          }
          // Fallback: use scheduled times from the flight record
          if (progress == null && liveData && flight.scheduled_departure) {
            const depTs = new Date(flight.scheduled_departure).getTime() / 1000;
            const arrTs = flight.scheduled_arrival ? new Date(flight.scheduled_arrival).getTime() / 1000 : depTs + 14400;
            const now = Date.now() / 1000;
            progress = Math.max(0, Math.min(1, (now - depTs) / (arrTs - depTs)));
          }
          return (
            <div className="mt-3 h-[420px] border border-[#e5e5e5]">
              <FlightMap
                origin={dep ? { lat: dep.lat, lng: dep.lng, label: dep.iata } : undefined}
                destination={arr ? { lat: arr.lat, lng: arr.lng, label: arr.iata } : undefined}
                progress={progress}
              />
            </div>
          );
        })()}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleShare}
            disabled={sharing}
            className="flex-1 bg-[#1d1d1f] py-3 font-mono text-[11px] font-medium tracking-wider text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {sharing ? "COPYING..." : shareUrl ? "LINK COPIED" : "SHARE FLIGHT"}
          </button>
          <button
            onClick={handleDelete}
            className="border border-[#e5e5e5] bg-white px-6 py-3 font-mono text-[11px] font-medium tracking-wider text-[#86868b] transition-colors hover:border-[#1d1d1f] hover:text-[#1d1d1f]"
          >
            DELETE
          </button>
        </div>

        {shareUrl && (
          <p className="mt-3 break-all font-mono text-[11px] text-[#aeaeb2]">{shareUrl}</p>
        )}
      </main>
    </div>
  );
}
