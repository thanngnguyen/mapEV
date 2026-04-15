export type Coordinates = [longitude: number, latitude: number];

export type VehicleType = "electric-motorbike" | "electric-car";

export type VehicleProfile = {
  type: VehicleType;
  label: string;
  averageSpeedKmh: number;
  turnPenaltyMinutes: number;
};

export type ChargerStandard = "CCS2" | "Type2" | "GB/T" | "NACS";

export type ChargerStatus = "available" | "busy" | "offline";

export type ChargingPole = {
  id: string;
  powerW: number;
  standard: ChargerStandard;
  status: ChargerStatus;
};

export type ChargingStation = {
  id: string;
  name: string;
  address: string;
  coordinates: Coordinates;
  pricePerKwh: number;
  poles: ChargingPole[];
};

export type ChargingStationView = ChargingStation & {
  distanceMeters: number;
  availablePoles: number;
  busyPoles: number;
  offlinePoles: number;
  totalPoles: number;
  maxPowerW: number;
};

export type UserLocationSource = "browser" | "fallback";

export type UserLocation = {
  coordinates: Coordinates;
  source: UserLocationSource;
  label: string;
};

export type RouteCandidateName = "arterial" | "balanced" | "shortcut";

export type RouteStep = {
  id: string;
  instruction: string;
  distanceMeters: number;
  durationMinutes: number;
};

export type RoutePlan = {
  stationId: string;
  vehicleType: VehicleType;
  candidate: RouteCandidateName;
  coordinates: Coordinates[];
  distanceMeters: number;
  durationMinutes: number;
  optimizationScore?: number;
  averageTrafficFactor?: number;
  steps: RouteStep[];
};

export type UsageNote = {
  id: string;
  title: string;
  description: string;
};

export type EvTab = "map" | "route" | "station" | "notes";
