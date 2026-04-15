import {
  destinationFrom,
  directionFromBearing,
  haversineDistanceMeters,
  interpolateCoordinates,
  segmentBearingDegrees,
  turnAngleDegrees,
} from "@/lib/geo";
import type {
  Coordinates,
  RouteCandidateName,
  RoutePlan,
  RouteStep,
  VehicleProfile,
  VehicleType,
} from "@/types/ev-map";

type OsrmRouteResponse = {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: {
      coordinates: number[][];
    };
    legs?: Array<{
      annotation?: {
        distance?: number[];
        duration?: number[];
      };
      steps?: Array<{
        distance: number;
        duration: number;
        name: string;
        maneuver?: {
          type?: string;
          modifier?: string;
        };
      }>;
    }>;
  }>;
};

type MapboxRouteResponse = {
  code: string;
  message?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: {
      coordinates: number[][];
    };
    legs?: Array<{
      annotation?: {
        distance?: number[];
        duration?: number[];
        duration_typical?: number[];
        congestion_numeric?: number[];
      };
      steps?: Array<{
        distance: number;
        duration: number;
        name?: string;
        maneuver?: {
          type?: string;
          modifier?: string;
          instruction?: string;
        };
      }>;
    }>;
  }>;
};

type ProviderRouteResult = {
  coordinates: Coordinates[];
  distanceMeters: number;
  durationMinutes: number;
  steps: RouteStep[];
  optimizationScore: number;
  averageTrafficFactor: number;
};

type ProviderRouteCandidate = {
  coordinates: Coordinates[];
  distanceMeters: number;
  durationMinutes: number;
  steps: RouteStep[];
  segmentDistancesMeters: number[];
  segmentDurationsMinutes: number[];
  segmentTrafficFactors: number[];
};

type GraphNode = {
  id: string;
  coordinates: Coordinates;
};

type GraphEdge = {
  fromId: string;
  toId: string;
  distanceMeters: number;
  durationMinutes: number;
  trafficFactor: number;
  cost: number;
};

type RouteGraph = {
  nodes: Map<string, GraphNode>;
  adjacency: Map<string, GraphEdge[]>;
};

type AStarPathResult = {
  coordinates: Coordinates[];
  distanceMeters: number;
  durationMinutes: number;
  averageTrafficFactor: number;
  score: number;
};

type RoutingProvider = "osrm" | "mapbox";

type PlanRouteFromMapApiOptions = {
  signal?: AbortSignal;
};

const DEFAULT_OSRM_ROUTING_API_BASE_URL = "https://router.project-osrm.org";
const DEFAULT_MAPBOX_ROUTING_API_BASE_URL = "https://api.mapbox.com";

const A_STAR_DISTANCE_WEIGHT = 0.25;
const A_STAR_TIME_WEIGHT = 1;
const A_STAR_TRAFFIC_PENALTY_WEIGHT = 7;
const GRAPH_NODE_PRECISION = 6;

const VEHICLE_PROFILES: Record<VehicleType, VehicleProfile> = {
  "electric-motorbike": {
    type: "electric-motorbike",
    label: "Electric Motorbike",
    averageSpeedKmh: 32,
    turnPenaltyMinutes: 0.18,
  },
  "electric-car": {
    type: "electric-car",
    label: "Electric Car",
    averageSpeedKmh: 41,
    turnPenaltyMinutes: 0.35,
  },
};

const CANDIDATE_BIAS: Record<
  RouteCandidateName,
  { carPenalty: number; bikePenalty: number }
> = {
  arterial: { carPenalty: 0.4, bikePenalty: 1.1 },
  balanced: { carPenalty: 0.7, bikePenalty: 0.7 },
  shortcut: { carPenalty: 2.1, bikePenalty: 0.3 },
};

