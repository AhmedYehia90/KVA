export type GlobalEventPhase =
  | "upcoming"
  | "live"
  | "completed"
  | "cancelled";

export type GlobalEventParticipationStatus =
  | "joined"
  | "completed"
  | "withdrawn";

export interface GlobalEventWindow {
  lifecycleStatus: "published" | "archived" | "cancelled";
  startsAt: Date;
  endsAt: Date;
  registrationOpensAt: Date;
  registrationClosesAt: Date;
}

export interface GlobalEventProgress {
  completedFlights: number;
  targetFlights: number;
}

export interface GlobalEventFlightEvidence {
  joinedAt: Date;
  flightRecordedAt: Date;
  eventStartsAt: Date;
  eventEndsAt: Date;
  routeEligible: boolean;
  pirepStatus: string;
}
