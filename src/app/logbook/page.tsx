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
  notes: string | null;
}

export default function LogbookPage() {
  const { session } = useSession();
  const { user, isLoaded } = useUser();
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
        <p className="text-[14px] text-[#86868b]">Sign in to view your logbook.</p>
      </div>
    );
  }

  const grouped = flights.reduce<Record<string, Flight[]>>((acc, flight) => {
    const d = new Date(flight.scheduled_departure);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    (acc[key] ??= []).push(flight);
    return acc;
  }, {});

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-[680px] px-5 py-10">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="font-mono text-[22px] font-bold tracking-tight text-[#1d1d1f]">
              Logbook
            </h1>
            <p className="mt-1 font-mono text-[12px] text-[#86868b]">
              {flights.length} flight{flights.length !== 1 ? "s" : ""}
            </p>
          </div>
          <a
            href="/log"
            className="bg-[#1d1d1f] px-4 py-2 font-mono text-[11px] font-medium tracking-wider text-white transition-opacity hover:opacity-80"
          >
            LOG FLIGHT
          </a>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="spinner" />
          </div>
        ) : flights.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-4 border border-[#e5e5e5] py-16 text-center">
            <p className="text-[14px] text-[#86868b]">Your logbook is empty.</p>
            <a
              href="/log"
              className="bg-[#1d1d1f] px-5 py-2 font-mono text-[11px] font-medium tracking-wider text-white transition-opacity hover:opacity-80"
            >
              LOG YOUR FIRST FLIGHT
            </a>
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            {Object.entries(grouped).map(([monthKey, monthFlights]) => {
              const [year, month] = monthKey.split("-");
              const label = new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              });
              return (
                <div key={monthKey}>
                  <p className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                    {label.toUpperCase()}
                  </p>
                  <div className="mt-3 border-t border-[#e5e5e5]">
                    {monthFlights.map((flight) => {
                      const date = new Date(flight.scheduled_departure);
                      return (
                        <div key={flight.id} className="group flex items-center gap-4 border-b border-[#e5e5e5] py-3.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-3">
                              <span className="font-mono text-[14px] font-semibold text-[#1d1d1f]">
                                {flight.flight_number}
                              </span>
                              {flight.airline_name && (
                                <span className="text-[12px] text-[#86868b]">{flight.airline_name}</span>
                              )}
                            </div>
                            <div className="mt-0.5 font-mono text-[12px] text-[#86868b]">
                              <span className="text-[#1d1d1f]">{flight.departure_iata}</span>
                              {" \u2192 "}
                              <span className="text-[#1d1d1f]">{flight.arrival_iata}</span>
                              {flight.aircraft_type && ` \u00B7 ${flight.aircraft_type}`}
                              {flight.distance_nm != null && ` \u00B7 ${flight.distance_nm.toLocaleString()} nm`}
                            </div>
                            {flight.notes && (
                              <p className="mt-1 text-[12px] italic text-[#aeaeb2]">{flight.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[12px] text-[#86868b]">
                              {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                            <button
                              onClick={() => handleDelete(flight.id, flight.flight_number)}
                              disabled={deletingId === flight.id}
                              className="font-mono text-[10px] tracking-wider text-[#c7c7cc] opacity-0 transition-all hover:text-[#1d1d1f] group-hover:opacity-100"
                            >
                              DEL
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
