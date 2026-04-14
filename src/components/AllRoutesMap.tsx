"use client";

import { useMemo } from "react";
import Map, { Source, Layer, Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { findAirport } from "@/lib/airports";

interface Flight {
  departure_iata: string;
  arrival_iata: string;
}

interface Props {
  flights: Flight[];
}

function greatCircleArc(
  start: [number, number],
  end: [number, number],
  n = 48
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const [lng1, lat1] = [toRad(start[0]), toRad(start[1])];
  const [lng2, lat2] = [toRad(end[0]), toRad(end[1])];
  const d = Math.acos(
    Math.min(1, Math.max(-1,
      Math.sin(lat1) * Math.sin(lat2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1)
    ))
  );
  if (d < 1e-6) return [start, end];
  const points: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const A = Math.sin((1 - t) * d) / Math.sin(d);
    const B = Math.sin(t * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    points.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  // Fix antimeridian crossings
  for (let i = 1; i < points.length; i++) {
    while (points[i][0] - points[i - 1][0] > 180) points[i][0] -= 360;
    while (points[i][0] - points[i - 1][0] < -180) points[i][0] += 360;
  }
  return points;
}

export default function AllRoutesMap({ flights }: Props) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Build unique routes and airports
  const { routesGeoJSON, airports, center, zoom } = useMemo(() => {
    const airportSet: Record<string, { lat: number; lng: number; code: string; count: number }> = {};
    const routeKeys = new Set<string>();
    const features: {
      type: "Feature";
      geometry: { type: "LineString"; coordinates: [number, number][] };
      properties: Record<string, unknown>;
    }[] = [];

    for (const f of flights) {
      if (!f.departure_iata || !f.arrival_iata) continue;

      const dep = findAirport(f.departure_iata);
      const arr = findAirport(f.arrival_iata);
      if (!dep || !arr) continue;

      // Track airports
      for (const a of [dep, arr]) {
        if (airportSet[a.iata]) {
          airportSet[a.iata].count++;
        } else {
          airportSet[a.iata] = { lat: a.lat, lng: a.lng, code: a.iata, count: 1 };
        }
      }

      // Deduplicate routes (A→B same as B→A)
      const key = [dep.iata, arr.iata].sort().join("-");
      if (routeKeys.has(key)) continue;
      routeKeys.add(key);

      const coords = greatCircleArc([dep.lng, dep.lat], [arr.lng, arr.lat]);
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
        properties: { route: key },
      });
    }

    const allAirports = Object.values(airportSet);

    // Compute center from all airports
    let cLat = 39, cLng = -98, z = 3;
    if (allAirports.length > 0) {
      const lats = allAirports.map((a) => a.lat);
      const lngs = allAirports.map((a) => a.lng);
      cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

      const span = Math.max(
        Math.max(...lats) - Math.min(...lats),
        Math.max(...lngs) - Math.min(...lngs)
      );
      if (span > 80) z = 1;
      else if (span > 40) z = 1.8;
      else if (span > 20) z = 2.5;
      else if (span > 10) z = 3.2;
      else if (span > 5) z = 4;
      else z = 5;
    }

    return {
      routesGeoJSON: {
        type: "FeatureCollection" as const,
        features,
      },
      airports: allAirports,
      center: { lat: cLat, lng: cLng },
      zoom: z,
    };
  }, [flights]);

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center bg-[#fafafa]">
        <p className="font-mono text-[12px] text-[#aeaeb2]">Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local</p>
      </div>
    );
  }

  if (flights.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-[#fafafa]">
        <p className="font-mono text-[12px] text-[#aeaeb2]">No flights to display</p>
      </div>
    );
  }

  return (
    <Map
      mapboxAccessToken={token}
      initialViewState={{ latitude: center.lat, longitude: center.lng, zoom }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/light-v11"
      projection={{ name: "mercator" }}
      attributionControl={false}
    >
      {/* All route arcs */}
      <Source id="all-routes" type="geojson" data={routesGeoJSON}>
        <Layer
          id="all-routes-line"
          type="line"
          paint={{
            "line-color": "#1d1d1f",
            "line-width": 1,
            "line-opacity": 0.35,
          }}
        />
      </Source>

      {/* Airport dots */}
      {airports.map((a) => (
        <Marker key={a.code} latitude={a.lat} longitude={a.lng} anchor="center">
          <div
            className="rounded-full bg-[#1d1d1f]"
            style={{
              width: Math.min(4 + a.count * 1.5, 10),
              height: Math.min(4 + a.count * 1.5, 10),
            }}
          />
        </Marker>
      ))}

      {/* Airport labels for frequently visited */}
      {airports
        .filter((a) => a.count >= 2)
        .map((a) => (
          <Marker key={`label-${a.code}`} latitude={a.lat} longitude={a.lng} anchor="top" offset={[0, 6]}>
            <span className="font-mono text-[9px] font-bold text-[#1d1d1f]">{a.code}</span>
          </Marker>
        ))}
    </Map>
  );
}
