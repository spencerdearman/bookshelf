"use client";

import { useEffect, useState } from "react";
import { useSession, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { createClerkSupabaseClient } from "@/lib/supabase";
import FlightCard, { type FlightData } from "@/components/FlightCard";

export default function LogbookPage() {
  const { session } = useSession();
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [flights, setFlights] = useState<FlightData[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (!isLoaded || !session) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  const grouped = flights.reduce<Record<string, FlightData[]>>((acc, flight) => {
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
              const label = new Date(
                Number(year),
                Number(month) - 1
              ).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              });
              return (
                <div key={monthKey}>
                  <p className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">
                    {label.toUpperCase()}
                  </p>
                  <div className="mt-3 border-t border-[#e5e5e5]">
                    {monthFlights.map((flight) => (
                      <FlightCard
                        key={flight.id}
                        flight={flight}
                        compact
                        onClick={() => router.push(`/flight/${flight.id}`)}
                      />
                    ))}
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
