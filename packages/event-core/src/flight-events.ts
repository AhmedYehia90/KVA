import type {EventContract, EventContractRegistry} from "./event-contract";

export const FLIGHT_EVENT_TYPES = {
  booked: "flight.booked",
  aircraftAssigned: "aircraft.assigned",
  dispatchCreated: "dispatch.created",
  boardingStarted: "flight.boarding_started",
  pushbackStarted: "flight.pushback_started",
  takeoffRecorded: "flight.takeoff_recorded",
  landingRecorded: "flight.landing_recorded",
  completed: "flight.completed",
  pirepCreated: "pirep.created",
} as const;

export type FlightEventType =
  (typeof FLIGHT_EVENT_TYPES)[keyof typeof FLIGHT_EVENT_TYPES];

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasString(value: JsonRecord, key: string): boolean {
  return typeof value[key] === "string" && value[key] !== "";
}

function hasNullableString(value: JsonRecord, key: string): boolean {
  return value[key] === null || value[key] === undefined || hasString(value, key);
}

function isFlightPayload(payload: unknown): payload is JsonRecord {
  return (
    isRecord(payload) &&
    hasString(payload, "bookingId") &&
    hasString(payload, "routeId") &&
    hasString(payload, "flightNumber") &&
    hasString(payload, "pilotId") &&
    hasNullableString(payload, "aircraftId")
  );
}

function isAircraftAssignmentPayload(payload: unknown): payload is JsonRecord {
  return (
    isRecord(payload) &&
    hasString(payload, "aircraftId") &&
    hasString(payload, "bookingId") &&
    hasString(payload, "routeId") &&
    hasString(payload, "pilotId")
  );
}

function isDispatchPayload(payload: unknown): payload is JsonRecord {
  return (
    isRecord(payload) &&
    hasString(payload, "dispatchId") &&
    hasString(payload, "bookingId") &&
    hasString(payload, "routeId") &&
    hasString(payload, "flightNumber")
  );
}

function isPirepPayload(payload: unknown): payload is JsonRecord {
  return (
    isRecord(payload) &&
    hasString(payload, "pirepId") &&
    hasString(payload, "bookingId") &&
    hasString(payload, "pilotId") &&
    typeof payload.blockMinutes === "number" &&
    payload.blockMinutes > 0
  );
}

const flightConsumers = [
  "operations.projector",
  "career.engine",
  "legacy.engine",
  "story.engine",
] as const;

export const flightEventContracts: readonly EventContract[] = [
  {
    eventType: FLIGHT_EVENT_TYPES.booked,
    version: 1,
    producer: "flight.operations",
    consumers: flightConsumers,
    privacy: "internal",
    validatePayload: isFlightPayload,
  },
  {
    eventType: FLIGHT_EVENT_TYPES.aircraftAssigned,
    version: 1,
    producer: "flight.operations",
    consumers: ["operations.projector", "fleet.engine"],
    privacy: "internal",
    validatePayload: isAircraftAssignmentPayload,
  },
  {
    eventType: FLIGHT_EVENT_TYPES.dispatchCreated,
    version: 1,
    producer: "dispatch.engine",
    consumers: ["operations.projector", "ai.dispatcher"],
    privacy: "internal",
    validatePayload: isDispatchPayload,
  },
  ...[
    FLIGHT_EVENT_TYPES.boardingStarted,
    FLIGHT_EVENT_TYPES.pushbackStarted,
    FLIGHT_EVENT_TYPES.takeoffRecorded,
    FLIGHT_EVENT_TYPES.landingRecorded,
    FLIGHT_EVENT_TYPES.completed,
  ].map<EventContract>((eventType) => ({
    eventType,
    version: 1,
    producer: "flight.operations",
    consumers: flightConsumers,
    privacy: "internal",
    validatePayload: isFlightPayload,
  })),
  {
    eventType: FLIGHT_EVENT_TYPES.pirepCreated,
    version: 1,
    producer: "pirep.module",
    consumers: [
      "career.engine",
      "aviation-dna",
      "legacy.engine",
      "ai.mentor",
    ],
    privacy: "restricted",
    validatePayload: isPirepPayload,
  },
];

export function registerFlightEventContracts(
  registry: EventContractRegistry,
): EventContractRegistry {
  for (const contract of flightEventContracts) {
    registry.register(contract);
  }
  return registry;
}
