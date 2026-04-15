"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  findNearestStation,
  generateStationsAroundUser,
  buildStationViews,
} from "@/lib/ev-stations";
import { fetchRealChargingStations } from "@/lib/ev-station-api";
import { planOptimalRoute, planRouteFromMapApi } from "@/lib/ev-routing";
import { usageNotes } from "@/lib/usage-notes";
import { useUserLocation } from "@/hooks/use-user-location";
import type {
  ChargingStation,
  ChargingStationView,
  Coordinates,
  EvTab,
  RoutePlan,
  VehicleType,
} from "@/types/ev-map";

type UseEvMapResult = {
  userCoordinates: Coordinates;
  activeTab: EvTab;
  setActiveTab: (nextTab: EvTab) => void;
  searchText: string;
  setSearchText: (value: string) => void;
  vehicleType: VehicleType;
  setVehicleType: (vehicleType: VehicleType) => void;
  stations: ChargingStationView[];
  filteredStations: ChargingStationView[];
  nearestStation: ChargingStationView | null;
  selectedStation: ChargingStationView | null;
  selectStation: (stationId: string) => void;
  routePlan: RoutePlan | null;
  locationError: string | null;
  isLocating: boolean;
  navigationActive: boolean;
  arrivedAtStation: boolean;
  refreshLocation: () => void;
  startRealtimeNavigation: () => void;
  stopRealtimeNavigation: () => void;
  usageNotes: typeof usageNotes;
};

const ARRIVAL_STOP_DISTANCE_METERS = 45;
const MAX_STATIONS_FOR_SHORTEST_ROUTE_SCAN = 6;
const SHORTEST_ROUTE_SCAN_DEBOUNCE_MS = 350;
const ROUTE_SCORE_CACHE_TTL_MS = 2 * 60 * 1000;

type ApiRouteState = {
  signature: string;
  routePlan: RoutePlan | null;
};

type RouteScoreCacheEntry = {
  score: number;
  cachedAt: number;
};

function toCoordinateSignature([lng, lat]: Coordinates): string {
  return `${lng.toFixed(4)},${lat.toFixed(4)}`;
}

function buildRouteScoreCacheKey(
  vehicleType: VehicleType,
  origin: Coordinates,
  stationId: string,
  destination: Coordinates,
): string {
  return [
    vehicleType,
    toCoordinateSignature(origin),
    stationId,
    toCoordinateSignature(destination),
  ].join("|");
}

const SHOULD_FETCH_REAL_STATIONS =
  process.env.NEXT_PUBLIC_STATION_DATA_PROVIDER?.toLowerCase() !== "mock";

