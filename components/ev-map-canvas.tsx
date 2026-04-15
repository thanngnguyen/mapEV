"use client";

import MapLibreGL from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";

import {
  Map,
  MapControls,
  MapMarker,
  MapPopup,
  MapRoute,
  type MapRef,
  MarkerContent,
  MarkerLabel,
  MarkerTooltip,
} from "@/components/ui/map";
import { formatDistance, formatDuration } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type {
  ChargingStationView,
  Coordinates,
  RoutePlan,
  VehicleType,
} from "@/types/ev-map";

type EvMapCanvasProps = {
  userCoordinates: Coordinates;
  stations: ChargingStationView[];
  nearestStationId: string | null;
  selectedStation: ChargingStationView | null;
  routePlan: RoutePlan | null;
  vehicleType: VehicleType;
  onSelectStation: (stationId: string) => void;
  showRoute?: boolean;
  showSelectedPopup?: boolean;
  controlsOffsetClassName?: string;
};

const MAP_STYLES = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

function getRouteColor(vehicleType: VehicleType): string {
  return vehicleType === "electric-car" ? "#0f766e" : "#00E676";
}

function getRouteDashArray(
  vehicleType: VehicleType,
): [number, number] | undefined {
  return vehicleType === "electric-motorbike" ? [0.9, 1.4] : undefined;
}

function formatPrice(pricePerKwh: number): string {
  return `$${(pricePerKwh / 11000).toFixed(2)}/kWh`;
}

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

function formatStationCoordinateLine(coordinates: Coordinates): string {
  const [longitude, latitude] = coordinates;
  return `Lat ${formatCoordinate(latitude)} · Lng ${formatCoordinate(longitude)}`;
}

