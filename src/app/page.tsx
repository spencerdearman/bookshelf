"use client";

import { useEffect, useState } from "react";
import { useSession, useUser } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";

interface Flight {
  id: string;
  flight_number: string;
  departure_iata: string;
  arrival_iata: string;
  scheduled_departure: string;
  scheduled_arrival: string | null;
  aircraft_type: string | null;
  airline_name: string | null;
  distance_nm: number | null;
}

export default function Dashboard() {
  const { session } = useSession();
  const { user, isLoaded } = useUser();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);

  const totalMiles = flights.reduce((sum, f) => sum + (f.distance_nm ?? 0), 0);
  const totalHours = flights.reduce((sum, f) => {
    if (!f.scheduled_departure || !f.scheduled_arrival) return sum;
    const diff = new Date(f.scheduled_arrival).getTime() - new Date(f.scheduled_departure).getTime();
    return sum + diff / 3600000;
  }, 0);
  const uniqueAirports = new Set(flights.flatMap((f) => [f.departure_iata, f.arrival_iata]));
  const aircraftTypes = flights.reduce<Record<string, number>>((acc, f) => {
    if (f.aircraft_type) acc[f.aircraft_type] = (acc[f.aircraft_type] ?? 0) + 1;
    return acc;
  }, {});

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
        setFlights(data ?? []);
        setLoading(false);
      });
  }, [session, user]);

  if (!isLoaded) {
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
          className="rounded-full bg-[#1d1d1f] px-7 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-80"
        >
          Get Started
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-[980px] px-5 py-10">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-px border border-[#e5e5e5] sm:grid-cols-4">
          {[
            { label: "NM", value: loading ? "\u2014" : totalMiles.toLocaleString() },
            { label: "HRS", value: loading ? "\u2014" : totalHours.toFixed(1) },
            { label: "FLIGHTS", value: loading ? "\u2014" : flights.length.toString() },
            { label: "AIRPORTS", value: loading ? "\u2014" : uniqueAirports.size.toString() },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white p-5">
              <p className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">{label}</p>
              <p className="mt-1 font-mono text-[28px] font-bold tracking-tight text-[#1d1d1f]">{value}</p>
            </div>
          ))}
        </div>

        {/* Fleet */}
        {Object.keys(aircraftTypes).length > 0 && (
          <div className="mt-8">
            <p className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">FLEET</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(aircraftTypes)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <span
                    key={type}
                    className="border border-[#e5e5e5] px-3 py-1 font-mono text-[11px] text-[#1d1d1f]"
                  >
                    {type} {count}
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Recent flights */}
        <div className="mt-10">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
              RECENT
            </p>
            {flights.length > 0 && (
              <a href="/logbook" className="font-mono text-[11px] text-[#1d1d1f] underline underline-offset-2 transition-opacity hover:opacity-60">
                View all
              </a>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="spinner" />
            </div>
          ) : flights.length === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-4 border border-[#e5e5e5] py-16 text-center">
              <p className="text-[14px] text-[#86868b]">No flights logged yet.</p>
              <a
                href="/log"
                className="rounded-full bg-[#1d1d1f] px-5 py-2 text-[12px] font-medium text-white transition-opacity hover:opacity-80"
              >
                Log your first flight
              </a>
            </div>
          ) : (
            <div className="mt-4 border-t border-[#e5e5e5]">
              {flights.slice(0, 5).map((flight) => {
                const date = new Date(flight.scheduled_departure);
                return (
                  <div key={flight.id} className="flex items-center gap-4 border-b border-[#e5e5e5] py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-[14px] font-semibold text-[#1d1d1f]">
                          {flight.flight_number}
                        </span>
                        {flight.airline_name && (
                          <span className="text-[12px] text-[#86868b]">{flight.airline_name}</span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 font-mono text-[12px] text-[#86868b]">
                        <span className="text-[#1d1d1f]">{flight.departure_iata}</span>
                        <span>&rarr;</span>
                        <span className="text-[#1d1d1f]">{flight.arrival_iata}</span>
                        {flight.aircraft_type && (
                          <>
                            <span>&middot;</span>
                            <span>{flight.aircraft_type}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <p className="text-[12px] text-[#86868b]">
                        {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                      {flight.distance_nm != null && (
                        <p className="text-[11px] text-[#aeaeb2]">
                          {flight.distance_nm.toLocaleString()} nm
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