export function useEvMap(): UseEvMapResult {
  const [activeTab, setActiveTab] = useState<EvTab>("map");
  const [vehicleType, setVehicleType] =
    useState<VehicleType>("electric-motorbike");
  const [searchText, setSearchText] = useState("");
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );
  const [arrivedAtStation, setArrivedAtStation] = useState(false);
  const [apiRouteState, setApiRouteState] = useState<ApiRouteState>({
    signature: "",
    routePlan: null,
  });
  const [realStations, setRealStations] = useState<ChargingStation[]>([]);
  const [stationApiError, setStationApiError] = useState(false);
  const [shortestRouteStationId, setShortestRouteStationId] = useState<
    string | null
  >(null);
  const routeScoreCacheRef = useRef<Map<string, RouteScoreCacheEntry>>(
    new Map(),
  );

  const {
    location,
    stationAnchor,
    error: locationError,
    isLocating,
    isRealtimeTracking,
    refresh: refreshLocation,
    startRealtimeTracking,
    stopRealtimeTracking,
  } = useUserLocation();

  const fallbackStations = useMemo(() => {
    return generateStationsAroundUser(stationAnchor.coordinates);
  }, [stationAnchor.coordinates]);

  const stationRequestSignature = useMemo(() => {
    const [lng, lat] = stationAnchor.coordinates;
    return `${lng.toFixed(5)},${lat.toFixed(5)}`;
  }, [stationAnchor.coordinates]);

  useEffect(() => {
    if (!SHOULD_FETCH_REAL_STATIONS) {
      return;
    }

    const abortController = new AbortController();
    let cancelled = false;

    const timerId = window.setTimeout(async () => {
      try {
        const stationsFromApi = await fetchRealChargingStations(
          stationAnchor.coordinates,
          { signal: abortController.signal },
        );

        if (cancelled) {
          return;
        }

        setRealStations(stationsFromApi);
        setStationApiError(false);
      } catch {
        if (cancelled || abortController.signal.aborted) {
          return;
        }

        setStationApiError(true);
      }
    }, 0);

    return () => {
      cancelled = true;
      abortController.abort();
      window.clearTimeout(timerId);
    };
  }, [stationAnchor.coordinates, stationRequestSignature]);

  const sourceStations = useMemo(() => {
    if (SHOULD_FETCH_REAL_STATIONS && !stationApiError) {
      return realStations;
    }

    return fallbackStations;
  }, [fallbackStations, realStations, stationApiError]);

  const stations = useMemo(() => {
    return buildStationViews(sourceStations, location.coordinates);
  }, [location.coordinates, sourceStations]);

  const routeStationCandidates = useMemo(() => {
    return stations.slice(0, MAX_STATIONS_FOR_SHORTEST_ROUTE_SCAN);
  }, [stations]);

  const shortestRouteScanSignature = useMemo(() => {
    const [lng, lat] = location.coordinates;

    return [
      vehicleType,
      `${lng.toFixed(4)},${lat.toFixed(4)}`,
      routeStationCandidates.map((station) => station.id).join("|"),
    ].join("#");
  }, [location.coordinates, routeStationCandidates, vehicleType]);

  useEffect(() => {
    if (selectedStationId) {
      return;
    }

    if (routeStationCandidates.length < 2) {
      return;
    }

    const abortController = new AbortController();
    let cancelled = false;

    const pruneExpiredCacheEntries = () => {
      const now = Date.now();

      for (const [key, entry] of routeScoreCacheRef.current.entries()) {
        if (now - entry.cachedAt > ROUTE_SCORE_CACHE_TTL_MS) {
          routeScoreCacheRef.current.delete(key);
        }
      }
    };

    const timerId = window.setTimeout(async () => {
      pruneExpiredCacheEntries();

      let bestStationId: string | null = null;
      let bestStationScore = Number.POSITIVE_INFINITY;

      for (const station of routeStationCandidates) {
        const cacheKey = buildRouteScoreCacheKey(
          vehicleType,
          location.coordinates,
          station.id,
          station.coordinates,
        );
        const cachedScore = routeScoreCacheRef.current.get(cacheKey);

        if (cachedScore) {
          if (cachedScore.score < bestStationScore) {
            bestStationScore = cachedScore.score;
            bestStationId = station.id;
          }

          continue;
        }

        try {
          const plannedRoute = await planRouteFromMapApi(
            station.id,
            vehicleType,
            location.coordinates,
            station.coordinates,
            { signal: abortController.signal },
          );

          if (cancelled) {
            return;
          }

          const score =
            plannedRoute.optimizationScore ?? plannedRoute.durationMinutes;

          routeScoreCacheRef.current.set(cacheKey, {
            score,
            cachedAt: Date.now(),
          });

          if (score < bestStationScore) {
            bestStationScore = score;
            bestStationId = station.id;
          }
        } catch {
          if (cancelled || abortController.signal.aborted) {
            return;
          }
        }
      }

      if (cancelled) {
        return;
      }

      setShortestRouteStationId(
        bestStationId ?? routeStationCandidates[0]?.id ?? null,
      );
    }, SHORTEST_ROUTE_SCAN_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      abortController.abort();
      window.clearTimeout(timerId);
    };
  }, [
    location.coordinates,
    routeStationCandidates,
    selectedStationId,
    shortestRouteScanSignature,
    vehicleType,
  ]);

  const nearestStation = useMemo(() => {
    if (!shortestRouteStationId) {
      return findNearestStation(stations) ?? null;
    }

    return (
      stations.find((station) => station.id === shortestRouteStationId) ??
      findNearestStation(stations) ??
      null
    );
  }, [shortestRouteStationId, stations]);

  const resolvedSelectedStationId = useMemo(() => {
    if (
      selectedStationId &&
      stations.some((station) => station.id === selectedStationId)
    ) {
      return selectedStationId;
    }

    return nearestStation?.id ?? null;
  }, [nearestStation, selectedStationId, stations]);

  const filteredStations = useMemo(() => {
    if (!searchText.trim()) {
      return stations;
    }

    const query = searchText.trim().toLowerCase();
    return stations.filter((station) => {
      return (
        station.name.toLowerCase().includes(query) ||
        station.address.toLowerCase().includes(query)
      );
    });
  }, [searchText, stations]);

  const selectedStation = useMemo(() => {
    if (!resolvedSelectedStationId) {
      return nearestStation;
    }

    return (
      stations.find((station) => station.id === resolvedSelectedStationId) ??
      nearestStation
    );
  }, [nearestStation, resolvedSelectedStationId, stations]);

  const fallbackRoutePlan = useMemo(() => {
    if (!selectedStation) {
      return null;
    }

    return planOptimalRoute(
      selectedStation.id,
      vehicleType,
      location.coordinates,
      selectedStation.coordinates,
    );
  }, [location.coordinates, selectedStation, vehicleType]);

  const routeRequestSignature = useMemo(() => {
    if (!selectedStation) {
      return "";
    }

    const [originLng, originLat] = location.coordinates;
    const [destinationLng, destinationLat] = selectedStation.coordinates;

    return [
      selectedStation.id,
      vehicleType,
      `${originLng.toFixed(5)},${originLat.toFixed(5)}`,
      `${destinationLng.toFixed(5)},${destinationLat.toFixed(5)}`,
    ].join("|");
  }, [location.coordinates, selectedStation, vehicleType]);

  useEffect(() => {
    if (!selectedStation || !routeRequestSignature) {
      return;
    }

    const abortController = new AbortController();
    let cancelled = false;

    const timerId = window.setTimeout(async () => {
      try {
        const routeFromApi = await planRouteFromMapApi(
          selectedStation.id,
          vehicleType,
          location.coordinates,
          selectedStation.coordinates,
          { signal: abortController.signal },
        );

        if (cancelled) {
          return;
        }

        setApiRouteState({
          signature: routeRequestSignature,
          routePlan: routeFromApi,
        });
      } catch {
        if (cancelled || abortController.signal.aborted) {
          return;
        }

        setApiRouteState((current) => {
          if (
            current.signature === routeRequestSignature &&
            current.routePlan === null
          ) {
            return current;
          }

          return {
            signature: routeRequestSignature,
            routePlan: null,
          };
        });
      }
    }, 0);

    return () => {
      cancelled = true;
      abortController.abort();
      window.clearTimeout(timerId);
    };
  }, [
    location.coordinates,
    routeRequestSignature,
    selectedStation,
    vehicleType,
  ]);

  const routePlan = useMemo(() => {
    if (!selectedStation || !fallbackRoutePlan) {
      return null;
    }

    if (
      apiRouteState.signature === routeRequestSignature &&
      apiRouteState.routePlan
    ) {
      return apiRouteState.routePlan;
    }

    return fallbackRoutePlan;
  }, [
    apiRouteState.routePlan,
    apiRouteState.signature,
    fallbackRoutePlan,
    routeRequestSignature,
    selectedStation,
  ]);

  const selectStation = useCallback((stationId: string) => {
    setSelectedStationId(stationId);
    setArrivedAtStation(false);
  }, []);

  const startRealtimeNavigation = useCallback(() => {
    setArrivedAtStation(false);
    startRealtimeTracking();
  }, [startRealtimeTracking]);

  const stopRealtimeNavigation = useCallback(() => {
    stopRealtimeTracking();
  }, [stopRealtimeTracking]);

  useEffect(() => {
    if (!isRealtimeTracking || !selectedStation || arrivedAtStation) {
      return;
    }

    if (selectedStation.distanceMeters > ARRIVAL_STOP_DISTANCE_METERS) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setArrivedAtStation(true);
      stopRealtimeTracking();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    arrivedAtStation,
    isRealtimeTracking,
    selectedStation,
    stopRealtimeTracking,
  ]);

  return {
    userCoordinates: location.coordinates,
    activeTab,
    setActiveTab,
    searchText,
    setSearchText,
    vehicleType,
    setVehicleType,
    stations,
    filteredStations,
    nearestStation,
    selectedStation,
    selectStation,
    routePlan,
    locationError,
    isLocating,
    navigationActive: isRealtimeTracking,
    arrivedAtStation,
    refreshLocation,
    startRealtimeNavigation,
    stopRealtimeNavigation,
    usageNotes,
  };
}
