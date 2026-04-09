"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";
import { Trophy } from "lucide-react";

interface ProfileRow {
  clerk_id: string;
  total_miles: number;
  home_airport: string | null;
}

export default function LeaderboardPage() {
  const { user } = useUser();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("clerk_id, total_miles, home_airport")
      .order("total_miles", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setProfiles(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-amber-400" />
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Leaderboard
          </h1>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Total nautical miles flown
        </p>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="spinner" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="glass mt-8 flex flex-col items-center gap-3 rounded-2xl py-16 text-center">
            <p className="text-slate-400">No flights logged yet. Be the first!</p>
          </div>
        ) : (
          <div className="mt-8 space-y-2">
            {profiles.map((profile, i) => {
              const isYou = user?.id === profile.clerk_id;
              const rank = i + 1;
              return (
                <div
                  key={profile.clerk_id}
                  className={`glass flex items-center gap-4 rounded-2xl p-4 ${
                    isYou ? "ring-1 ring-blue-500/30" : ""
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold ${
                      rank === 1
                        ? "bg-amber-400/10 text-amber-400"
                        : rank === 2
                        ? "bg-slate-300/10 text-slate-300"
                        : rank === 3
                        ? "bg-amber-600/10 text-amber-600"
                        : "bg-white/5 text-slate-500"
                    }`}
                  >
                    {rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {isYou ? "You" : `Pilot #${profile.clerk_id.slice(-4)}`}
                      </span>
                      {isYou && (
                        <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                          YOU
                        </span>
                      )}
                    </div>
                    {profile.home_airport && (
                      <p className="text-xs text-slate-500">
                        Home: <span className="font-mono text-slate-400">{profile.home_airport}</span>
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-sm font-semibold text-white">
                    {profile.total_miles.toLocaleString()}
                    <span className="ml-1 text-xs font-normal text-slate-500">nm</span>
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
