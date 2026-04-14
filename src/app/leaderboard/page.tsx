"use client";

import { useEffect, useState } from "react";
import { useSession, useUser } from "@clerk/nextjs";
import { createClerkSupabaseClient } from "@/lib/supabase";

interface LeaderboardEntry {
  clerk_id: string;
  flight_count: number;
  airports: string[];
}

export default function LeaderboardPage() {
  const { session, isLoaded: sessionLoaded } = useSession();
  const { user, isLoaded } = useUser();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
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
      .select("user_id, departure_iata, arrival_iata")
      .then(({ data }) => {
        if (!data || data.length === 0) { setLoading(false); return; }

        const users: Record<string, { count: number; airports: Set<string> }> = {};
        for (const f of data) {
          if (!users[f.user_id]) {
            users[f.user_id] = { count: 0, airports: new Set() };
          }
          users[f.user_id].count++;
          if (f.departure_iata) users[f.user_id].airports.add(f.departure_iata);
          if (f.arrival_iata) users[f.user_id].airports.add(f.arrival_iata);
        }

        const sorted = Object.entries(users)
          .map(([clerk_id, { count, airports }]) => ({
            clerk_id,
            flight_count: count,
            airports: Array.from(airports),
          }))
          .sort((a, b) => b.flight_count - a.flight_count);

        setEntries(sorted);
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

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-[520px] px-5 py-10">
        <h1 className="font-mono text-[22px] font-bold tracking-tight text-[#1d1d1f]">
          Leaderboard
        </h1>
        <p className="mt-1 font-mono text-[12px] text-[#86868b]">
          Total flights logged
        </p>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="spinner" />
          </div>
        ) : entries.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-4 border border-[#e5e5e5] py-16 text-center">
            <p className="text-[14px] text-[#86868b]">No flights logged yet.</p>
          </div>
        ) : (
          <div className="mt-8 border-t border-[#e5e5e5]">
            {entries.map((entry, i) => {
              const isYou = user?.id === entry.clerk_id;
              const rank = i + 1;
              return (
                <div
                  key={entry.clerk_id}
                  className={`flex items-center gap-4 border-b border-[#e5e5e5] px-2 py-3.5 ${
                    isYou ? "bg-[#fafafa]" : ""
                  }`}
                >
                  <span className="w-6 text-right font-mono text-[13px] font-bold text-[#1d1d1f]">
                    {rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[14px] font-medium text-[#1d1d1f]">
                        {isYou ? "You" : `Pilot #${entry.clerk_id.slice(-4)}`}
                      </span>
                      {isYou && (
                        <span className="font-mono text-[9px] font-bold tracking-widest text-[#86868b]">
                          YOU
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-[11px] text-[#86868b]">
                      {entry.airports.length} airports
                    </p>
                  </div>
                  <span className="pr-2 font-mono text-[14px] font-semibold text-[#1d1d1f]">
                    {entry.flight_count}
                    <span className="ml-1 text-[11px] font-normal text-[#86868b]">
                      flight{entry.flight_count !== 1 ? "s" : ""}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
