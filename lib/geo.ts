import type { Coordinates } from "@/types/ev-map";

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

export function normalizeBearingDegrees(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function haversineDistanceMeters(
  start: Coordinates,
  end: Coordinates,
): number {
  const [lng1, lat1] = start;
  const [lng2, lat2] = end;

  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const startLatRadians = toRadians(lat1);
  const endLatRadians = toRadians(lat2);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(startLatRadians) *
      Math.cos(endLatRadians) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export function destinationFrom(
  origin: Coordinates,
  distanceMeters: number,
  bearingDegrees: number,
): Coordinates {
  const [lng, lat] = origin;
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearing = toRadians(bearingDegrees);

  const latRadians = toRadians(lat);
  const lngRadians = toRadians(lng);

  const destinationLat = Math.asin(
    Math.sin(latRadians) * Math.cos(angularDistance) +
      Math.cos(latRadians) * Math.sin(angularDistance) * Math.cos(bearing),
  );

  const destinationLng =
    lngRadians +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRadians),
      Math.cos(angularDistance) -
        Math.sin(latRadians) * Math.sin(destinationLat),
    );

  return [toDegrees(destinationLng), toDegrees(destinationLat)];
}

export function interpolateCoordinates(
  start: Coordinates,
  end: Coordinates,
  ratio: number,
): Coordinates {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  return [
    start[0] + (end[0] - start[0]) * clampedRatio,
    start[1] + (end[1] - start[1]) * clampedRatio,
  ];
}

export function segmentBearingDegrees(
  start: Coordinates,
  end: Coordinates,
): number {
  const [lng1, lat1] = start;
  const [lng2, lat2] = end;

  const lngDelta = toRadians(lng2 - lng1);
  const lat1Radians = toRadians(lat1);
  const lat2Radians = toRadians(lat2);

  const y = Math.sin(lngDelta) * Math.cos(lat2Radians);
  const x =
    Math.cos(lat1Radians) * Math.sin(lat2Radians) -
    Math.sin(lat1Radians) * Math.cos(lat2Radians) * Math.cos(lngDelta);

  return normalizeBearingDegrees(toDegrees(Math.atan2(y, x)));
}

export function turnAngleDegrees(
  previous: Coordinates,
  current: Coordinates,
  next: Coordinates,
): number {
  const firstBearing = segmentBearingDegrees(previous, current);
  const secondBearing = segmentBearingDegrees(current, next);
  const delta = Math.abs(firstBearing - secondBearing);
  return delta > 180 ? 360 - delta : delta;
}

export function directionFromBearing(bearingDegrees: number): string {
  const normalized = normalizeBearingDegrees(bearingDegrees);
  if (normalized < 22.5 || normalized >= 337.5) return "north";
  if (normalized < 67.5) return "north-east";
  if (normalized < 112.5) return "east";
  if (normalized < 157.5) return "south-east";
  if (normalized < 202.5) return "south";
  if (normalized < 247.5) return "south-west";
  if (normalized < 292.5) return "west";
  return "north-west";
}

export function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

export function formatDuration(durationMinutes: number): string {
  if (durationMinutes < 60) {
    return `${Math.round(durationMinutes)} min`;
  }
  const hours = Math.floor(durationMinutes / 60);
  const minutes = Math.round(durationMinutes % 60);
  return `${hours}h ${minutes}m`;
}
