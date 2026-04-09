"use client";

import { useEffect, useState } from "react";
import { useSession, useUser } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { Plane, Trash2 } from "lucide-react";

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
  notes: string | null;
}

export default function LogbookPage() {
  const { session } = useSession();
  const { user } = useUser();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function handleDelete(id: string, flightNum: string) {
    if (!session) return;
    if (!confirm(`Remove ${flightNum} from your logbook?`)) return;

    setDeletingId(id);
    const supabase = createClerkSupabaseClient(() =>
      session.getToken({ template: "supabase" })
    );

    const { error } = await supabase.from("flights").delete().eq("id", id);
    if (!error) {
      setFlights((prev) => prev.filter((f) => f.id !== id));
    }
    setDeletingId(null);
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-slate-400">Sign in to view your logbook.</p>
      </div>
    );
  }

  // Group flights by month
  const grouped = flights.reduce<Record<string, Flight[]>>((acc, flight) => {
    const d = new Date(flight.scheduled_departure);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    (acc[key] ??= []).push(flight);
    return acc;
  }, {});

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Logbook
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {flights.length} flight{flights.length !== 1 ? "s" : ""} logged
            </p>
          </div>
          <a
            href="/log"
            className="rounded-xl bg-blue-500 px-4 py-2.5 text-xs font-medium text-white transition-all duration-200 hover:bg-blue-400"
          >
            + Log Flight
          </a>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="spinner" />
          </div>
        ) : flights.length === 0 ? (
          <div className="glass mt-8 flex flex-col items-center gap-3 rounded-2xl py-16 text-center">
            <p className="text-slate-400">Your logbook is empty.</p>
            <a
              href="/log"
              className="rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-blue-400"
            >
              Log your first flight
            </a>
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {Object.entries(grouped).map(([monthKey, monthFlights]) => {
              const [year, month] = monthKey.split("-");
              const label = new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              });
              return (
                <div key={monthKey}>
                  <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                    {label}
                  </h3>
                  <div className="space-y-2">
                    {monthFlights.map((flight) => {
                      const date = new Date(flight.scheduled_departure);
                      return (
                        <div key={flight.id} className="glass group flex items-center gap-4 rounded-2xl p-4">
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
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                              <span className="font-mono font-medium text-slate-300">{flight.departure_iata}</span>
                              <span className="text-slate-600">→</span>
                              <span className="font-mono font-medium text-slate-300">{flight.arrival_iata}</span>
                              {flight.aircraft_type && (
                                <>
                                  <span className="text-slate-600">·</span>
                                  <span>{flight.aircraft_type}</span>
                                </>
                              )}
                              {flight.distance_nm && (
                                <>
                                  <span className="text-slate-600">·</span>
                                  <span className="font-mono">{flight.distance_nm.toLocaleString()} nm</span>
                                </>
                              )}
                            </div>
                            {flight.notes && (
                              <p className="mt-1 text-xs text-slate-500 italic">{flight.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500">
                              {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                            <button
                              onClick={() => handleDelete(flight.id, flight.flight_number)}
                              disabled={deletingId === flight.id}
                              className="rounded-lg p-1.5 text-slate-600 opacity-0 transition-all hover:bg-white/5 hover:text-red-400 group-hover:opacity-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
