export type ReplayFlightStatus =
  | "unknown"
  | "booked"
  | "boarding"
  | "departed"
  | "enroute"
  | "landed"
  | "completed";

export interface ReplayEvent {
  id: string;
  streamPosition?: number;
  eventType: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  correlationId?: string | null;
  causationId?: string | null;
}

export interface ReplayCheckpoint {
  eventId: string;
  eventType: string;
  occurredAt: string;
  status: ReplayFlightStatus;
  aircraftId: string | null;
  dispatchId: string | null;
  pirepId: string | null;
}

export interface ReplayAnomaly {
  code:
    | "non_monotonic_time"
    | "status_regression"
    | "missing_flight_booked"
    | "projection_status_mismatch"
    | "multiple_correlations"
    | "missing_causation"
    | "unexpected_causation";
  message: string;
  eventId?: string;
}

export interface FlightReplay {
  status: ReplayFlightStatus;
  aircraftId: string | null;
  dispatchId: string | null;
  pirepId: string | null;
  checkpoints: ReplayCheckpoint[];
  anomalies: ReplayAnomaly[];
}
