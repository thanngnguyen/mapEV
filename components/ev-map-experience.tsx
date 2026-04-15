"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  ChevronLeft,
  FileText,
  Menu,
  Map,
  MapPinned,
  Route,
  Search,
  Shield,
  UserCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useEvMap } from "@/hooks/use-ev-map";
import { EvMapCanvas } from "@/components/ev-map-canvas";
import { EvStationPanel } from "@/components/ev-station-panel";
import { EvRoutePanel } from "@/components/ev-route-panel";
import { EvRouteStationCard } from "@/components/ev-route-station-card";
import { EvStationDetailPanel } from "@/components/ev-station-detail-panel";
import { EvUsageNotesPanel } from "@/components/ev-usage-notes-panel";
import { cn } from "@/lib/utils";
import type { EvTab } from "@/types/ev-map";

const TAB_ITEMS: Array<{
  tab: EvTab;
  label: string;
  mobileLabel: string;
  icon: LucideIcon;
}> = [
  { tab: "map", label: "Map Explorer", mobileLabel: "Map", icon: MapPinned },
  { tab: "route", label: "Route Planner", mobileLabel: "Route", icon: Route },
  {
    tab: "station",
    label: "Station Detail",
    mobileLabel: "Station",
    icon: Shield,
  },
  { tab: "notes", label: "Usage Notes", mobileLabel: "Notes", icon: FileText },
];

