"use client";

import { useMemo } from "react";
import Map, { Source, Layer, Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

interface Props {
  origin?: { lat: number; lng: number; label?: string };
  destination?: { lat: number; lng: number; label?: string };
  aircraft?: { lat: number; lng: number };
}

function greatCircleArc(
  start: [number, number],
  end: [number, number],
  n = 80
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
  return points;
}

function autoZoom(distDeg: number): number {
  if (distDeg > 80) return 1.2;
  if (distDeg > 40) return 2.2;
  if (distDeg > 20) return 3;
  if (distDeg > 10) return 3.8;
  if (distDeg > 5) return 4.5;
  return 5.5;
}

export default function FlightMap({ origin, destination, aircraft }: Props) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const routeGeoJSON = useMemo(() => {
    if (!origin || !destination) return null;
    const coords = greatCircleArc(
      [origin.lng, origin.lat],
      [destination.lng, destination.lat]
    );
    return {
      type: "Feature" as const,
      geometry: { type: "LineString" as const, coordinates: coords },
      properties: {},
    };
  }, [origin, destination]);

  const { center, zoom } = useMemo(() => {
    if (origin && destination) {
      const dx = destination.lng - origin.lng;
      const dy = destination.lat - origin.lat;
      return {
        center: { lat: (origin.lat + destination.lat) / 2, lng: (origin.lng + destination.lng) / 2 },
        zoom: autoZoom(Math.sqrt(dx * dx + dy * dy)),
      };
    }
    if (aircraft) return { center: { lat: aircraft.lat, lng: aircraft.lng }, zoom: 4 };
    if (origin) return { center: origin, zoom: 4 };
    return { center: { lat: 39, lng: -98 }, zoom: 3 };
  }, [origin, destination, aircraft]);

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center bg-[#fafafa]">
        <p className="font-mono text-[12px] text-[#aeaeb2]">Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local</p>
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
      {/* Route line */}
      {routeGeoJSON && (
        <Source id="route" type="geojson" data={routeGeoJSON}>
          <Layer
            id="route-line"
            type="line"
            paint={{ "line-color": "#1d1d1f", "line-width": 1.5, "line-dasharray": [4, 3] }}
          />
        </Source>
      )}

      {/* Origin */}
      {origin && (
        <Marker latitude={origin.lat} longitude={origin.lng} anchor="center">
          <div className="h-2.5 w-2.5 rounded-full border-[1.5px] border-[#1d1d1f] bg-white" />
        </Marker>
      )}
      {origin?.label && (
        <Marker latitude={origin.lat} longitude={origin.lng} anchor="top" offset={[0, 6]}>
          <span className="font-mono text-[10px] font-bold text-[#1d1d1f]">{origin.label}</span>
        </Marker>
      )}

      {/* Destination */}
      {destination && (
        <Marker latitude={destination.lat} longitude={destination.lng} anchor="center">
          <div className="h-2.5 w-2.5 rounded-full bg-[#1d1d1f]" />
        </Marker>
      )}
      {destination?.label && (
        <Marker latitude={destination.lat} longitude={destination.lng} anchor="top" offset={[0, 6]}>
          <span className="font-mono text-[10px] font-bold text-[#1d1d1f]">{destination.label}</span>
        </Marker>
      )}

      {/* Aircraft — simple dot */}
      {aircraft && (
        <Marker latitude={aircraft.lat} longitude={aircraft.lng} anchor="center">
          <div className="h-3 w-3 rounded-full border-[1.5px] border-white bg-[#1d1d1f] shadow-sm" />
        </Marker>
      )}
    </Map>
  );
}
