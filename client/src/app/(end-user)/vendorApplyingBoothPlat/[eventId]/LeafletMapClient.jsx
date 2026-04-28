"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function MapBinder({ onReady, onZoom }) {
  const map = useMap();
  useEffect(() => {
    onReady?.(map);
    const handler = () => onZoom?.(map.getZoom());
    map.on("zoomend", handler);
    return () => map.off("zoomend", handler);
  }, [map, onReady, onZoom]);
  return null;
}

export default function LeafletMapClient({
  center,
  zoom,
  minZoom = 14,
  maxZoom = 21,       // set to 19 if your tiles cap at 19
  onReady,
  onZoom,
  style,
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      minZoom={minZoom}
      maxZoom={maxZoom}
      zoomControl={false}
      style={{ width: "100%", height: "100%", ...style }}
      whenCreated={onReady}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        // If your area only has tiles up to 19:
        // maxNativeZoom={19}
      />
      <MapBinder onReady={onReady} onZoom={onZoom} />
    </MapContainer>
  );
}
