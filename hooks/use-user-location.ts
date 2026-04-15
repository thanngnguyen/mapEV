"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { UserLocation } from "@/types/ev-map";

const FALLBACK_LOCATION: UserLocation = {
  coordinates: [106.70098, 10.77689],
  source: "fallback",
  label: "Fallback location",
};

type UseUserLocationResult = {
  location: UserLocation;
  stationAnchor: UserLocation;
  isLocating: boolean;
  isRealtimeTracking: boolean;
  error: string | null;
  refresh: () => void;
  startRealtimeTracking: () => void;
  stopRealtimeTracking: () => void;
};

export function useUserLocation(): UseUserLocationResult {
  const [location, setLocation] = useState<UserLocation>(FALLBACK_LOCATION);
  const [stationAnchor, setStationAnchor] =
    useState<UserLocation>(FALLBACK_LOCATION);
  const [isLocating, setIsLocating] = useState(true);
  const [isRealtimeTracking, setIsRealtimeTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const detectLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocation(FALLBACK_LOCATION);
      setError("Geolocation is not available. Fallback location is used.");
      setIsLocating(false);
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation: UserLocation = {
          coordinates: [position.coords.longitude, position.coords.latitude],
          source: "browser",
          label: "Your current location",
        };

        setLocation(nextLocation);
        setStationAnchor((currentAnchor) =>
          currentAnchor.source === "fallback" ? nextLocation : currentAnchor,
        );
        setError(null);
        setIsLocating(false);
      },
      () => {
        setLocation(FALLBACK_LOCATION);
        setError("Unable to access your location. Fallback location is used.");
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 8_000,
      },
    );
  }, []);

  const stopRealtimeTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsRealtimeTracking(false);
  }, []);

  const startRealtimeTracking = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation is not available. Realtime guidance cannot start.");
      setIsRealtimeTracking(false);
      return;
    }

    if (watchIdRef.current !== null) {
      return;
    }

    setIsLocating(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation: UserLocation = {
          coordinates: [position.coords.longitude, position.coords.latitude],
          source: "browser",
          label: "Your current location",
        };

        setLocation(nextLocation);
        setStationAnchor((currentAnchor) =>
          currentAnchor.source === "fallback" ? nextLocation : currentAnchor,
        );
        setError(null);
        setIsLocating(false);
        setIsRealtimeTracking(true);
      },
      () => {
        setError("Unable to keep realtime location updates.");
        setIsLocating(false);
        setIsRealtimeTracking(false);

        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10_000,
      },
    );
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      detectLocation();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [detectLocation]);

  return {
    location,
    stationAnchor,
    isLocating,
    isRealtimeTracking,
    error,
    refresh: detectLocation,
    startRealtimeTracking,
    stopRealtimeTracking,
  };
}
