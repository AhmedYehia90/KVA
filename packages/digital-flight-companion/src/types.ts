export type CompanionTone = "supportive" | "professional" | "direct";

export interface FlightDebriefInput {
  flightNumber: string;
  blockMinutes: number;
  plannedBlockMinutes: number | null;
  landingRate: number | null;
  fuelUsedKg: number | null;
  replayHealthy: boolean | null;
  tone?: CompanionTone;
}

export interface DebriefItem {
  code: string;
  title: string;
  message: string;
  evidence: Record<string, unknown>;
}

export interface FlightDebrief {
  score: number;
  confidence: number;
  tone: CompanionTone;
  headline: string;
  summary: string;
  strengths: DebriefItem[];
  focusItems: DebriefItem[];
  metrics: {
    blockMinutes: number;
    plannedBlockMinutes: number | null;
    blockVarianceMinutes: number | null;
    blockVariancePercent: number | null;
    landingRate: number | null;
    fuelUsedKg: number | null;
    replayHealthy: boolean | null;
  };
}