function buildCandidateRoute(
  origin: Coordinates,
  destination: Coordinates,
  candidate: RouteCandidateName,
): Coordinates[] {
  const bearing = segmentBearingDegrees(origin, destination);

  if (candidate === "arterial") {
    const first = destinationFrom(
      interpolateCoordinates(origin, destination, 0.3),
      240,
      bearing + 90,
    );
    const second = destinationFrom(
      interpolateCoordinates(origin, destination, 0.7),
      200,
      bearing + 90,
    );
    return [origin, first, second, destination];
  }

  if (candidate === "shortcut") {
    const first = destinationFrom(
      interpolateCoordinates(origin, destination, 0.36),
      110,
      bearing - 100,
    );
    const second = destinationFrom(
      interpolateCoordinates(origin, destination, 0.66),
      90,
      bearing + 80,
    );
    return [origin, first, second, destination];
  }

  const middle = destinationFrom(
    interpolateCoordinates(origin, destination, 0.5),
    130,
    bearing - 85,
  );
  return [origin, middle, destination];
}

function getRouteDistanceMeters(route: Coordinates[]): number {
  if (route.length < 2) return 0;

  let distance = 0;
  for (let index = 0; index < route.length - 1; index += 1) {
    distance += haversineDistanceMeters(route[index], route[index + 1]);
  }
  return distance;
}

function getTurnCount(route: Coordinates[]): number {
  if (route.length < 3) return 0;

  let turns = 0;
  for (let index = 1; index < route.length - 1; index += 1) {
    const turnAngle = turnAngleDegrees(
      route[index - 1],
      route[index],
      route[index + 1],
    );
    if (turnAngle > 35) {
      turns += 1;
    }
  }
  return turns;
}

function getCandidatePenaltyMinutes(
  vehicleType: VehicleType,
  candidate: RouteCandidateName,
): number {
  const config = CANDIDATE_BIAS[candidate];
  return vehicleType === "electric-car"
    ? config.carPenalty
    : config.bikePenalty;
}

function estimateDurationMinutes(
  distanceMeters: number,
  vehicleType: VehicleType,
  turns: number,
  candidate: RouteCandidateName,
): number {
  const profile = VEHICLE_PROFILES[vehicleType];
  const travelMinutes = (distanceMeters / 1000 / profile.averageSpeedKmh) * 60;
  return (
    travelMinutes +
    turns * profile.turnPenaltyMinutes +
    getCandidatePenaltyMinutes(vehicleType, candidate)
  );
}

function buildRouteSteps(
  route: Coordinates[],
  totalDurationMinutes: number,
): RouteStep[] {
  const totalDistance = getRouteDistanceMeters(route);
  const steps: RouteStep[] = [];

  for (let index = 0; index < route.length - 1; index += 1) {
    const segmentDistance = haversineDistanceMeters(
      route[index],
      route[index + 1],
    );
    const segmentDuration = totalDistance
      ? totalDurationMinutes * (segmentDistance / totalDistance)
      : 0;
    const direction = directionFromBearing(
      segmentBearingDegrees(route[index], route[index + 1]),
    );

    const instructionPrefix =
      index === 0
        ? "Start and continue"
        : index === route.length - 2
          ? "Continue and arrive"
          : "Keep moving";

    steps.push({
      id: `step-${index + 1}`,
      instruction: `${instructionPrefix} to ${direction}`,
      distanceMeters: segmentDistance,
      durationMinutes: segmentDuration,
    });
  }

  return steps;
}

export function getVehicleProfile(vehicleType: VehicleType): VehicleProfile {
  return VEHICLE_PROFILES[vehicleType];
}

export function planOptimalRoute(
  stationId: string,
  vehicleType: VehicleType,
  origin: Coordinates,
  destination: Coordinates,
): RoutePlan {
  const candidates: RouteCandidateName[] = ["arterial", "balanced", "shortcut"];

  let bestCandidate: RoutePlan | null = null;

  for (const candidate of candidates) {
    const coordinates = buildCandidateRoute(origin, destination, candidate);
    const distanceMeters = getRouteDistanceMeters(coordinates);
    const turns = getTurnCount(coordinates);
    const durationMinutes = estimateDurationMinutes(
      distanceMeters,
      vehicleType,
      turns,
      candidate,
    );

    const routePlan: RoutePlan = {
      stationId,
      vehicleType,
      candidate,
      coordinates,
      distanceMeters,
      durationMinutes,
      steps: buildRouteSteps(coordinates, durationMinutes),
    };

    if (
      !bestCandidate ||
      routePlan.durationMinutes < bestCandidate.durationMinutes
    ) {
      bestCandidate = routePlan;
    }
  }

  return bestCandidate as RoutePlan;
}

