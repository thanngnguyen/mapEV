import { NextRequest, NextResponse } from "next/server";

import { haversineDistanceMeters } from "@/lib/geo";
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

type SerpApiLocalResult = {
  place_id?: string;
  position?: number;
  title?: string;
  type?: string;
  address?: string;
  description?: string;
  phone?: string;
  hours?: string;
  extensions?: string[];
  gps_coordinates?: {
    latitude?: number;
    longitude?: number;
  };
  links?: {
    website?: string;
    directions?: string;
  };
};

type SerpApiResponse = {
  local_results?: SerpApiLocalResult[];
};

type StationsApiResponse = {
  source: "openchargemap" | "serpapi" | "hybrid" | "mock-fallback";
  stations: ChargingStation[];
  warning?: string;
};

type ProviderId = "openchargemap" | "serpapi";

type ProviderFetchResult = {
  provider: ProviderId;
  succeeded: boolean;
  stations: ChargingStation[];
  warning?: string;
};

const OPENCHARGEMAP_BASE_URL = "https://api.openchargemap.io/v3/poi";
const SERPAPI_BASE_URL = "https://serpapi.com/search.json";
const DEFAULT_SEARCH_RADIUS_KM = 12;
const DEFAULT_MAX_RESULTS = 24;
const MAX_ALLOWED_RESULTS = 60;
const DEFAULT_SERPAPI_QUERY = "tram sac xe dien";
const DEFAULT_SERPAPI_LANGUAGE = "vi";
const DEFAULT_SERPAPI_COUNTRY = "vn";
const DEDUPE_DISTANCE_METERS = 140;

const POSITIVE_CHARGING_KEYWORDS = [
  "tram sac",
  "sac xe dien",
  "charging station",
  "ev charger",
  "ev charging",
  "vinfast",
  "supercharger",
];

const NEGATIVE_CHARGING_KEYWORDS = [
  "rua xe",
  "car wash",
  "detailing",
  "garage",
  "gara",
  "nha nghi",
  "khach san",
  "hotel",
];

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

