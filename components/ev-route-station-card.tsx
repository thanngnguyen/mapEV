"use client";

import { BatteryCharging, Zap } from "lucide-react";

import type { ChargingStationView } from "@/types/ev-map";

type EvRouteStationCardProps = {
  station: ChargingStationView | null;
  onOpenStationDetails: () => void;
};

function formatPrice(pricePerKwh: number): string {
  return `$${(pricePerKwh / 11000).toFixed(2)}/kWh`;
}

export function EvRouteStationCard({
  station,
  onOpenStationDetails,
}: EvRouteStationCardProps) {
  if (!station) {
    return null;
  }

  return (
    <aside className="pointer-events-auto absolute top-8 right-8 hidden w-80 lg:block">
      <div className="rounded-3xl border border-white/40 bg-white/90 p-6 shadow-2xl backdrop-blur-xl">
        <div className="relative mb-4 h-32 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-100 via-white to-slate-100">
          <div className="absolute top-2 right-2 rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">
            AVAILABLE
          </div>
          <div className="absolute inset-0 flex items-center justify-center text-emerald-700">
            <BatteryCharging className="h-11 w-11" />
          </div>
        </div>

        <h4 className="text-lg font-bold text-slate-900">{station.name}</h4>
        <p className="mt-1 text-xs text-slate-500">{station.address}</p>

        <div className="mt-4 space-y-3 rounded-2xl bg-slate-100 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold tracking-wide text-slate-500 uppercase">
              Availability
            </span>
            <span className="font-bold text-slate-800">
              {station.availablePoles}/{station.totalPoles} stalls
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold tracking-wide text-slate-500 uppercase">
              Power
            </span>
            <span className="font-bold text-slate-800">
              {Math.round(station.maxPowerW / 1000)}kW
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold tracking-wide text-slate-500 uppercase">
              Pricing
            </span>
            <span className="font-bold text-emerald-700">
              {formatPrice(station.pricePerKwh)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenStationDetails}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          <Zap className="h-4 w-4" />
          Open station detail
        </button>
      </div>
    </aside>
  );
}
