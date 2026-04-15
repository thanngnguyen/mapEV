import { NextRequest, NextResponse } from "next/server";

import { generateStationsAroundUser } from "@/lib/ev-stations";
import type {
  ChargerStandard,
  ChargingPole,
  ChargingStation,
  Coordinates,
} from "@/types/ev-map";

type OpenChargeMapResponseItem = {
  ID?: number;
  UUID?: string;
  UsageCost?: string | null;
  NumberOfPoints?: number;
  StatusType?: {
    IsOperational?: boolean;
    Title?: string;
  };
  AddressInfo?: {
    Title?: string;
    AddressLine1?: string;
    Town?: string;
    StateOrProvince?: string;
    Latitude?: number;
    Longitude?: number;
  };
  Connections?: Array<{
    Quantity?: number;
    PowerKW?: number;
    ConnectionType?: {
      Title?: string;
    };
  }>;
};

type StationsApiResponse = {
  source: "openchargemap" | "mock-fallback";
  stations: ChargingStation[];
  warning?: string;
};

const OPENCHARGEMAP_BASE_URL = "https://api.openchargemap.io/v3/poi";
const DEFAULT_SEARCH_RADIUS_KM = 12;
const DEFAULT_MAX_RESULTS = 24;
const MAX_ALLOWED_RESULTS = 60;

export const dynamic = "force-dynamic";

function toNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveStandard(connectionTitle?: string): ChargerStandard {
  const title = connectionTitle?.toLowerCase() ?? "";

  if (title.includes("ccs")) {
    return "CCS2";
  }

  if (title.includes("gb")) {
    return "GB/T";
  }

  if (title.includes("nacs") || title.includes("tesla")) {
    return "NACS";
  }

  return "Type2";
}

function resolvePoleStatus(
  isOperational: boolean | undefined,
  statusTitle: string | undefined,
): "available" | "busy" | "offline" {
  if (isOperational === false) {
    return "offline";
  }

  const normalizedTitle = statusTitle?.toLowerCase() ?? "";

  if (
    normalizedTitle.includes("offline") ||
    normalizedTitle.includes("out of service") ||
    normalizedTitle.includes("decommissioned")
  ) {
    return "offline";
  }

  if (
    normalizedTitle.includes("busy") ||
    normalizedTitle.includes("occupied")
  ) {
    return "busy";
  }

  return "available";
}

function inferPricePerKwh(
  usageCost: string | null | undefined,
  maxPowerW: number,
): number {
  if (!usageCost) {
    if (maxPowerW >= 150_000) return 4_200;
    if (maxPowerW >= 100_000) return 3_800;
    return 3_500;
  }

  const normalized = usageCost.toLowerCase();
  if (normalized.includes("free")) {
    return 0;
  }

  const matchedNumber = normalized.match(/(\d+(?:[.,]\d+)?)/);
  if (!matchedNumber) {
    return 3_700;
  }

  const parsedValue = Number(matchedNumber[1].replace(",", "."));
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return 3_700;
  }

  if (normalized.includes("vnd") || normalized.includes("đ")) {
    return Math.round(parsedValue);
  }

  // Keep the same project pricing convention where price is converted to USD in UI.
  if (
    normalized.includes("$") ||
    normalized.includes("usd") ||
    parsedValue < 500
  ) {
    return Math.round(parsedValue * 11_000);
  }

  return Math.round(parsedValue);
}

function resolveConnectionPowerW(powerKw: number | undefined): number {
  if (!Number.isFinite(powerKw) || (powerKw ?? 0) <= 0) {
    return 22_000;
  }

  return Math.round((powerKw as number) * 1000);
}