function getExternalMapLink(coordinates: Coordinates): string {
  const [longitude, latitude] = coordinates;
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function isStationAvailable(station: ChargingStationView): boolean {
  return station.availablePoles > 0;
}

function getMarkerLabel(station: ChargingStationView): string {
  if (station.availablePoles === 0) {
    return "BUSY";
  }

  if (station.maxPowerW >= 150000) {
    return "RAPID";
  }

  return "V2 HUB";
}

export function EvMapCanvas({
  userCoordinates,
  stations,
  nearestStationId,
  selectedStation,
  routePlan,
  vehicleType,
  onSelectStation,
  showRoute = false,
  showSelectedPopup = false,
  controlsOffsetClassName,
}: EvMapCanvasProps) {
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    const mapInstance = mapRef.current;
    if (!mapInstance) {
      return;
    }

    const bounds = new MapLibreGL.LngLatBounds(
      userCoordinates,
      userCoordinates,
    );

    if (showRoute && routePlan?.coordinates.length) {
      routePlan.coordinates.forEach((coordinate) => {
        bounds.extend(coordinate);
      });
    } else if (selectedStation) {
      bounds.extend(selectedStation.coordinates);
    } else {
      stations.forEach((station) => {
        bounds.extend(station.coordinates);
      });
    }

    mapInstance.fitBounds(bounds, {
      padding: 90,
      duration: 850,
      maxZoom: selectedStation && !showRoute ? 16 : 14.4,
    });
  }, [routePlan, selectedStation, showRoute, stations, userCoordinates]);

  const selectedStationPopup = useMemo(() => {
    if (!showSelectedPopup || !selectedStation || !routePlan) {
      return null;
    }

    return (
      <MapPopup
        longitude={selectedStation.coordinates[0]}
        latitude={selectedStation.coordinates[1]}
        offset={26}
        closeButton={false}
        className="w-64 rounded-[1.35rem] bg-white/90 p-4 shadow-[0_22px_40px_rgba(38,50,56,0.12)] backdrop-blur-xl"
      >
        <p className="text-[10px] font-semibold tracking-[0.24em] text-emerald-700 uppercase">
          Selected station
        </p>
        <h3 className="mt-2 text-lg font-bold text-slate-900">
          {selectedStation.name}
        </h3>
        <p className="mt-1 text-xs text-slate-600">{selectedStation.address}</p>
        <p className="mt-1 text-[11px] font-mono text-slate-600">
          {formatStationCoordinateLine(selectedStation.coordinates)}
        </p>
        <div className="mt-4 rounded-2xl bg-slate-100/80 p-3">
          <p className="text-xs font-semibold text-slate-700">
            {selectedStation.availablePoles}/{selectedStation.totalPoles} poles
            available
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Max {Math.round(selectedStation.maxPowerW / 1000)} kW
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Route: {formatDistance(routePlan.distanceMeters)} ·{" "}
            {formatDuration(routePlan.durationMinutes)}
          </p>
          <a
            href={getExternalMapLink(selectedStation.coordinates)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-emerald-700 transition hover:bg-emerald-50"
          >
            Open exact location
          </a>
        </div>
      </MapPopup>
    );
  }, [routePlan, selectedStation, showSelectedPopup]);

  return (
    <Map
      ref={mapRef}
      className="h-full w-full"
      styles={MAP_STYLES}
      center={userCoordinates}
      zoom={13.5}
      dragRotate={false}
      touchPitch={false}
    >
      {showRoute && routePlan && (
        <>
          <MapRoute
            id="ev-route-glow"
            coordinates={routePlan.coordinates}
            color="#99f6e4"
            width={11}
            opacity={0.24}
            interactive={false}
          />
          <MapRoute
            id="ev-route-main"
            coordinates={routePlan.coordinates}
            color={getRouteColor(vehicleType)}
            width={5}
            opacity={0.92}
            dashArray={getRouteDashArray(vehicleType)}
            interactive={false}
          />
        </>
      )}

      <MapMarker longitude={userCoordinates[0]} latitude={userCoordinates[1]}>
        <MarkerContent>
          <div className="relative flex h-6 w-6 items-center justify-center">
            <span className="absolute h-10 w-10 animate-ping rounded-full bg-emerald-400/35" />
            <span className="relative h-4 w-4 rounded-full border-2 border-white bg-emerald-500 shadow-[0_0_18px_rgba(0,230,118,0.65)]" />
          </div>
        </MarkerContent>
        <MarkerLabel className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white">
          You
        </MarkerLabel>
      </MapMarker>

      {selectedStation && (
        <MapMarker
          longitude={selectedStation.coordinates[0]}
          latitude={selectedStation.coordinates[1]}
        >
          <MarkerContent>
            <div className="pointer-events-none relative flex h-9 w-9 items-center justify-center">
              <span className="absolute h-6 w-6 rounded-full border-2 border-emerald-600" />
              <span className="absolute h-10 w-10 rounded-full border border-emerald-400/50" />
              <span className="h-2.5 w-2.5 rounded-full border border-white bg-emerald-600 shadow-[0_0_10px_rgba(0,230,118,0.7)]" />
            </div>
          </MarkerContent>
          <MarkerLabel className="rounded-full bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white">
            Exact pin
          </MarkerLabel>
        </MapMarker>
      )}

      {stations.map((station) => {
        const isNearest = station.id === nearestStationId;
        const available = isStationAvailable(station);
        const isSelected = station.id === selectedStation?.id;

        return (
          <MapMarker
            key={station.id}
            longitude={station.coordinates[0]}
            latitude={station.coordinates[1]}
            onClick={() => onSelectStation(station.id)}
          >
            {isNearest ? (
              <MarkerContent>
                <button
                  type="button"
                  className="group flex scale-110 items-center rounded-full border-2 border-emerald-600 bg-white px-5 py-2.5 text-left shadow-2xl transition-transform hover:scale-125"
                >
                  <span className="mr-3 h-3.5 w-3.5 rounded-full bg-emerald-500 shadow-[0_0_20px_#00e676]" />
                  <span>
                    <span className="block text-[9px] font-black leading-none tracking-tight text-emerald-700 uppercase">
                      Nearest station
                    </span>
                    <span className="block text-sm font-black text-slate-900">
                      {formatPrice(station.pricePerKwh)}
                    </span>
                  </span>
                </button>
              </MarkerContent>
            ) : (
              <MarkerContent>
                <button
                  type="button"
                  className={cn(
                    "flex items-center rounded-full border px-3 py-1.5 text-left shadow-xl transition-transform hover:scale-110",
                    available
                      ? "border-emerald-100 bg-white/95"
                      : "border-amber-200 bg-amber-50/95",
                    isSelected && "ring-2 ring-emerald-400",
                  )}
                >
                  <span
                    className={cn(
                      "mr-2 h-2.5 w-2.5 rounded-full",
                      available ? "bg-emerald-500" : "bg-amber-500",
                    )}
                  />
                  <span>
                    <span className="block text-[9px] leading-none font-bold text-slate-500">
                      {getMarkerLabel(station)}
                    </span>
                    <span className="block text-[11px] font-bold text-slate-800">
                      {formatPrice(station.pricePerKwh)}
                    </span>
                  </span>
                </button>
              </MarkerContent>
            )}

            <MarkerTooltip className="rounded-xl bg-slate-900 px-3 py-2 text-white shadow-lg">
              <p className="text-xs font-semibold">{station.name}</p>
              <p className="mt-0.5 text-[11px] text-slate-300">
                {formatDistance(station.distanceMeters)}
              </p>
              <p className="mt-0.5 text-[10px] font-mono text-slate-300/90">
                {formatStationCoordinateLine(station.coordinates)}
              </p>
            </MarkerTooltip>
          </MapMarker>
        );
      })}

      {selectedStationPopup}

      <MapControls
        position="bottom-right"
        showZoom
        showLocate
        className={cn("bottom-5 right-5", controlsOffsetClassName)}
      />
    </Map>
  );
}
