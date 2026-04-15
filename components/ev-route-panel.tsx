"use client";

import { useState } from "react";
import { Bike, CarFront, ChevronDown, Navigation, Route } from "lucide-react";

import { formatDistance, formatDuration } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type { RoutePlan, VehicleType } from "@/types/ev-map";

type EvRoutePanelProps = {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  routePlan: RoutePlan | null;
  vehicleType: VehicleType;
  onVehicleTypeChange: (value: VehicleType) => void;
  onOpenStationDetails: () => void;
  navigationActive: boolean;
  arrivedAtStation: boolean;
  onStartRealtimeNavigation: () => void;
  onStopRealtimeNavigation: () => void;
};

function getCurrentStepLabel(routePlan: RoutePlan | null): string {
  if (!routePlan || routePlan.steps.length === 0) {
    return "Follow the highlighted route";
  }

  const firstStep = routePlan.steps[0];
  return firstStep.instruction;
}

export function EvRoutePanel({
  searchText,
  onSearchTextChange,
  routePlan,
  vehicleType,
  onVehicleTypeChange,
  onOpenStationDetails,
  navigationActive,
  arrivedAtStation,
  onStartRealtimeNavigation,
  onStopRealtimeNavigation,
}: EvRoutePanelProps) {
  const hasRoute = Boolean(routePlan);
  const [isFastestPanelOpen, setIsFastestPanelOpen] = useState(true);
  const [isUpcomingStepsOpen, setIsUpcomingStepsOpen] = useState(true);

  return (
    <aside
      className={cn(
        "pointer-events-auto absolute inset-x-4 bottom-24 flex flex-col overflow-hidden md:static md:h-full md:w-full md:max-w-[420px] md:p-8",
        isUpcomingStepsOpen ? "h-[50dvh]" : "h-auto max-h-[50dvh]",
      )}
    >
      <div
        className={cn(
          "flex min-h-0 flex-col gap-3 md:gap-4",
          isUpcomingStepsOpen ? "h-full" : "h-auto",
        )}
      >
        <div className="mb-1 flex justify-center md:hidden">
          <span className="h-1.5 w-12 rounded-full bg-slate-300" />
        </div>

        <div className="fixed top-6 right-6 left-6 z-50 rounded-2xl border border-white/35 bg-white/95 p-2 shadow-xl backdrop-blur-xl md:static md:z-auto">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full p-2 text-slate-500 transition hover:bg-zinc-100"
              aria-label="Search"
            >
              <Route className="h-4 w-4" />
            </button>
            <input
              value={searchText}
              onChange={(event) => onSearchTextChange(event.target.value)}
              placeholder="To: charging station..."
              className="h-10 w-full border-none bg-transparent text-sm font-medium text-slate-800 outline-none"
            />
            <button
              type="button"
              onClick={onOpenStationDetails}
              className="rounded-full p-2 text-emerald-700 transition hover:bg-emerald-100"
              aria-label="Open station details"
            >
              <Navigation className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/35 bg-white/90 p-4 shadow-xl backdrop-blur-xl md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">
                {routePlan ? formatDuration(routePlan.durationMinutes) : "--"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {routePlan
                  ? `${formatDistance(routePlan.distanceMeters)} • Optimal route`
                  : "No route available"}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="flex flex-col items-end gap-1">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                  FASTEST
                </span>
                {navigationActive && (
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-300">
                    LIVE GPS
                  </span>
                )}
                {arrivedAtStation && !navigationActive && (
                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
                    Đã đến trạm
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsFastestPanelOpen((current) => !current)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                aria-label={
                  isFastestPanelOpen
                    ? "Collapse fastest panel"
                    : "Expand fastest panel"
                }
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isFastestPanelOpen && "rotate-180",
                  )}
                />
              </button>
            </div>
          </div>

          {isFastestPanelOpen && (
            <>
              <div className="mt-4 flex items-center gap-4 md:mt-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 md:h-12 md:w-12">
                  <Navigation className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-bold tracking-[0.12em] text-slate-500 uppercase md:text-xs md:tracking-[0.15em]">
                    Next step
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">
                    {arrivedAtStation
                      ? "Đã đến trạm"
                      : getCurrentStepLabel(routePlan)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={!hasRoute}
                onClick={
                  navigationActive
                    ? onStopRealtimeNavigation
                    : onStartRealtimeNavigation
                }
                className={cn(
                  "mt-3 w-full rounded-xl py-2 text-[11px] font-bold tracking-[0.1em] uppercase transition md:mt-4 md:py-2.5 md:text-xs md:tracking-[0.12em]",
                  !hasRoute && "cursor-not-allowed bg-slate-200 text-slate-400",
                  hasRoute &&
                    !navigationActive &&
                    "bg-emerald-600 text-white hover:bg-emerald-700",
                  hasRoute &&
                    navigationActive &&
                    "bg-slate-900 text-emerald-300 hover:bg-slate-800",
                )}
              >
                {navigationActive
                  ? "Stop Realtime Guidance"
                  : "Start Realtime Guidance"}
              </button>
            </>
          )}
        </div>

        <div
          className={cn(
            "rounded-2xl border border-white/35 bg-white/90 p-4 shadow-xl backdrop-blur-xl md:p-6",
            isUpcomingStepsOpen ? "min-h-0 flex flex-1 flex-col" : "shrink-0",
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-600">
              <Route className="h-4 w-4" />
              Upcoming Steps
            </h3>
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => onVehicleTypeChange("electric-motorbike")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold",
                    vehicleType === "electric-motorbike"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-600",
                  )}
                >
                  <Bike className="h-3.5 w-3.5" />
                  Bike
                </button>
                <button
                  type="button"
                  onClick={() => onVehicleTypeChange("electric-car")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold",
                    vehicleType === "electric-car"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-600",
                  )}
                >
                  <CarFront className="h-3.5 w-3.5" />
                  Car
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsUpcomingStepsOpen((current) => !current)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                aria-label={
                  isUpcomingStepsOpen
                    ? "Collapse upcoming steps"
                    : "Expand upcoming steps"
                }
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isUpcomingStepsOpen && "rotate-180",
                  )}
                />
              </button>
            </div>
          </div>

          {isUpcomingStepsOpen && (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1 no-scrollbar">
              <div className="space-y-5">
                {routePlan?.steps.map((step, index) => (
                  <div key={step.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          index === 0 ? "bg-emerald-500" : "bg-slate-300",
                        )}
                      />
                      {index < routePlan.steps.length - 1 && (
                        <div className="my-1 h-12 w-0.5 bg-slate-200" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {step.instruction}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDistance(step.distanceMeters)} •{" "}
                        {formatDuration(step.durationMinutes)}
                      </p>
                    </div>
                  </div>
                ))}

                {!routePlan && (
                  <p className="text-sm text-slate-500">
                    Select a station to generate route steps.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* {selectedStation && (
          <button
            type="button"
            onClick={onOpenStationDetails}
            className="rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-500 py-2 text-xs font-bold text-white shadow-xl shadow-emerald-500/20 transition hover:scale-[1.01] active:scale-[0.99] md:py-3 md:text-sm md:hover:scale-[1.02] md:active:scale-[0.98]"
          >
            Open {selectedStation.name} details
          </button>
        )} */}
      </div>
    </aside>
  );
}