function normalizeStation(
  item: OpenChargeMapResponseItem,
): ChargingStation | null {
  const latitude = item.AddressInfo?.Latitude;
  const longitude = item.AddressInfo?.Longitude;

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude === undefined ||
    longitude === undefined
  ) {
    return null;
  }

  const stationId =
    item.UUID?.trim() || (item.ID !== undefined ? `ocm-${item.ID}` : null);

  if (!stationId) {
    return null;
  }

  const stationName = item.AddressInfo?.Title?.trim() || `Station ${stationId}`;

  const address = [
    item.AddressInfo?.AddressLine1,
    item.AddressInfo?.Town,
    item.AddressInfo?.StateOrProvince,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(", ");

  const status = resolvePoleStatus(
    item.StatusType?.IsOperational,
    item.StatusType?.Title,
  );

  const poles: ChargingPole[] = [];
  const connections = item.Connections ?? [];

  for (const connection of connections) {
    const quantity = clamp(Math.round(connection.Quantity ?? 1), 1, 8);
    const powerW = resolveConnectionPowerW(connection.PowerKW);
    const standard = resolveStandard(connection.ConnectionType?.Title);

    for (let index = 0; index < quantity; index += 1) {
      const poleId = `${stationId}-pole-${poles.length + 1}`;
      poles.push({
        id: poleId,
        powerW,
        standard,
        status,
      });
    }
  }

  const declaredPoints = clamp(Math.round(item.NumberOfPoints ?? 1), 1, 20);
  if (poles.length === 0) {
    for (let index = 0; index < declaredPoints; index += 1) {
      poles.push({
        id: `${stationId}-pole-${index + 1}`,
        powerW: 22_000,
        standard: "Type2",
        status,
      });
    }
  }

  if (poles.length < declaredPoints) {
    const missingCount = declaredPoints - poles.length;
    const templatePole = poles[0];
    for (let index = 0; index < missingCount; index += 1) {
      poles.push({
        ...templatePole,
        id: `${stationId}-pole-${poles.length + 1}`,
      });
    }
  }

  const maxPowerW = poles.reduce((maxPower, pole) => {
    return Math.max(maxPower, pole.powerW);
  }, 22_000);

  return {
    id: stationId,
    name: stationName,
    address: address || "Unknown address",
    coordinates: [longitude, latitude],
    pricePerKwh: inferPricePerKwh(item.UsageCost, maxPowerW),
    poles,
  };
}

function buildFallbackStationsResponse(
  origin: Coordinates,
  warning: string,
): NextResponse<StationsApiResponse> {
  return NextResponse.json({
    source: "mock-fallback",
    stations: generateStationsAroundUser(origin),
    warning,
  });
}

export async function GET(request: NextRequest) {
  const lat = toNumber(request.nextUrl.searchParams.get("lat"));
  const lng = toNumber(request.nextUrl.searchParams.get("lng"));

  if (lat === null || lng === null) {
    return NextResponse.json(
      { error: "Missing or invalid lat/lng query params" },
      { status: 400 },
    );
  }

  const origin: Coordinates = [lng, lat];

  const radiusFromQuery = toNumber(
    request.nextUrl.searchParams.get("radiusKm"),
  );
  const maxResultsFromQuery = toNumber(
    request.nextUrl.searchParams.get("maxResults"),
  );

  const radiusKm = clamp(
    radiusFromQuery ??
      Number(
        process.env.NEXT_PUBLIC_STATION_SEARCH_RADIUS_KM ??
          DEFAULT_SEARCH_RADIUS_KM,
      ),
    1,
    100,
  );

  const maxResults = clamp(
    Math.round(
      maxResultsFromQuery ??
        Number(
          process.env.NEXT_PUBLIC_STATION_MAX_RESULTS ?? DEFAULT_MAX_RESULTS,
        ),
    ),
    1,
    MAX_ALLOWED_RESULTS,
  );

  const params = new URLSearchParams({
    output: "json",
    compact: "true",
    verbose: "false",
    latitude: String(lat),
    longitude: String(lng),
    distance: String(radiusKm),
    distanceunit: "KM",
    maxresults: String(maxResults),
  });

  const apiKey =
    process.env.OPENCHARGEMAP_API_KEY ??
    process.env.NEXT_PUBLIC_OPENCHARGEMAP_API_KEY;

  if (!apiKey) {
    return buildFallbackStationsResponse(
      origin,
      "Missing OPENCHARGEMAP_API_KEY. Returning local fallback stations.",
    );
  }

  params.set("key", apiKey);

  try {
    const response = await fetch(
      `${OPENCHARGEMAP_BASE_URL}?${params.toString()}`,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          "X-API-Key": apiKey,
        },
      },
    );

    if (!response.ok) {
      return buildFallbackStationsResponse(
        origin,
        `OpenChargeMap request failed (${response.status}). Returning local fallback stations.`,
      );
    }

    const payload = (await response.json()) as unknown;

    if (!Array.isArray(payload)) {
      return buildFallbackStationsResponse(
        origin,
        "OpenChargeMap returned invalid payload. Returning local fallback stations.",
      );
    }

    const stations = payload
      .map((item) => normalizeStation(item as OpenChargeMapResponseItem))
      .filter((station): station is ChargingStation => station !== null);

    if (stations.length === 0) {
      return buildFallbackStationsResponse(
        origin,
        "OpenChargeMap returned no stations. Returning local fallback stations.",
      );
    }

    const body: StationsApiResponse = {
      source: "openchargemap",
      stations,
    };

    return NextResponse.json(body);
  } catch {
    return buildFallbackStationsResponse(
      origin,
      "OpenChargeMap is unreachable. Returning local fallback stations.",
    );
  }
}
