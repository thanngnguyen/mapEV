import {
  destinationFrom,
  haversineDistanceMeters,
  segmentBearingDegrees,
} from "@/lib/geo";
import type {
  ChargerStatus,
  ChargerStandard,
  ChargingPole,
  ChargingStation,
  ChargingStationView,
  Coordinates,
} from "@/types/ev-map";

type StationBlueprint = {
  name: string;
  district: string;
  basePowerW: number;
  poleCount: number;
  pricePerKwh: number;
};

const STATION_BLUEPRINTS: StationBlueprint[] = [
  {
    name: "GreenPulse Hub",
    district: "District 1",
    basePowerW: 90_000,
    poleCount: 10,
    pricePerKwh: 3_600,
  },
  {
    name: "VoltCore Station",
    district: "District 3",
    basePowerW: 120_000,
    poleCount: 8,
    pricePerKwh: 3_500,
  },
  {
    name: "NovaCharge Dock",
    district: "District 7",
    basePowerW: 150_000,
    poleCount: 12,
    pricePerKwh: 3_900,
  },
  {
    name: "EcoLane Point",
    district: "Binh Thanh",
    basePowerW: 60_000,
    poleCount: 6,
    pricePerKwh: 3_300,
  },
  {
    name: "HyperEV Plaza",
    district: "Thu Duc",
    basePowerW: 180_000,
    poleCount: 14,
    pricePerKwh: 4_200,
  },
  {
    name: "LumiCharge Stop",
    district: "Phu Nhuan",
    basePowerW: 75_000,
    poleCount: 8,
    pricePerKwh: 3_450,
  },
  {
    name: "BlueCurrent Base",
    district: "District 10",
    basePowerW: 100_000,
    poleCount: 9,
    pricePerKwh: 3_700,
  },
  {
    name: "UrbanEV Nexus",
    district: "Go Vap",
    basePowerW: 130_000,
    poleCount: 7,
    pricePerKwh: 3_550,
  },
];

const STATION_RING_METERS = [
  620, 840, 1_050, 1_180, 1_420, 1_650, 1_920, 2_150,
];
const BEARING_VARIANTS = [12, 52, 94, 148, 201, 244, 292, 331];
const STREET_PREFIXES = [
  "Nguyen Hue",
  "Le Loi",
  "Ham Nghi",
  "Cach Mang Thang 8",
  "Vo Van Kiet",
  "Pham Van Dong",
  "Dien Bien Phu",
  "Nguyen Van Cu",
];

const CONNECTOR_STANDARDS: ChargerStandard[] = [
  "CCS2",
  "Type2",
  "GB/T",
  "NACS",
];
const STATUS_PATTERN: ChargerStatus[] = [
  "available",
  "available",
  "busy",
  "available",
  "busy",
  "offline",
  "available",
  "busy",
];

function buildPoles(
  stationId: string,
  basePowerW: number,
  poleCount: number,
): ChargingPole[] {
  const poles: ChargingPole[] = [];

  for (let index = 0; index < poleCount; index += 1) {
    const powerStep = (index % 4) * 20_000;
    poles.push({
      id: `${stationId}-pole-${index + 1}`,
      powerW: basePowerW + powerStep,
      standard: CONNECTOR_STANDARDS[index % CONNECTOR_STANDARDS.length],
      status:
        STATUS_PATTERN[(index + stationId.length) % STATUS_PATTERN.length],
    });
  }

  if (!poles.some((pole) => pole.status === "available")) {
    poles[0] = { ...poles[0], status: "available" };
  }

  return poles;
}

export function generateStationsAroundUser(
  origin: Coordinates,
): ChargingStation[] {
  return STATION_BLUEPRINTS.map((blueprint, index) => {
    const bearing = normalizeBearing(
      BEARING_VARIANTS[index % BEARING_VARIANTS.length] +
        segmentBearingDegrees(origin, [origin[0] + 0.01, origin[1] + 0.01]),
    );

    const coordinates = destinationFrom(
      origin,
      STATION_RING_METERS[index % STATION_RING_METERS.length],
      bearing,
    );

    const id = `station-${index + 1}`;

    return {
      id,
      name: blueprint.name,
      address: `${STREET_PREFIXES[index % STREET_PREFIXES.length]} - ${blueprint.district}`,
      coordinates,
      pricePerKwh: blueprint.pricePerKwh,
      poles: buildPoles(id, blueprint.basePowerW, blueprint.poleCount),
    };
  });
}

function normalizeBearing(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function toChargingStationView(
  station: ChargingStation,
  userCoordinates: Coordinates,
): ChargingStationView {
  const availablePoles = station.poles.filter(
    (pole) => pole.status === "available",
  ).length;
  const busyPoles = station.poles.filter(
    (pole) => pole.status === "busy",
  ).length;
  const offlinePoles = station.poles.filter(
    (pole) => pole.status === "offline",
  ).length;

  return {
    ...station,
    distanceMeters: haversineDistanceMeters(
      userCoordinates,
      station.coordinates,
    ),
    availablePoles,
    busyPoles,
    offlinePoles,
    totalPoles: station.poles.length,
    maxPowerW: station.poles.reduce(
      (maxPower, pole) => Math.max(maxPower, pole.powerW),
      0,
    ),
  };
}

export function buildStationViews(
  stations: ChargingStation[],
  userCoordinates: Coordinates,
): ChargingStationView[] {
  return stations
    .map((station) => toChargingStationView(station, userCoordinates))
    .sort((first, second) => first.distanceMeters - second.distanceMeters);
}

export function findNearestStation(
  stations: ChargingStationView[],
): ChargingStationView | undefined {
  return stations[0];
}