export function EvMapExperience() {
  const {
    userCoordinates,
    activeTab,
    setActiveTab,
    searchText,
    setSearchText,
    vehicleType,
    setVehicleType,
    nearestStation,
    selectedStation,
    routePlan,
    filteredStations,
    selectStation,
    locationError,
    isLocating,
    navigationActive,
    arrivedAtStation,
    refreshLocation,
    startRealtimeNavigation,
    stopRealtimeNavigation,
    usageNotes,
  } = useEvMap();

  const showFloatingNav = activeTab !== "station";
  const showMapCanvas = activeTab !== "notes";
  const showTopSearch = activeTab === "map" || activeTab === "station";
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);
  const [isNearbyPanelOpen, setIsNearbyPanelOpen] = useState(false);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const isLargeScreen = window.matchMedia("(min-width: 1280px)").matches;
      setIsNavigatorOpen(isLargeScreen);
      setIsNearbyPanelOpen(isLargeScreen);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-100 text-slate-900">
      <main className="relative h-full w-full overflow-hidden">
        {showMapCanvas ? (
          <div className="absolute inset-0 z-0">
            <EvMapCanvas
              userCoordinates={userCoordinates}
              stations={filteredStations}
              nearestStationId={nearestStation?.id ?? null}
              selectedStation={selectedStation}
              routePlan={routePlan}
              vehicleType={vehicleType}
              onSelectStation={selectStation}
              showRoute={activeTab === "route"}
              showSelectedPopup={activeTab === "station"}
              controlsOffsetClassName={
                activeTab === "route" ? "md:bottom-12" : undefined
              }
            />
          </div>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(0,230,118,0.2),transparent_45%),radial-gradient(circle_at_85%_10%,rgba(38,50,56,0.15),transparent_35%),#f5f7f8]" />
        )}

        {showFloatingNav && !isNavigatorOpen && (
          <button
            type="button"
            onClick={() => setIsNavigatorOpen(true)}
            className="pointer-events-auto absolute top-6 left-6 z-50 hidden items-center gap-2 rounded-2xl border border-white/60 bg-white/90 px-3 py-2 text-xs font-bold text-slate-700 shadow-xl backdrop-blur-xl md:inline-flex"
            aria-label="Open navigation panel"
          >
            <Menu className="h-4 w-4" />
            Menu
          </button>
        )}

        {showFloatingNav && isNavigatorOpen && (
          <aside className="pointer-events-auto absolute top-6 left-6 z-50 hidden h-fit w-72 flex-col overflow-hidden rounded-2xl border border-white/30 bg-white/90 shadow-2xl backdrop-blur-xl md:flex">
            <div className="flex items-start justify-between gap-3 px-6 py-8">
              <div>
                <h1 className="mb-1 text-lg font-black text-emerald-600">
                  Luminous Navigator
                </h1>
                <p className="text-[10px] font-bold tracking-[0.22em] text-zinc-400 uppercase">
                  Precision EV Logistics
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNavigatorOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-600 transition hover:bg-slate-100"
                aria-label="Collapse navigation panel"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 px-2 py-4">
              {TAB_ITEMS.map(({ tab, label, icon: Icon }) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition-all",
                    activeTab === tab
                      ? "bg-emerald-100 text-emerald-700"
                      : "text-zinc-500 hover:bg-zinc-100/80",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>
            {/* <div className="mt-auto px-4 py-6">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-100/70 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
                  <UserCircle2 className="h-6 w-6 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Alex Driver
                  </p>
                  <p className="text-[10px] text-slate-500">Tesla Model 3</p>
                </div>
              </div>
            </div> */}
          </aside>
        )}

        {showTopSearch && (
          <div
            className={cn(
              "pointer-events-auto absolute top-6 right-6 left-6 z-40",
              activeTab === "station"
                ? "md:left-[470px] md:right-auto md:w-[420px]"
                : isNavigatorOpen
                  ? "md:left-[330px] md:right-auto md:w-[420px]"
                  : "left-6 md:left-[120px] md:right-auto md:w-[420px]",
            )}
          >
            <div className="flex items-center rounded-2xl border border-slate-200/80 bg-white/95 p-1 shadow-2xl backdrop-blur-xl">
              <div className="flex flex-1 items-center gap-3 px-3">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search for charging stations..."
                  className="h-11 w-full border-none bg-transparent text-sm font-medium text-slate-900 outline-none"
                />
              </div>
              <div className="ml-2 flex items-center gap-1 border-l border-slate-200 pl-2 pr-1">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-emerald-700"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-emerald-700"
                  aria-label="Profile"
                >
                  <UserCircle2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "map" && (
          <>
            {!isNearbyPanelOpen && (
              <button
                type="button"
                onClick={() => setIsNearbyPanelOpen(true)}
                className={cn(
                  "pointer-events-auto absolute top-24 z-40 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/92 px-4 py-2 text-xs font-bold text-slate-700 shadow-xl backdrop-blur-xl",
                  isNavigatorOpen ? "md:left-[330px]" : "left-6",
                )}
                aria-label="Open nearby stations panel"
              >
                <Map className="h-4 w-4" />
                Nearby Now
              </button>
            )}

            <div
              className={cn(
                "pointer-events-none absolute inset-0 z-30",
                isNavigatorOpen ? "md:pl-[304px]" : "md:pl-0",
              )}
            >
              {isNearbyPanelOpen && (
                <EvStationPanel
                  searchText={searchText}
                  onSearchTextChange={setSearchText}
                  vehicleType={vehicleType}
                  onVehicleTypeChange={setVehicleType}
                  nearestStation={nearestStation}
                  selectedStation={selectedStation}
                  routePlan={routePlan}
                  stations={filteredStations}
                  onSelectStation={selectStation}
                  isLocating={isLocating}
                  locationError={locationError}
                  onRefreshLocation={refreshLocation}
                  onClosePanel={() => setIsNearbyPanelOpen(false)}
                />
              )}
            </div>
          </>
        )}

        {activeTab === "route" && (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 z-30",
              isNavigatorOpen ? "md:pl-[286px]" : "md:pl-0",
            )}
          >
            <EvRoutePanel
              searchText={searchText}
              onSearchTextChange={setSearchText}
              routePlan={routePlan}
              vehicleType={vehicleType}
              onVehicleTypeChange={setVehicleType}
              onOpenStationDetails={() => setActiveTab("station")}
              navigationActive={navigationActive}
              arrivedAtStation={arrivedAtStation}
              onStartRealtimeNavigation={startRealtimeNavigation}
              onStopRealtimeNavigation={stopRealtimeNavigation}
            />
            <EvRouteStationCard
              station={selectedStation}
              onOpenStationDetails={() => setActiveTab("station")}
            />
          </div>
        )}

        {activeTab === "station" && (
          <div className="pointer-events-none absolute inset-0 z-30">
            <EvStationDetailPanel
              station={selectedStation}
              routePlan={routePlan}
              onBackToMap={() => setActiveTab("map")}
              onOpenRoute={() => {
                startRealtimeNavigation();
                setActiveTab("route");
              }}
            />
          </div>
        )}

        {activeTab === "notes" && (
          <div
            className={cn(
              "pointer-events-auto absolute inset-0 z-30 overflow-y-auto p-4 pb-24 md:pr-8 md:py-8",
              isNavigatorOpen ? "md:pl-[320px]" : "md:pl-8",
            )}
          >
            <EvUsageNotesPanel notes={usageNotes} />
          </div>
        )}

        <nav className="pointer-events-auto fixed right-6 bottom-6 left-6 z-50 flex items-center justify-around rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-2 shadow-2xl backdrop-blur-xl md:hidden">
          {TAB_ITEMS.map(({ tab, mobileLabel, icon: Icon }) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl px-3 py-1 text-[10px] font-bold",
                activeTab === tab
                  ? "bg-emerald-100 text-emerald-700"
                  : "text-zinc-500",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="mt-1">{mobileLabel}</span>
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}