function getRoutingProfile(vehicleType: VehicleType): "driving" | "cycling" {
  return vehicleType === "electric-car" ? "driving" : "cycling";
}

function getMapboxRoutingProfile(): "driving-traffic" {
  // Mapbox doesn't have a dedicated motorbike profile;
  // driving-traffic provides the best ETA with realtime traffic data.
  return "driving-traffic";
}

function getApiCandidate(vehicleType: VehicleType): RouteCandidateName {
  return vehicleType === "electric-car" ? "arterial" : "balanced";
}

function toOsrmPoint([lng, lat]: Coordinates): string {
  return `${lng},${lat}`;
}

function getOsrmRoutingBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_ROUTING_API_BASE_URL?.replace(/\/$/, "") ??
    DEFAULT_OSRM_ROUTING_API_BASE_URL
  );
}

function getMapboxRoutingBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MAPBOX_ROUTING_API_BASE_URL?.replace(/\/$/, "") ??
    DEFAULT_MAPBOX_ROUTING_API_BASE_URL
  );
}

function getConfiguredRoutingProvider(): RoutingProvider {
  const configuredProvider =
    process.env.NEXT_PUBLIC_ROUTING_PROVIDER?.toLowerCase();

  if (configuredProvider === "mapbox" || configuredProvider === "osrm") {
    return configuredProvider;
  }

  return process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ? "mapbox" : "osrm";
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }

  return false;
}

function toRouteCoordinates(points: number[][]): Coordinates[] {
  return points.map((point) => [point[0], point[1]] as Coordinates);
}

function formatManeuverInstruction(step: {
  name?: string;
  maneuver?: {
    type?: string;
    modifier?: string;
    instruction?: string;
  };
}): string {
  const providedInstruction = step.maneuver?.instruction?.trim();
  if (providedInstruction) {
    return providedInstruction;
  }

  const maneuverType = step.maneuver?.type ?? "continue";
  const modifier = step.maneuver?.modifier;
  const street = step.name?.trim();

  if (maneuverType === "arrive") {
    return "Arrive at destination";
  }

  if (maneuverType === "depart") {
    return street ? `Head toward ${street}` : "Start navigation";
  }

  const modifierLabel = modifier ? modifier.replace("_", " ") : "forward";

  if (street) {
    return `Go ${modifierLabel} to ${street}`;
  }

  return `Go ${modifierLabel}`;
}

function parseOsrmSteps(
  legs: Array<{
    steps?: Array<{
      distance: number;
      duration: number;
      name?: string;
      maneuver?: {
        type?: string;
        modifier?: string;
        instruction?: string;
      };
    }>;
  }>,
): RouteStep[] {
  const steps: RouteStep[] = [];
  let index = 1;

  for (const leg of legs) {
    for (const step of leg.steps ?? []) {
      steps.push({
        id: `step-${index}`,
        instruction: formatManeuverInstruction(step),
        distanceMeters: step.distance,
        durationMinutes: step.duration / 60,
      });
      index += 1;
    }
  }

  return steps;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeTrafficFactor(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) {
    return 1;
  }

  return clampNumber(value, 1, 3);
}

function getGraphNodeId(coordinates: Coordinates): string {
  return `${coordinates[0].toFixed(GRAPH_NODE_PRECISION)},${coordinates[1].toFixed(GRAPH_NODE_PRECISION)}`;
}