function normalizeTextForMatching(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function hashStringToId(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function getSerpApiZoomForRadius(radiusKm: number): number {
  if (radiusKm <= 3) return 14;
  if (radiusKm <= 8) return 13;
  if (radiusKm <= 15) return 12;
  if (radiusKm <= 30) return 11;
  if (radiusKm <= 60) return 10;
  return 9;
}

function isLikelyChargingStationFromSerp(result: SerpApiLocalResult): boolean {
  const extensionTexts = Array.isArray(result.extensions)
    ? result.extensions.filter(
        (value): value is string => typeof value === "string",
      )
    : [];

  const searchableText = normalizeTextForMatching(
    [
      result.title,
      result.type,
      result.description,
      result.address,
      ...extensionTexts,
    ]
      .filter((value): value is string => typeof value === "string")
      .join(" "),
  );

  const website = normalizeTextForMatching(result.links?.website ?? "");
  const hasTrustedDomain =
    website.includes("evcs") ||
    website.includes("vinfast") ||
    website.includes("charge") ||
    website.includes("charger");

  const hasPositiveKeyword = POSITIVE_CHARGING_KEYWORDS.some((keyword) =>
    searchableText.includes(keyword),
  );
  const hasNegativeKeyword = NEGATIVE_CHARGING_KEYWORDS.some((keyword) =>
    searchableText.includes(keyword),
  );

  if (hasNegativeKeyword && !hasTrustedDomain) {
    return false;
  }

  return hasPositiveKeyword || hasTrustedDomain;
}

function resolveSerpPowerW(extensions: string[]): number {
  for (const extension of extensions) {
    const matchedPower = extension.match(/(\d+(?:[.,]\d+)?)\s*kW/i);
    if (!matchedPower) {
      continue;
    }

    const powerKw = Number(matchedPower[1].replace(",", "."));
    return resolveConnectionPowerW(powerKw);
  }

  return 22_000;
}

function resolveSerpPoleCount(extensions: string[]): number {
  for (const extension of extensions) {
    const matchedCount = extension.match(
      /(?:tong\s*cong|tổng\s*cộng|total)\s*(\d{1,2})/iu,
    );

    if (!matchedCount) {
      continue;
    }

    const count = Number(matchedCount[1]);
    if (Number.isFinite(count) && count > 0) {
      return clamp(Math.round(count), 1, 20);
    }
  }

  return 2;
}

function normalizeSerpStation(
  result: SerpApiLocalResult,
): ChargingStation | null {
  if (!isLikelyChargingStationFromSerp(result)) {
    return null;
  }

  const latitude = toFiniteNumber(result.gps_coordinates?.latitude);
  const longitude = toFiniteNumber(result.gps_coordinates?.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude === null ||
    longitude === null
  ) {
    return null;
  }

  const name = toNonEmptyString(result.title) ?? "EV Charging Station";
  const address = toNonEmptyString(result.address) ?? "Unknown address";
  const extensions = Array.isArray(result.extensions)
    ? result.extensions.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const powerW = resolveSerpPowerW(extensions);
  const poleCount = resolveSerpPoleCount(extensions);
  const standard = resolveStandard(extensions.join(" "));

  const sourceIdSeed = [
    result.place_id,
    name,
    address,
    longitude.toFixed(5),
    latitude.toFixed(5),
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join("|");
  const stationId = `serp-${hashStringToId(sourceIdSeed)}`;

  const poles: ChargingPole[] = Array.from(
    { length: poleCount },
    (_, index) => ({
      id: `${stationId}-pole-${index + 1}`,
      powerW,
      standard,
      status: "available",
    }),
  );

  return {
    id: stationId,
    name,
    address,
    coordinates: [longitude, latitude],
    pricePerKwh: inferPricePerKwh(null, powerW),
    poles,
  };
}

async function fetchOpenChargeMapStations(
  lat: number,
  lng: number,
  radiusKm: number,
  maxResults: number,
): Promise<ProviderFetchResult> {
  const apiKey =
    process.env.OPENCHARGEMAP_API_KEY ??
    process.env.NEXT_PUBLIC_OPENCHARGEMAP_API_KEY;

  if (!apiKey) {
    return {
      provider: "openchargemap",
      succeeded: false,
      stations: [],
      warning: "Missing OPENCHARGEMAP_API_KEY.",
    };
  }

  const params = new URLSearchParams({
    output: "json",
    compact: "true",
    verbose: "false",
    latitude: String(lat),
    longitude: String(lng),
    distance: String(radiusKm),
    distanceunit: "KM",
    maxresults: String(maxResults),
    key: apiKey,
  });

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
      return {
        provider: "openchargemap",
        succeeded: false,
        stations: [],
        warning: `OpenChargeMap request failed (${response.status}).`,
      };
    }

    const payload = (await response.json()) as unknown;

    if (!Array.isArray(payload)) {
      return {
        provider: "openchargemap",
        succeeded: false,
        stations: [],
        warning: "OpenChargeMap returned invalid payload.",
      };
    }

    return {
      provider: "openchargemap",
      succeeded: true,
      stations: payload
        .map((item) => normalizeStation(item as OpenChargeMapResponseItem))
        .filter((station): station is ChargingStation => station !== null),
    };
  } catch {
    return {
      provider: "openchargemap",
      succeeded: false,
      stations: [],
      warning: "OpenChargeMap is unreachable.",
    };
  }
}

async function fetchSerpApiStations(
  lat: number,
  lng: number,
  radiusKm: number,
  maxResults: number,
): Promise<ProviderFetchResult> {
  const apiKey = process.env.SERPAPI_API_KEY;

  if (!apiKey) {
    return {
      provider: "serpapi",
      succeeded: false,
      stations: [],
      warning: "Missing SERPAPI_API_KEY.",
    };
  }

  const query =
    process.env.SERPAPI_CHARGING_QUERY?.trim() || DEFAULT_SERPAPI_QUERY;
  const language =
    process.env.SERPAPI_LANGUAGE?.trim() || DEFAULT_SERPAPI_LANGUAGE;
  const country =
    process.env.SERPAPI_COUNTRY?.trim() || DEFAULT_SERPAPI_COUNTRY;

  const params = new URLSearchParams({
    engine: "google_maps",
    type: "search",
    q: query,
    ll: `@${lat},${lng},${getSerpApiZoomForRadius(radiusKm)}z`,
    hl: language,
    gl: country,
    no_cache: "true",
    api_key: apiKey,
    num: String(clamp(maxResults, 1, 20)),
  });

  try {
    const response = await fetch(`${SERPAPI_BASE_URL}?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        provider: "serpapi",
        succeeded: false,
        stations: [],
        warning: `SerpApi request failed (${response.status}).`,
      };
    }

    const payload = (await response.json()) as SerpApiResponse;
    const localResults = Array.isArray(payload.local_results)
      ? payload.local_results
      : [];

    return {
      provider: "serpapi",
      succeeded: true,
      stations: localResults
        .map((item) => normalizeSerpStation(item))
        .filter((station): station is ChargingStation => station !== null),
    };
  } catch {
    return {
      provider: "serpapi",
      succeeded: false,
      stations: [],
      warning: "SerpApi is unreachable.",
    };
  }
}

function normalizeStationNameSignature(name: string): string {
  return normalizeTextForMatching(name).replace(/\s+/g, " ").trim();
}

function areLikelyDuplicateStations(
  first: ChargingStation,
  second: ChargingStation,
): boolean {
  const distance = haversineDistanceMeters(
    first.coordinates,
    second.coordinates,
  );

  if (distance > DEDUPE_DISTANCE_METERS) {
    return false;
  }

  const firstName = normalizeStationNameSignature(first.name);
  const secondName = normalizeStationNameSignature(second.name);

  if (!firstName || !secondName) {
    return true;
  }

  return (
    firstName === secondName ||
    firstName.includes(secondName) ||
    secondName.includes(firstName)
  );
}

function mergeAndDedupeStations(
  openChargeMapStations: ChargingStation[],
  serpStations: ChargingStation[],
): ChargingStation[] {
  const mergedStations: ChargingStation[] = [...openChargeMapStations];

  for (const station of serpStations) {
    if (
      mergedStations.some((existing) =>
        areLikelyDuplicateStations(existing, station),
      )
    ) {
      continue;
    }

    mergedStations.push(station);
  }

  return mergedStations;
}

function joinWarnings(warnings: Array<string | undefined>): string | undefined {
  const merged = warnings.filter((warning): warning is string =>
    Boolean(warning),
  );

  if (merged.length === 0) {
    return undefined;
  }

  return merged.join(" ");
}

function getResponseSource(
  openChargeMapResult: ProviderFetchResult,
  serpApiResult: ProviderFetchResult,
): StationsApiResponse["source"] {
  const hasOpenChargeMapStations = openChargeMapResult.stations.length > 0;
  const hasSerpStations = serpApiResult.stations.length > 0;

  if (hasOpenChargeMapStations && hasSerpStations) {
    return "hybrid";
  }

  if (hasOpenChargeMapStations) {
    return "openchargemap";
  }

  if (hasSerpStations) {
    return "serpapi";
  }

  if (openChargeMapResult.succeeded && serpApiResult.succeeded) {
    return "hybrid";
  }

  if (openChargeMapResult.succeeded) {
    return "openchargemap";
  }

  if (serpApiResult.succeeded) {
    return "serpapi";
  }

  return "mock-fallback";
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

  const [openChargeMapResult, serpApiResult] = await Promise.all([
    fetchOpenChargeMapStations(lat, lng, radiusKm, maxResults),
    fetchSerpApiStations(lat, lng, radiusKm, maxResults),
  ]);

  const stations = mergeAndDedupeStations(
    openChargeMapResult.stations,
    serpApiResult.stations,
  );
  const warning = joinWarnings([
    openChargeMapResult.warning,
    serpApiResult.warning,
  ]);
  const source = getResponseSource(openChargeMapResult, serpApiResult);

  if (stations.length > 0) {
    const body: StationsApiResponse = {
      source,
      stations,
    };

    if (warning) {
      body.warning = warning;
    }

    return NextResponse.json(body);
  }

  if (openChargeMapResult.succeeded || serpApiResult.succeeded) {
    return NextResponse.json({
      source,
      stations: [],
      warning: warning ?? "No charging stations were found for this area.",
    } as StationsApiResponse);
  }

  return buildFallbackStationsResponse(
    origin,
    warning ??
      "No external station provider is configured. Returning local fallback stations.",
  );
}
