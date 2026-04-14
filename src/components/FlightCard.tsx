"use client";

import { findAirport } from "@/lib/airports";

export interface FlightData {
  id: string;
  flight_number: string;
  airline_name?: string | null;
  departure_iata: string;
  arrival_iata: string;
  scheduled_departure: string;
  scheduled_arrival?: string | null;
  actual_departure?: string | null;
  actual_arrival?: string | null;
  status?: string | null;
  gate?: string | null;
  terminal?: string | null;
  aircraft_type?: string | null;
  distance_nm?: number | null;
  notes?: string | null;
}

function statusLabel(status: string | null | undefined): { text: string; style: string } {
  switch (status?.toLowerCase()) {
    case "in_flight":
    case "in flight":
    case "active":
      return { text: "IN FLIGHT", style: "bg-[#1d1d1f] text-white" };
    case "landed":
    case "arrived":
      return { text: "LANDED", style: "bg-[#e5e5e5] text-[#1d1d1f]" };
    case "delayed":
      return { text: "DELAYED", style: "border border-[#1d1d1f] text-[#1d1d1f]" };
    case "cancelled":
      return { text: "CANCELLED", style: "border border-[#1d1d1f] text-[#86868b] line-through" };
    case "scheduled":
      return { text: "SCHEDULED", style: "bg-[#f5f5f5] text-[#86868b]" };
    default:
      return { text: "", style: "" };
  }
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function FlightCard({
  flight,
  onClick,
  compact = false,
}: {
  flight: FlightData;
  onClick?: () => void;
  compact?: boolean;
}) {
  const dep = findAirport(flight.departure_iata);
  const arr = findAirport(flight.arrival_iata);
  const badge = statusLabel(flight.status);

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={`flex items-center gap-4 border-b border-[#e5e5e5] py-3.5 ${
          onClick ? "cursor-pointer transition-colors hover:bg-[#fafafa]" : ""
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[14px] font-semibold text-[#1d1d1f]">
              {flight.flight_number}
            </span>
            {badge.text && (
              <span className={`px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest ${badge.style}`}>
                {badge.text}
              </span>
            )}
          </div>
          <div className="mt-0.5 font-mono text-[12px] text-[#86868b]">
            <span className="text-[#1d1d1f]">{flight.departure_iata}</span>
            {" \u2192 "}
            <span className="text-[#1d1d1f]">{flight.arrival_iata}</span>
            {flight.aircraft_type && ` \u00B7 ${flight.aircraft_type}`}
          </div>
        </div>
        <div className="text-right font-mono">
          <p className="text-[12px] text-[#86868b]">
            {formatDate(flight.scheduled_departure)}
          </p>
          <p className="text-[11px] text-[#aeaeb2]">
            {formatTime(flight.scheduled_departure)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`border border-[#e5e5e5] bg-white p-6 ${
        onClick ? "cursor-pointer transition-colors hover:bg-[#fafafa]" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[18px] font-bold text-[#1d1d1f]">
            {flight.flight_number}
          </span>
          {flight.airline_name && (
            <span className="text-[12px] text-[#86868b]">{flight.airline_name}</span>
          )}
        </div>
        {badge.text && (
          <span className={`px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest ${badge.style}`}>
            {badge.text}
          </span>
        )}
      </div>

      {/* Date */}
      <p className="mt-1 font-mono text-[11px] text-[#86868b]">
        {formatDate(flight.scheduled_departure)}
      </p>

      {/* Route */}
      <div className="mt-5 flex items-start justify-between">
        <div>
          <p className="font-mono text-[28px] font-bold tracking-tight text-[#1d1d1f]">
            {flight.departure_iata}
          </p>
          {dep && <p className="text-[12px] text-[#86868b]">{dep.city}</p>}
          <p className="mt-1 font-mono text-[13px] text-[#1d1d1f]">
            {formatTime(flight.actual_departure ?? flight.scheduled_departure)}
          </p>
          {flight.terminal && (
            <p className="mt-0.5 font-mono text-[10px] text-[#aeaeb2]">
              T{flight.terminal}{flight.gate ? ` \u00B7 Gate ${flight.gate}` : ""}
            </p>
          )}
        </div>

        <div className="flex flex-col items-center px-4 pt-2">
          <div className="h-px w-16 bg-[#e5e5e5] sm:w-24" />
          {flight.distance_nm != null && (
            <p className="mt-1 font-mono text-[10px] text-[#aeaeb2]">
              {flight.distance_nm.toLocaleString()} nm
            </p>
          )}
          {flight.aircraft_type && (
            <p className="mt-0.5 font-mono text-[10px] text-[#aeaeb2]">{flight.aircraft_type}</p>
          )}
        </div>

        <div className="text-right">
          <p className="font-mono text-[28px] font-bold tracking-tight text-[#1d1d1f]">
            {flight.arrival_iata || "\u2014"}
          </p>
          {arr && <p className="text-[12px] text-[#86868b]">{arr.city}</p>}
          <p className="mt-1 font-mono text-[13px] text-[#1d1d1f]">
            {formatTime(flight.actual_arrival ?? flight.scheduled_arrival)}
          </p>
        </div>
      </div>

      {/* Notes */}
      {flight.notes && (
        <p className="mt-4 border-t border-[#f0f0f0] pt-3 text-[12px] italic text-[#aeaeb2]">
          {flight.notes}
        </p>
      )}
    </div>
  );
}
