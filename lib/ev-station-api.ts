import type { ChargingStation, Coordinates } from "@/types/ev-map";

type StationDataProvider = "openchargemap" | "mock";

type ChargingStationsApiResponse = {
  source: "openchargemap" | "serpapi" | "hybrid" | "mock-fallback";
  stations: ChargingStation[];
  warning?: string;
};

type FetchRealChargingStationsOptions = {
  signal?: AbortSignal;
  radiusKm?: number;
  maxResults?: number;
};

function getStationDataProvider(): StationDataProvider {
  const configuredProvider =
    process.env.NEXT_PUBLIC_STATION_DATA_PROVIDER?.toLowerCase();

  if (configuredProvider === "mock") {
    return "mock";
  }

  return "openchargemap";
}

export async function fetchRealChargingStations(
  origin: Coordinates,
  options: FetchRealChargingStationsOptions = {},
): Promise<ChargingStation[]> {
  if (getStationDataProvider() === "mock") {
    return [];
  }

  const [lng, lat] = origin;

  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  });

  if (options.radiusKm !== undefined) {
    params.set("radiusKm", String(options.radiusKm));
  }

  if (options.maxResults !== undefined) {
    params.set("maxResults", String(options.maxResults));
  }

  const response = await fetch(`/api/charging-stations?${params.toString()}`, {
    method: "GET",
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(
      `Charging station API failed with status ${response.status}`,
    );
  }

  const payload = (await response.json()) as ChargingStationsApiResponse;

  if (!Array.isArray(payload.stations)) {
    throw new Error("Charging station API returned invalid payload");
  }

  return payload.stations;
}