function getAverageTrafficFactor(values: number[]): number {
  if (values.length === 0) {
    return 1;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function computeEdgeCost(
  distanceMeters: number,
  durationMinutes: number,
  trafficFactor: number,
): number {
  return (
    durationMinutes * A_STAR_TIME_WEIGHT +
    (distanceMeters / 1000) * A_STAR_DISTANCE_WEIGHT +
    (trafficFactor - 1) * A_STAR_TRAFFIC_PENALTY_WEIGHT
  );
}

function getFallbackSegmentDistances(coordinates: Coordinates[]): number[] {
  const distances: number[] = [];

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    distances.push(
      haversineDistanceMeters(coordinates[index], coordinates[index + 1]),
    );
  }

  return distances;
}

function getFallbackSegmentDurations(
  coordinates: Coordinates[],
  totalDurationMinutes: number,
): number[] {
  const distances = getFallbackSegmentDistances(coordinates);
  const totalDistance = distances.reduce((sum, distance) => sum + distance, 0);

  if (totalDistance <= 0) {
    return distances.map(() => 0);
  }

  return distances.map(
    (distance) => totalDurationMinutes * (distance / totalDistance),
  );
}

function flattenLegAnnotationValues<T>(
  legs: Array<{
    annotation?: T;
  }>,
  selectValues: (annotation: T) => number[] | undefined,
): number[] {
  const values: number[] = [];

  for (const leg of legs) {
    const annotation = leg.annotation;
    if (!annotation) {
      continue;
    }

    const next = selectValues(annotation);
    if (!next?.length) {
      continue;
    }

    values.push(...next);
  }

  return values;
}

function toProviderRouteCandidatesFromOsrm(
  payload: OsrmRouteResponse,
): ProviderRouteCandidate[] {
  const routes = payload.routes ?? [];

  return routes
    .map((route) => {
      const coordinates = route.geometry?.coordinates
        ? toRouteCoordinates(route.geometry.coordinates)
        : [];

      if (coordinates.length < 2) {
        return null;
      }

      const segmentCount = coordinates.length - 1;
      const fallbackDistances = getFallbackSegmentDistances(coordinates);
      const fallbackDurations = getFallbackSegmentDurations(
        coordinates,
        route.duration / 60,
      );

      const legs = route.legs ?? [];
      const annotationDistances = flattenLegAnnotationValues(
        legs,
        (annotation) => annotation.distance,
      );
      const annotationDurations = flattenLegAnnotationValues(
        legs,
        (annotation) => annotation.duration,
      ).map((seconds) => seconds / 60);

      const segmentDistancesMeters =
        annotationDistances.length === segmentCount
          ? annotationDistances
          : fallbackDistances;

      const segmentDurationsMinutes =
        annotationDurations.length === segmentCount
          ? annotationDurations
          : fallbackDurations;

      const segmentTrafficFactors = Array.from(
        { length: segmentCount },
        () => 1,
      );

      return {
        coordinates,
        distanceMeters: route.distance,
        durationMinutes: route.duration / 60,
        steps: parseOsrmSteps(legs),
        segmentDistancesMeters,
        segmentDurationsMinutes,
        segmentTrafficFactors,
      } as ProviderRouteCandidate;
    })
    .filter(
      (candidate): candidate is ProviderRouteCandidate => candidate !== null,
    );
}

function toProviderRouteCandidatesFromMapbox(
  payload: MapboxRouteResponse,
): ProviderRouteCandidate[] {
  const routes = payload.routes ?? [];

  return routes
    .map((route) => {
      const coordinates = route.geometry?.coordinates
        ? toRouteCoordinates(route.geometry.coordinates)
        : [];

      if (coordinates.length < 2) {
        return null;
      }

      const segmentCount = coordinates.length - 1;
      const fallbackDistances = getFallbackSegmentDistances(coordinates);
      const fallbackDurations = getFallbackSegmentDurations(
        coordinates,
        route.duration / 60,
      );

      const legs = route.legs ?? [];

      const annotationDistances = flattenLegAnnotationValues(
        legs,
        (annotation) => annotation.distance,
      );
      const annotationDurations = flattenLegAnnotationValues(
        legs,
        (annotation) => annotation.duration,
      ).map((seconds) => seconds / 60);

      const typicalDurations = flattenLegAnnotationValues(
        legs,
        (annotation) => annotation.duration_typical,
      ).map((seconds) => seconds / 60);

      const congestionNumeric = flattenLegAnnotationValues(
        legs,
        (annotation) => annotation.congestion_numeric,
      );

      const segmentDistancesMeters =
        annotationDistances.length === segmentCount
          ? annotationDistances
          : fallbackDistances;

      const segmentDurationsMinutes =
        annotationDurations.length === segmentCount
          ? annotationDurations
          : fallbackDurations;

      const segmentTrafficFactors = Array.from(
        { length: segmentCount },
        (_, index) => {
          let trafficFactor = 1;

          if (typicalDurations.length === segmentCount) {
            const currentDuration = segmentDurationsMinutes[index];
            const typicalDuration = typicalDurations[index];
            if (typicalDuration > 0) {
              trafficFactor = Math.max(
                trafficFactor,
                currentDuration / typicalDuration,
              );
            }
          }

          if (congestionNumeric.length === segmentCount) {
            const congestion = congestionNumeric[index];
            if (Number.isFinite(congestion)) {
              trafficFactor = Math.max(
                trafficFactor,
                1 + clampNumber(congestion, 0, 100) / 100,
              );
            }
          }

          return normalizeTrafficFactor(trafficFactor);
        },
      );

      return {
        coordinates,
        distanceMeters: route.distance,
        durationMinutes: route.duration / 60,
        steps: parseOsrmSteps(legs),
        segmentDistancesMeters,
        segmentDurationsMinutes,
        segmentTrafficFactors,
      } as ProviderRouteCandidate;
    })
    .filter(
      (candidate): candidate is ProviderRouteCandidate => candidate !== null,
    );
}

function buildRouteGraphFromCandidates(
  candidates: ProviderRouteCandidate[],
): RouteGraph {
  const nodes = new Map<string, GraphNode>();
  const adjacency = new Map<string, GraphEdge[]>();

  const upsertNode = (coordinates: Coordinates): GraphNode => {
    const id = getGraphNodeId(coordinates);
    const existingNode = nodes.get(id);
    if (existingNode) {
      return existingNode;
    }

    const nextNode: GraphNode = { id, coordinates };
    nodes.set(id, nextNode);
    return nextNode;
  };

  for (const candidate of candidates) {
    for (let index = 0; index < candidate.coordinates.length - 1; index += 1) {
      const fromNode = upsertNode(candidate.coordinates[index]);
      const toNode = upsertNode(candidate.coordinates[index + 1]);

      const distanceMeters = candidate.segmentDistancesMeters[index] ?? 0;
      const durationMinutes = candidate.segmentDurationsMinutes[index] ?? 0;
      const trafficFactor =
        candidate.segmentTrafficFactors[index] !== undefined
          ? candidate.segmentTrafficFactors[index]
          : 1;

      const edge: GraphEdge = {
        fromId: fromNode.id,
        toId: toNode.id,
        distanceMeters,
        durationMinutes,
        trafficFactor,
        cost: computeEdgeCost(distanceMeters, durationMinutes, trafficFactor),
      };

      const edges = adjacency.get(fromNode.id) ?? [];
      edges.push(edge);
      adjacency.set(fromNode.id, edges);
    }
  }

  return { nodes, adjacency };
}

function findNearestGraphNodeId(
  graph: RouteGraph,
  target: Coordinates,
): string | null {
  let nearestNodeId: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const node of graph.nodes.values()) {
    const distance = haversineDistanceMeters(node.coordinates, target);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestNodeId = node.id;
    }
  }

  return nearestNodeId;
}

