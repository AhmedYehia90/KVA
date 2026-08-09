export type AirbotPhase =
  | "preflight"
  | "boarding"
  | "ground_departure"
  | "airborne"
  | "arrived"
  | "completed";

export type AirbotReadiness = "ready" | "attention" | "blocked";

export interface AirbotEvidence {
  flightNumber: string;
  departure: string | null;
  arrival: string | null;
  scheduledMinutes: number | null;
  bookingStatus: string;
  dispatchAvailable: boolean;
  aircraftAssigned: boolean;
  aircraftRegistration: string | null;
  aircraftType: string | null;
  aircraftStatus: string | null;
  routeActive: boolean;
}

export interface AirbotCheck {
  code: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  detail: string;
}

export interface AirbotBriefing {
  phase: AirbotPhase;
  readiness: AirbotReadiness;
  readinessScore: number;
  summary: string;
  nextStep: string;
  checks: AirbotCheck[];
}

export type AirbotIntent =
  | "briefing"
  | "readiness"
  | "aircraft"
  | "next_step"
  | "custom";
