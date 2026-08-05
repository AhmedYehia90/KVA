import type {
  AnalysisPolicy,
  OperationSnapshot,
  SmartOperationsFinding,
} from "./types";

const defaultPolicy: AnalysisPolicy = {
  stalledFlightHours: 6,
  completedWithoutPirepHours: 2,
  pirepReviewHours: 24,
};

export function analyseOperations(
  snapshot: OperationSnapshot,
  policy: Partial<AnalysisPolicy> = {},
): SmartOperationsFinding[] {
  const rules = {...defaultPolicy, ...policy};
  const findings: SmartOperationsFinding[] = [];

  if (
    snapshot.failedEvents > 0 ||
    snapshot.pendingEvents > 0 ||
    snapshot.deadLetterEvents > 0
  ) {
    const severity =
      snapshot.deadLetterEvents > 0
        ? "critical"
        : snapshot.failedEvents > 0
          ? "high"
          : "medium";

    findings.push({
      fingerprint: "event-platform-health",
      type: "event_platform_degraded",
      severity,
      title: "Event Platform requires attention",
      summary: `${snapshot.failedEvents} failed, ${snapshot.pendingEvents} pending and ${snapshot.deadLetterEvents} dead-letter events were detected.`,
      recommendation:
        "Open Core Health, inspect the oldest unhealthy event and retry or requeue it after correcting the cause.",
      subjectType: "event_platform",
      confidence: 1,
      evidence: {
        failedEvents: snapshot.failedEvents,
        pendingEvents: snapshot.pendingEvents,
        deadLetterEvents: snapshot.deadLetterEvents,
      },
    });
  }

  for (const flight of snapshot.stalledFlights) {
    if (flight.ageHours < rules.stalledFlightHours) continue;

    findings.push({
      fingerprint: `stalled-flight:${flight.bookingId}`,
      type: "stalled_flight",
      severity:
        flight.ageHours >= rules.stalledFlightHours * 2 ? "high" : "medium",
      title: "Active flight appears stalled",
      summary: `The flight has not produced a new operational event for ${flight.ageHours.toFixed(1)} hours.`,
      recommendation:
        "Verify the pilot session and booking state before cancelling, expiring or manually recovering the flight.",
      subjectType: "flight_booking",
      subjectId: flight.bookingId,
      confidence: 0.93,
      evidence: {ageHours: flight.ageHours},
    });
  }

  for (const flight of snapshot.unassignedFlights) {
    findings.push({
      fingerprint: `unassigned-aircraft:${flight.bookingId}`,
      type: "unassigned_aircraft",
      severity: "high",
      title: "Active flight has no aircraft assignment",
      summary: `${flight.flightNumber ?? "An active flight"} is waiting for an aircraft.`,
      recommendation:
        "Assign an available aircraft of the required fleet type before the operation advances.",
      subjectType: "flight_booking",
      subjectId: flight.bookingId,
      confidence: 1,
      evidence: {flightNumber: flight.flightNumber ?? null},
    });
  }

  for (const flight of snapshot.completedWithoutPirep) {
    if (flight.ageHours < rules.completedWithoutPirepHours) continue;

    findings.push({
      fingerprint: `completed-without-pirep:${flight.bookingId}`,
      type: "completed_without_pirep",
      severity: flight.ageHours >= 24 ? "high" : "medium",
      title: "Completed flight is missing a PIREP",
      summary: `The flight completed ${flight.ageHours.toFixed(1)} hours ago without a linked PIREP.`,
      recommendation:
        "Confirm that an Auto PIREP draft exists and ask the pilot to review and submit it.",
      subjectType: "flight_booking",
      subjectId: flight.bookingId,
      confidence: 0.98,
      evidence: {ageHours: flight.ageHours},
    });
  }

  for (const pirep of snapshot.delayedPireps) {
    if (pirep.ageHours < rules.pirepReviewHours) continue;

    findings.push({
      fingerprint: `pirep-review-delayed:${pirep.pirepId}`,
      type: "pirep_review_delayed",
      severity:
        pirep.ageHours >= rules.pirepReviewHours * 3 ? "high" : "medium",
      title: "PIREP review is delayed",
      summary: `A submitted PIREP has waited ${pirep.ageHours.toFixed(1)} hours for review.`,
      recommendation:
        "Review the report, approve it or return it with a clear reason.",
      subjectType: "pirep",
      subjectId: pirep.pirepId,
      confidence: 1,
      evidence: {ageHours: pirep.ageHours},
    });
  }

  for (const gap of snapshot.aircraftStateGaps) {
    findings.push({
      fingerprint: `aircraft-state-missing:${gap.bookingId}`,
      type: "aircraft_state_missing",
      severity: "high",
      title: "Aircraft operational state is missing",
      summary:
        "An active projected flight references an aircraft without a synchronized operational-state record.",
      recommendation:
        "Rebuild the aircraft state from the event stream before assigning the aircraft elsewhere.",
      subjectType: "aircraft",
      subjectId: gap.aircraftId,
      confidence: 0.97,
      evidence: {
        bookingId: gap.bookingId,
        aircraftId: gap.aircraftId,
      },
    });
  }

  return findings;
}

export function calculateOperationsHealthScore(
  findings: SmartOperationsFinding[],
): number {
  const penalty = findings.reduce((sum, finding) => {
    const amount = {
      low: 2,
      medium: 7,
      high: 15,
      critical: 30,
    }[finding.severity];

    return sum + amount;
  }, 0);

  return Math.max(0, 100 - penalty);
}