function estimateAStarHeuristicCost(
  from: Coordinates,
  to: Coordinates,
  vehicleType: VehicleType,
): number {
  const distanceMeters = haversineDistanceMeters(from, to);
  const profile = getVehicleProfile(vehicleType);
  const durationMinutes =
    (distanceMeters / 1000 / profile.averageSpeedKmh) * 60;

  return (
    durationMinutes * A_STAR_TIME_WEIGHT +
    (distanceMeters / 1000) * A_STAR_DISTANCE_WEIGHT
  );
}

function reconstructAStarPath(
  graph: RouteGraph,
  cameFrom: Map<string, GraphEdge>,
  startNodeId: string,
  goalNodeId: string,
): AStarPathResult | null {
  const pathEdges: GraphEdge[] = [];
  let currentNodeId = goalNodeId;

  while (currentNodeId !== startNodeId) {
    const edge = cameFrom.get(currentNodeId);
    if (!edge) {
      return null;
    }

    pathEdges.unshift(edge);
    currentNodeId = edge.fromId;
  }

  const startNode = graph.nodes.get(startNodeId);
  if (!startNode) {
    return null;
  }

  const coordinates: Coordinates[] = [startNode.coordinates];
  let distanceMeters = 0;
  let durationMinutes = 0;
  let score = 0;
  let trafficWeightedDuration = 0;

  for (const edge of pathEdges) {
    const node = graph.nodes.get(edge.toId);
    if (!node) {
      return null;
    }

    coordinates.push(node.coordinates);
    distanceMeters += edge.distanceMeters;
    durationMinutes += edge.durationMinutes;
    score += edge.cost;
    trafficWeightedDuration += edge.durationMinutes * edge.trafficFactor;
  }

  return {
    coordinates,
    distanceMeters,
    durationMinutes,
    averageTrafficFactor:
      durationMinutes > 0 ? trafficWeightedDuration / durationMinutes : 1,
    score,
  };
}

