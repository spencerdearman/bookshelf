"use client";

import { useEffect, useState } from "react";
import { useSession, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { createClerkSupabaseClient } from "@/lib/supabase";
import FlightCard, { type FlightData } from "@/components/FlightCard";
import FlightSearch from "@/components/FlightSearch";

export default function Dashboard() {
  const { session, isLoaded: sessionLoaded } = useSession();
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [flights, setFlights] = useState<FlightData[]>([]);
  const [loading, setLoading] = useState(true);

  const totalMiles = flights.reduce((sum, f) => sum + (f.distance_nm ?? 0), 0);
  const totalHours = flights.reduce((sum, f) => {
    if (!f.scheduled_departure || !f.scheduled_arrival) return sum;
    const diff =
      new Date(f.scheduled_arrival).getTime() -
      new Date(f.scheduled_departure).getTime();
    return sum + diff / 3600000;
  }, 0);
  const uniqueAirports = new Set(
    flights.flatMap((f) => [f.departure_iata, f.arrival_iata])
  );

  // Split into upcoming and past
  const now = new Date();
  const upcoming = flights.filter(
    (f) => new Date(f.scheduled_departure) >= now
  );
  const recent = flights.filter(
    (f) => new Date(f.scheduled_departure) < now
  );

  useEffect(() => {
    if (!session || !user) {
      setLoading(false);
      return;
    }

    const supabase = createClerkSupabaseClient(() =>
      session.getToken({ template: "supabase" })
    );

    supabase
      .from("flights")
      .select("*")
      .eq("user_id", user.id)
      .order("scheduled_departure", { ascending: false })
      .then(({ data }) => {
        setFlights((data as FlightData[]) ?? []);
        setLoading(false);
      });
  }, [session, user]);

  if (!isLoaded || !sessionLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
        <div>
          <h1 className="font-mono text-[42px] font-bold tracking-tighter text-[#1d1d1f]">
            Vector
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-[#86868b]">
            Track every flight. Build your logbook.
          </p>
        </div>
        <a
          href="/sign-in"
          className="bg-[#1d1d1f] px-7 py-2.5 font-mono text-[12px] font-medium tracking-wider text-white transition-opacity hover:opacity-80"
        >
          GET STARTED
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-[980px] px-5 py-10">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-px border border-[#e5e5e5] sm:grid-cols-4">
          {[
            { label: "NM", value: loading ? "\u2014" : totalMiles.toLocaleString() },
            { label: "HRS", value: loading ? "\u2014" : totalHours.toFixed(1) },
            { label: "FLIGHTS", value: loading ? "\u2014" : flights.length.toString() },
            { label: "AIRPORTS", value: loading ? "\u2014" : uniqueAirports.size.toString() },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white p-5">
              <p className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                {label}
              </p>
              <p className="mt-1 font-mono text-[28px] font-bold tracking-tight text-[#1d1d1f]">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
          {/* Left column: flights */}
          <div>
            {/* Upcoming */}
            {upcoming.length > 0 && (
              <div>
                <p className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                  UPCOMING
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {upcoming.slice(0, 4).map((flight) => (
                    <FlightCard
                      key={flight.id}
                      flight={flight}
                      onClick={() => router.push(`/flight/${flight.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent */}
            <div className={upcoming.length > 0 ? "mt-10" : ""}>
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                  RECENT
                </p>
                {flights.length > 0 && (
                  <a
                    href="/logbook"
                    className="font-mono text-[11px] text-[#1d1d1f] underline underline-offset-2 transition-opacity hover:opacity-60"
                  >
                    View all
                  </a>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center py-16">
                  <div className="spinner" />
                </div>
              ) : recent.length === 0 && upcoming.length === 0 ? (
                <div className="mt-4 flex flex-col items-center gap-4 border border-[#e5e5e5] py-16 text-center">
                  <p className="text-[14px] text-[#86868b]">No flights logged yet.</p>
                  <a
                    href="/log"
                    className="bg-[#1d1d1f] px-5 py-2 font-mono text-[11px] font-medium tracking-wider text-white transition-opacity hover:opacity-80"
                  >
                    LOG YOUR FIRST FLIGHT
                  </a>
                </div>
              ) : (
                <div className="mt-3 border-t border-[#e5e5e5]">
                  {recent.slice(0, 6).map((flight) => (
                    <FlightCard
                      key={flight.id}
                      flight={flight}
                      compact
                      onClick={() => router.push(`/flight/${flight.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column: live tracker */}
          <div>
            <p className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
              LIVE TRACKER
            </p>
            <div className="mt-3">
              <FlightSearch />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
