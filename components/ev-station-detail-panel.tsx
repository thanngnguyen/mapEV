"use client";

import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  LocateFixed,
  Share2,
} from "lucide-react";

import { formatDistance } from "@/lib/geo";
import type {
  ChargingPole,
  ChargingStationView,
  RoutePlan,
} from "@/types/ev-map";

type ConnectorSummary = {
  standard: string;
  available: number;
  maxPowerW: number;
};

type EvStationDetailPanelProps = {
  station: ChargingStationView | null;
  routePlan: RoutePlan | null;
  onBackToMap: () => void;
  onOpenRoute: () => void;
};

function summarizeConnectors(poles: ChargingPole[]): ConnectorSummary[] {
  const map = new Map<string, ConnectorSummary>();

  for (const pole of poles) {
    const current = map.get(pole.standard);
    if (!current) {
      map.set(pole.standard, {
        standard: pole.standard,
        available: pole.status === "available" ? 1 : 0,
        maxPowerW: pole.powerW,
      });
      continue;
    }

    current.available += pole.status === "available" ? 1 : 0;
    current.maxPowerW = Math.max(current.maxPowerW, pole.powerW);
  }

  return Array.from(map.values()).sort((a, b) => b.maxPowerW - a.maxPowerW);
}

function formatPrice(pricePerKwh: number): string {
  return `$${(pricePerKwh / 11000).toFixed(2)}/kWh`;
}

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

export function EvStationDetailPanel({
  station,
  routePlan,
  onBackToMap,
  onOpenRoute,
}: EvStationDetailPanelProps) {
  if (!station) {
    return null;
  }

  const connectors = summarizeConnectors(station.poles);
  const [longitude, latitude] = station.coordinates;
  const mapLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

  return (
    <aside className="pointer-events-auto absolute top-0 left-0 h-full w-full md:w-[420px] md:p-4">
      <div className="flex h-full flex-col overflow-hidden border-r border-white/50 bg-white/90 shadow-2xl backdrop-blur-xl md:rounded-3xl md:border md:border-white/40">
        <div className="no-scrollbar flex-1 space-y-7 overflow-y-auto p-6 md:p-8">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onBackToMap}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-emerald-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to map
            </button>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
              aria-label="Share station"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold tracking-[0.14em] text-emerald-700 uppercase">
                Available
              </span>
              <span className="text-xs text-slate-500">
                Station ID: {station.id.toUpperCase()}
              </span>
            </div>
            <h1 className="text-3xl font-bold leading-tight text-slate-900">
              {station.name}
            </h1>
            <p className="flex items-center gap-1.5 text-sm text-slate-500">
              <LocateFixed className="h-4 w-4" />
              {station.address}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/40 bg-slate-100/70 p-4">
              <p className="text-[10px] font-bold tracking-[0.12em] text-slate-500 uppercase">
                Available stalls
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">
                {station.availablePoles}
                <span className="ml-1 text-sm font-medium text-slate-500">
                  / {station.totalPoles}
                </span>
              </p>
            </div>
            <div className="rounded-2xl border border-white/40 bg-slate-100/70 p-4">
              <p className="text-[10px] font-bold tracking-[0.12em] text-slate-500 uppercase">
                Max power
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {Math.round(station.maxPowerW / 1000)}
                <span className="ml-1 text-sm font-medium text-slate-500">
                  kW
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/40 bg-slate-100/80 p-4">
            <p className="text-[10px] font-bold tracking-[0.12em] text-slate-500 uppercase">
              Exact Location
            </p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {formatCoordinate(latitude)}, {formatCoordinate(longitude)}
            </p>
            <p className="mt-1 text-[11px] font-mono text-slate-600">
              Lat {formatCoordinate(latitude)} · Lng{" "}
              {formatCoordinate(longitude)}
            </p>
            <a
              href={mapLink}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-50"
            >
              Open on map
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-bold text-slate-900">Connectors</h3>
            {connectors.map((connector) => (
              <div
                key={connector.standard}
                className="flex items-center justify-between rounded-2xl border border-white/40 bg-white/70 p-4 shadow-sm"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {connector.standard}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {connector.available} available • Up to{" "}
                    {Math.round(connector.maxPowerW / 1000)}kW
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">
                  {connector.available > 0 ? "READY" : "BUSY"}
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/40 bg-slate-100/80 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500">Estimated cost</span>
              <span className="font-bold text-slate-900">
                {formatPrice(station.pricePerKwh)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500">Distance</span>
              <span className="font-bold text-slate-900">
                {formatDistance(station.distanceMeters)}
              </span>
            </div>
            {routePlan && (
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">Route mode</span>
                <span className="font-bold text-slate-900 uppercase">
                  {routePlan.candidate}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/60 bg-white/60 p-6">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onOpenRoute}
              className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:scale-[1.02] active:scale-[0.98]"
            >
              Directions
            </button>
            <button
              type="button"
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200 text-slate-700 transition hover:bg-slate-300"
              aria-label="Book slot"
            >
              <CalendarDays className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