function runAStarSearch(
  graph: RouteGraph,
  startNodeId: string,
  goalNodeId: string,
  vehicleType: VehicleType,
): AStarPathResult | null {
  const startNode = graph.nodes.get(startNodeId);
  const goalNode = graph.nodes.get(goalNodeId);

  if (!startNode || !goalNode) {
    return null;
  }

  const openSet = new Set<string>([startNodeId]);
  const cameFrom = new Map<string, GraphEdge>();
  const gScore = new Map<string, number>([[startNodeId, 0]]);
  const fScore = new Map<string, number>([
    [
      startNodeId,
      estimateAStarHeuristicCost(
        startNode.coordinates,
        goalNode.coordinates,
        vehicleType,
      ),
    ],
  ]);

  while (openSet.size > 0) {
    let currentNodeId: string | null = null;
    let currentNodeBestScore = Number.POSITIVE_INFINITY;

    for (const nodeId of openSet) {
      const score = fScore.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (score < currentNodeBestScore) {
        currentNodeBestScore = score;
        currentNodeId = nodeId;
      }
    }

    if (!currentNodeId) {
      break;
    }

    if (currentNodeId === goalNodeId) {
      return reconstructAStarPath(graph, cameFrom, startNodeId, goalNodeId);
    }

    openSet.delete(currentNodeId);

    const currentScore = gScore.get(currentNodeId) ?? Number.POSITIVE_INFINITY;
    const edges = graph.adjacency.get(currentNodeId) ?? [];

    for (const edge of edges) {
      const tentativeScore = currentScore + edge.cost;
      const knownScore = gScore.get(edge.toId) ?? Number.POSITIVE_INFINITY;

      if (tentativeScore >= knownScore) {
        continue;
      }

      const toNode = graph.nodes.get(edge.toId);
      if (!toNode) {
        continue;
      }

      cameFrom.set(edge.toId, edge);
      gScore.set(edge.toId, tentativeScore);
      fScore.set(
        edge.toId,
        tentativeScore +
          estimateAStarHeuristicCost(
            toNode.coordinates,
            goalNode.coordinates,
            vehicleType,
          ),
      );
      openSet.add(edge.toId);
    }
  }

  return null;
}

function computeCandidateScore(candidate: ProviderRouteCandidate): number {
  const averageTrafficFactor = getAverageTrafficFactor(
    candidate.segmentTrafficFactors,
  );

  return computeEdgeCost(
    candidate.distanceMeters,
    candidate.durationMinutes,
    averageTrafficFactor,
  );
}

function optimizeRouteWithAStar(
  candidates: ProviderRouteCandidate[],
  origin: Coordinates,
  destination: Coordinates,
  vehicleType: VehicleType,
): ProviderRouteResult {
  if (candidates.length === 0) {
    throw new Error("Routing API returned no usable candidates");
  }

  const graph = buildRouteGraphFromCandidates(candidates);
  const startNodeId = findNearestGraphNodeId(graph, origin);
  const goalNodeId = findNearestGraphNodeId(graph, destination);

  if (!startNodeId || !goalNodeId) {
    throw new Error("Unable to build route graph for A* search");
  }

  const aStarResult = runAStarSearch(
    graph,
    startNodeId,
    goalNodeId,
    vehicleType,
  );

  if (aStarResult) {
    return {
      coordinates: aStarResult.coordinates,
      distanceMeters: aStarResult.distanceMeters,
      durationMinutes: aStarResult.durationMinutes,
      steps: buildRouteSteps(
        aStarResult.coordinates,
        aStarResult.durationMinutes,
      ),
      optimizationScore: aStarResult.score,
      averageTrafficFactor: aStarResult.averageTrafficFactor,
    };
  }

  const fallbackCandidate = candidates.reduce((best, current) => {
    return computeCandidateScore(current) < computeCandidateScore(best)
      ? current
      : best;
  });

  return {
    coordinates: fallbackCandidate.coordinates,
    distanceMeters: fallbackCandidate.distanceMeters,
    durationMinutes: fallbackCandidate.durationMinutes,
    steps:
      fallbackCandidate.steps.length > 0
        ? fallbackCandidate.steps
        : buildRouteSteps(
            fallbackCandidate.coordinates,
            fallbackCandidate.durationMinutes,
          ),
    optimizationScore: computeCandidateScore(fallbackCandidate),
    averageTrafficFactor: getAverageTrafficFactor(
      fallbackCandidate.segmentTrafficFactors,
    ),
  };
}

