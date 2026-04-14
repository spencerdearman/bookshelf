"use client";

import { useEffect, useState, use } from "react";
import { findAirport } from "@/lib/airports";
import FlightCard, { type FlightData } from "@/components/FlightCard";
import FlightMap from "@/components/FlightMap";

export default function SharedFlightPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [flight, setFlight] = useState<FlightData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/share?id=${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setFlight(data.flight);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load flight.");
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !flight) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className="font-mono text-[14px] text-[#1d1d1f]">{error || "Not found"}</p>
        <a href="/" className="font-mono text-[11px] text-[#86868b] underline underline-offset-2">
          Go home
        </a>
      </div>
    );
  }

  const dep = findAirport(flight.departure_iata);
  const arr = findAirport(flight.arrival_iata);

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-[680px] px-5 py-10">
        <p className="font-mono text-[10px] font-medium tracking-widest text-[#86868b]">SHARED FLIGHT</p>

        <div className="mt-4">
          <FlightCard flight={flight} />
        </div>

        {(dep || arr) && (
          <div className="mt-4 h-[300px] border border-[#e5e5e5]">
            <FlightMap
              origin={dep ? { lat: dep.lat, lng: dep.lng, label: dep.iata } : undefined}
              destination={arr ? { lat: arr.lat, lng: arr.lng, label: arr.iata } : undefined}
            />
          </div>
        )}
      </main>
    </div>
  );
}
