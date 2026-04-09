"use client";

import { useEffect, useState } from "react";
import { useSession, useUser } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { Plane, MapPin, Clock, Route } from "lucide-react";

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
  const { user } = useUser();
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

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
        <Plane className="h-16 w-16 text-blue-400" />
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            SkyLog
          </h1>
          <p className="mx-auto mt-3 max-w-md text-lg text-slate-400">
            Track every flight. Build your logbook. See how far you&apos;ve flown.
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href="/sign-in"
            className="rounded-xl bg-blue-500 px-6 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-blue-400"
          >
            Get Started
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 text-slate-400">
              <Route className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Total Miles</span>
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-white">
              {loading ? "—" : totalMiles.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">nautical miles</p>
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Flight Hours</span>
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-white">
              {loading ? "—" : totalHours.toFixed(1)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">hours in the air</p>
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 text-slate-400">
              <Plane className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Flights</span>
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-white">
              {loading ? "—" : flights.length}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">logged</p>
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 text-slate-400">
              <MapPin className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Airports</span>
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-white">
              {loading ? "—" : uniqueAirports.size}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">unique</p>
          </div>
        </div>

        {/* Fleet breakdown */}
        {Object.keys(aircraftTypes).length > 0 && (
          <div className="glass mt-6 rounded-2xl p-5">
            <h2 className="text-xs font-medium uppercase tracking-wider text-slate-400">Fleet Diversity</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(aircraftTypes)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <span
                    key={type}
                    className="rounded-xl bg-white/5 px-3 py-1.5 font-mono text-xs text-slate-300"
                  >
                    {type} <span className="text-blue-400">×{count}</span>
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Recent flights */}
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Recent Flights
            </h2>
            {flights.length > 0 && (
              <a href="/logbook" className="text-xs text-blue-400 transition-colors hover:text-blue-300">
                View all
              </a>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="spinner" />
            </div>
          ) : flights.length === 0 ? (
            <div className="glass flex flex-col items-center gap-3 rounded-2xl py-16 text-center">
              <p className="text-slate-400">No flights logged yet.</p>
              <a
                href="/log"
                className="rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-blue-400"
              >
                Log your first flight
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {flights.slice(0, 5).map((flight) => {
                const date = new Date(flight.scheduled_departure);
                return (
                  <div key={flight.id} className="glass flex items-center gap-4 rounded-2xl p-4">
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
                    <div className="text-right">
                      <p className="text-xs text-slate-400">
                        {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                      {flight.distance_nm && (
                        <p className="font-mono text-xs text-slate-500">
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
