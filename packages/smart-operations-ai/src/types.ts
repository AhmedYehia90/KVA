export type FindingSeverity = "low" | "medium" | "high" | "critical";

export type FindingType =
  | "event_platform_degraded"
  | "stalled_flight"
  | "unassigned_aircraft"
  | "completed_without_pirep"
  | "pirep_review_delayed"
  | "aircraft_state_missing";

export interface OperationSnapshot {
  failedEvents: number;
  pendingEvents: number;
  deadLetterEvents: number;
  stalledFlights: Array<{bookingId: string; ageHours: number}>;
  unassignedFlights: Array<{bookingId: string; flightNumber?: string}>;
  completedWithoutPirep: Array<{bookingId: string; ageHours: number}>;
  delayedPireps: Array<{pirepId: string; ageHours: number}>;
  aircraftStateGaps: Array<{bookingId: string; aircraftId: string}>;
}

export interface AnalysisPolicy {
  stalledFlightHours: number;
  completedWithoutPirepHours: number;
  pirepReviewHours: number;
}

export interface SmartOperationsFinding {
  fingerprint: string;
  type: FindingType;
  severity: FindingSeverity;
  title: string;
  summary: string;
  recommendation: string;
  subjectType: string;
  subjectId?: string;
  confidence: number;
  evidence: Record<string, unknown>;
}
