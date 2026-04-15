"use client";

import {
  Bike,
  CarFront,
  ChevronDown,
  LoaderCircle,
  LocateFixed,
  RefreshCw,
  Route,
  X,
} from "lucide-react";

import { formatDistance, formatDuration } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type {
  ChargingStationView,
  RoutePlan,
  VehicleType,
} from "@/types/ev-map";

type EvStationPanelProps = {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  vehicleType: VehicleType;
  onVehicleTypeChange: (vehicleType: VehicleType) => void;
  nearestStation: ChargingStationView | null;
  selectedStation: ChargingStationView | null;
  routePlan: RoutePlan | null;
  stations: ChargingStationView[];
  onSelectStation: (stationId: string) => void;
  isLocating: boolean;
  locationError: string | null;
  onRefreshLocation: () => void;
  onClosePanel: () => void;
};

const ROUTE_MODE_LABEL: Record<RoutePlan["candidate"], string> = {
  arterial: "Arterial route",
  balanced: "Balanced route",
  shortcut: "Shortcut route",
};

export function EvStationPanel({
  searchText,
  onSearchTextChange,
  vehicleType,
  onVehicleTypeChange,
  nearestStation,
  selectedStation,
  routePlan,
  stations,
  onSelectStation,
  isLocating,
  locationError,
  onRefreshLocation,
  onClosePanel,
}: EvStationPanelProps) {
  const visibleStations = [...stations].sort((first, second) => {
    const firstSelected = first.id === selectedStation?.id;
    const secondSelected = second.id === selectedStation?.id;
    if (firstSelected !== secondSelected) {
      return firstSelected ? -1 : 1;
    }

    const firstNearest = first.id === nearestStation?.id;
    const secondNearest = second.id === nearestStation?.id;
    if (firstNearest !== secondNearest) {
      return firstNearest ? -1 : 1;
    }

    return first.distanceMeters - second.distanceMeters;
  });

  const formatPrice = (pricePerKwh: number) => {
    return `$${(pricePerKwh / 11000).toFixed(2)}/kWh`;
  };

  return (
    <aside className="pointer-events-auto absolute inset-x-4 bottom-24 flex h-[50dvh] flex-col gap-4 overflow-hidden md:bottom-6 md:h-[52dvh] xl:static xl:mt-24 xl:h-[calc(100dvh-7.5rem)] xl:w-[420px] xl:px-6 xl:pb-6">
      <section className="min-h-0 flex flex-1 flex-col rounded-3xl border border-white/30 bg-white/95 p-4 shadow-xl backdrop-blur-xl md:p-6">
        <div className="mb-3 flex justify-center xl:hidden">
          <span className="h-1.5 w-12 rounded-full bg-slate-300" />
        </div>
        <div className="mb-5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 md:text-lg">
              Nearby Now
            </h2>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">
              {stations.length} stations
            </span>
          </div>
          <button
            type="button"
            onClick={onClosePanel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            aria-label="Close nearby stations panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 no-scrollbar">
          {visibleStations.length === 0 && (
            <div className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-500">
              No matching station for search: {searchText}.
            </div>
          )}

          {visibleStations.map((station) => {
            const isClosest = station.id === nearestStation?.id;
            const isSelected = station.id === selectedStation?.id;

            return (
              <button
                key={station.id}
                type="button"
                onClick={() => onSelectStation(station.id)}
                className={cn(
                  "w-full rounded-2xl border p-4 text-left transition-all",
                  isSelected
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-transparent hover:border-emerald-100 hover:bg-slate-50",
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span
                      className={cn(
                        "w-fit rounded-full px-2 py-0.5 text-[11px] font-bold",
                        station.availablePoles > 0
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700",
                      )}
                    >
                      {station.availablePoles > 0 ? "Available" : "Busy"}
                    </span>
                    {isClosest && (
                      <span className="w-fit rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-black tracking-tight text-white uppercase">
                        Closest Match
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-emerald-700">
                    {formatDistance(station.distanceMeters)}
                  </span>
                </div>

                <h3 className="text-lg leading-tight font-bold text-slate-900 md:text-base">
                  {station.name}
                </h3>
                <p className="mt-1 text-sm text-slate-500 md:text-xs">
                  {station.address}
                </p>
                <p className="mt-2 text-sm text-slate-600 md:text-xs">
                  <span className="font-semibold text-slate-700">
                    {station.availablePoles}/{station.totalPoles} Stalls
                  </span>
                  <span className="mx-1">•</span>
                  <span>{Math.round(station.maxPowerW / 1000)}kW</span>
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-700 md:text-xs md:font-bold">
                  {formatPrice(station.pricePerKwh)}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:mt-6 md:gap-4 border-t border-slate-200 pt-4">
          {/* <button
            type="button"
            onClick={() => onSearchTextChange("")}
            className="w-full rounded-lg bg-gradient-to-br from-emerald-700 to-emerald-500 py-2 text-xs font-bold tracking-tight text-white shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] md:rounded-xl md:py-3 md:text-sm md:shadow-lg md:shadow-emerald-500/25 md:hover:scale-[1.02] md:active:scale-[0.98]"
          >
            View All Stations
          </button> */}

          {routePlan && (
            <div className="rounded-xl bg-slate-900 px-3 py-2 text-white md:rounded-2xl md:px-4 md:py-3">
              <div className="flex items-center gap-2 text-[10px] font-semibold tracking-wide text-emerald-300 uppercase md:text-xs md:tracking-normal md:normal-case">
                <Route className="h-3.5 w-3.5 md:h-4 md:w-4" />
                Navigation summary
              </div>
              <p className="mt-1 text-xs font-bold md:text-sm">
                {formatDistance(routePlan.distanceMeters)} ·{" "}
                {formatDuration(routePlan.durationMinutes)}
              </p>
              <p className="mt-1 text-[10px] text-slate-300 md:text-[11px]">
                {ROUTE_MODE_LABEL[routePlan.candidate]}
              </p>
            </div>
          )}
        </div>
      </section>

      <details className="group rounded-3xl border border-white/30 bg-white/90 p-3 shadow-lg backdrop-blur-xl md:hidden">
        <summary className="flex list-none cursor-pointer items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <LocateFixed className="h-3.5 w-3.5" />
            Vehicle & GPS
          </div>
          <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
        </summary>

        <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-100 p-1.5">
            <button
              type="button"
              onClick={() => onVehicleTypeChange("electric-motorbike")}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition",
                vehicleType === "electric-motorbike"
                  ? "bg-emerald-500 text-white"
                  : "text-slate-600",
              )}
            >
              <Bike className="h-3.5 w-3.5" />
              Motorbike
            </button>
            <button
              type="button"
              onClick={() => onVehicleTypeChange("electric-car")}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition",
                vehicleType === "electric-car"
                  ? "bg-emerald-500 text-white"
                  : "text-slate-600",
              )}
            >
              <CarFront className="h-3.5 w-3.5" />
              Car
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 text-[11px] text-slate-600">
            <div className="flex items-center gap-2">
              <LocateFixed className="h-3.5 w-3.5" />
              {isLocating
                ? "Detecting your position..."
                : "Position synchronized"}
              {isLocating && (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              )}
            </div>
            <button
              type="button"
              onClick={onRefreshLocation}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
              aria-label="Refresh location"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          {locationError && (
            <p className="text-[11px] text-amber-700">{locationError}</p>
          )}
        </div>
      </details>

      <section className="hidden rounded-3xl border border-white/30 bg-white/90 p-4 shadow-lg backdrop-blur-xl md:block">
        <div className="flex items-center gap-2 rounded-2xl bg-slate-100 p-1.5">
          <button
            type="button"
            onClick={() => onVehicleTypeChange("electric-motorbike")}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition",
              vehicleType === "electric-motorbike"
                ? "bg-emerald-500 text-white"
                : "text-slate-600",
            )}
          >
            <Bike className="h-4 w-4" />
            Motorbike
          </button>
          <button
            type="button"
            onClick={() => onVehicleTypeChange("electric-car")}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition",
              vehicleType === "electric-car"
                ? "bg-emerald-500 text-white"
                : "text-slate-600",
            )}
          >
            <CarFront className="h-4 w-4" />
            Car
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <LocateFixed className="h-4 w-4" />
            {isLocating
              ? "Detecting your position..."
              : "Position synchronized"}
            {isLocating && (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            )}
          </div>
          <button
            type="button"
            onClick={onRefreshLocation}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            aria-label="Refresh location"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {locationError && (
          <p className="mt-2 text-xs text-amber-700">{locationError}</p>
        )}
      </section>
    </aside>
  );
}