async function fetchOsrmRoute(
  vehicleType: VehicleType,
  origin: Coordinates,
  destination: Coordinates,
  signal?: AbortSignal,
): Promise<ProviderRouteResult> {
  const profile = getRoutingProfile(vehicleType);
  const baseUrl = getOsrmRoutingBaseUrl();
  const coordinates = `${toOsrmPoint(origin)};${toOsrmPoint(destination)}`;
  const url = `${baseUrl}/route/v1/${profile}/${coordinates}?alternatives=true&overview=full&geometries=geojson&steps=true&annotations=true`;

  const response = await fetch(url, {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Routing API request failed with status ${response.status}`,
    );
  }

  const payload = (await response.json()) as OsrmRouteResponse;

  if (payload.code !== "Ok") {
    throw new Error("Routing API returned an invalid route");
  }

  const candidates = toProviderRouteCandidatesFromOsrm(payload);
  return optimizeRouteWithAStar(candidates, origin, destination, vehicleType);
}

async function fetchMapboxRoute(
  vehicleType: VehicleType,
  origin: Coordinates,
  destination: Coordinates,
  signal?: AbortSignal,
): Promise<ProviderRouteResult> {
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("Mapbox access token is missing");
  }

  const profile = getMapboxRoutingProfile();
  const baseUrl = getMapboxRoutingBaseUrl();
  const coordinates = `${toOsrmPoint(origin)};${toOsrmPoint(destination)}`;
  const params = new URLSearchParams({
    alternatives: "true",
    overview: "full",
    geometries: "geojson",
    steps: "true",
    annotations: "distance,duration,duration_typical,congestion_numeric",
    language: "en",
    access_token: accessToken,
  });
  const url = `${baseUrl}/directions/v5/mapbox/${profile}/${coordinates}?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Mapbox routing request failed with status ${response.status}`,
    );
  }

  const payload = (await response.json()) as MapboxRouteResponse;

  if (payload.code !== "Ok") {
    throw new Error(
      payload.message
        ? `Mapbox routing failed: ${payload.message}`
        : "Mapbox routing returned an invalid route",
    );
  }

  const candidates = toProviderRouteCandidatesFromMapbox(payload);
  return optimizeRouteWithAStar(candidates, origin, destination, vehicleType);
}

export async function planRouteFromMapApi(
  stationId: string,
  vehicleType: VehicleType,
  origin: Coordinates,
  destination: Coordinates,
  options: PlanRouteFromMapApiOptions = {},
): Promise<RoutePlan> {
  const provider = getConfiguredRoutingProvider();

  let routeResult: ProviderRouteResult;

  try {
    routeResult =
      provider === "mapbox"
        ? await fetchMapboxRoute(
            vehicleType,
            origin,
            destination,
            options.signal,
          )
        : await fetchOsrmRoute(
            vehicleType,
            origin,
            destination,
            options.signal,
          );
  } catch (error) {
    if (provider !== "mapbox" || isAbortError(error)) {
      throw error;
    }

    routeResult = await fetchOsrmRoute(
      vehicleType,
      origin,
      destination,
      options.signal,
    );
  }

  return {
    stationId,
    vehicleType,
    candidate: getApiCandidate(vehicleType),
    coordinates: routeResult.coordinates,
    distanceMeters: routeResult.distanceMeters,
    durationMinutes: routeResult.durationMinutes,
    optimizationScore: routeResult.optimizationScore,
    averageTrafficFactor: routeResult.averageTrafficFactor,
    steps:
      routeResult.steps.length > 0
        ? routeResult.steps
        : buildRouteSteps(routeResult.coordinates, routeResult.durationMinutes),
  };
}
