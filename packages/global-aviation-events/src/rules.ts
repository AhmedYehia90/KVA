import type {
  GlobalEventFlightEvidence,
  GlobalEventPhase,
  GlobalEventProgress,
  GlobalEventWindow,
} from "./types";

export function getGlobalEventPhase(
  event: Pick<
    GlobalEventWindow,
    "lifecycleStatus" | "startsAt" | "endsAt"
  >,
  now = new Date(),
): GlobalEventPhase {
  if (event.lifecycleStatus === "cancelled") return "cancelled";
  if (now < event.startsAt) return "upcoming";
  if (now <= event.endsAt && event.lifecycleStatus === "published") {
    return "live";
  }

  return "completed";
}

export function isGlobalEventRegistrationOpen(
  event: GlobalEventWindow,
  now = new Date(),
) {
  return (
    event.lifecycleStatus === "published" &&
    now >= event.registrationOpensAt &&
    now <= event.registrationClosesAt &&
    now <= event.endsAt
  );
}

export function eventProgressPercent(progress: GlobalEventProgress) {
  if (progress.targetFlights <= 0) return 0;

  return Math.min(
    100,
    Math.round(
      progress.completedFlights / progress.targetFlights * 100,
    ),
  );
}

export function canCreditEventFlight(
  evidence: GlobalEventFlightEvidence,
) {
  return (
    evidence.routeEligible &&
    ["submitted", "approved"].includes(evidence.pirepStatus) &&
    evidence.flightRecordedAt >= evidence.joinedAt &&
    evidence.flightRecordedAt >= evidence.eventStartsAt &&
    evidence.flightRecordedAt <= evidence.eventEndsAt
  );
}
