export type MentorTone = "supportive" | "professional" | "direct";

export type MentorGoalCategory =
  | "landing_control"
  | "timing_control"
  | "data_discipline"
  | "record_awareness"
  | "consistency";

export type MentorResponseType =
  | "understood"
  | "need_simpler"
  | "need_example"
  | "ready_to_practice"
  | "custom";

export interface MentorDebriefItem {
  code: string;
  title: string;
  message: string;
  evidence?: Record<string, unknown>;
}

export interface MentorDebriefInput {
  debriefId: string;
  flightNumber: string;
  tone: MentorTone;
  score: number;
  confidence: number;
  summary: string;
  strengths: MentorDebriefItem[];
  focusItems: MentorDebriefItem[];
  replayHealthy: boolean | null;
}

export interface MentorLessonStep {
  phase: string;
  title: string;
  guidance: string;
  why: string;
}

export interface MentorGoalRecommendation {
  category: MentorGoalCategory;
  title: string;
  objective: string;
  targetCount: number;
  successCodes: string[];
}

export interface MentorSessionPlan {
  primaryFocus: MentorDebriefItem;
  openingMessage: string;
  diagnosis: string;
  lessonPlan: MentorLessonStep[];
  recommendedGoal: MentorGoalRecommendation;
}

export interface MentorGoalState {
  category: MentorGoalCategory;
  progressCount: number;
  targetCount: number;
}

export interface MentorGoalEvaluation {
  progressed: boolean;
  completed: boolean;
  progressCount: number;
  reason: string;
}
