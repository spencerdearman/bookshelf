"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabase";

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
      <main className="mx-auto w-full max-w-[520px] px-5 py-10">
        <h1 className="font-mono text-[22px] font-bold tracking-tight text-[#1d1d1f]">
          Leaderboard
        </h1>
        <p className="mt-1 font-mono text-[12px] text-[#86868b]">
          Total nautical miles
        </p>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="spinner" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-4 border border-[#e5e5e5] py-16 text-center">
            <p className="text-[14px] text-[#86868b]">No flights logged yet.</p>
          </div>
        ) : (
          <div className="mt-8 border-t border-[#e5e5e5]">
            {profiles.map((profile, i) => {
              const isYou = user?.id === profile.clerk_id;
              const rank = i + 1;
              return (
                <div
                  key={profile.clerk_id}
                  className={`flex items-center gap-4 border-b border-[#e5e5e5] py-3.5 ${
                    isYou ? "bg-[#fafafa]" : ""
                  }`}
                >
                  <span className="w-6 text-right font-mono text-[13px] font-bold text-[#1d1d1f]">
                    {rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[14px] font-medium text-[#1d1d1f]">
                        {isYou ? "You" : `Pilot #${profile.clerk_id.slice(-4)}`}
                      </span>
                      {isYou && (
                        <span className="font-mono text-[9px] font-bold tracking-widest text-[#86868b]">
                          YOU
                        </span>
                      )}
                    </div>
                    {profile.home_airport && (
                      <p className="font-mono text-[11px] text-[#86868b]">
                        {profile.home_airport}
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-[14px] font-semibold text-[#1d1d1f]">
                    {profile.total_miles.toLocaleString()}
                    <span className="ml-1 text-[11px] font-normal text-[#86868b]">nm</span>
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
