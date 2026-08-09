import type {
  AirbotBriefing,
  AirbotCheck,
  AirbotEvidence,
  AirbotIntent,
  AirbotPhase,
  AirbotReadiness,
} from "./types";

export function phaseFromBookingStatus(status: string): AirbotPhase {
  if (status === "boarding") return "boarding";
  if (status === "departed") return "ground_departure";
  if (status === "enroute") return "airborne";
  if (status === "landed") return "arrived";
  if (status === "completed") return "completed";
  return "preflight";
}

function nextStepFor(phase: AirbotPhase, readiness: AirbotReadiness) {
  if (readiness === "blocked") {
    return "Resolve the blocking dispatch check before continuing the flight workflow.";
  }

  if (phase === "preflight") {
    return readiness === "ready"
      ? "Review the dispatch evidence, then continue to boarding when you are satisfied."
      : "Review the attention items before moving from preflight to boarding.";
  }

  if (phase === "boarding") {
    return "Confirm the recorded flight details remain correct before departure.";
  }

  if (phase === "ground_departure") {
    return "Continue the departure workflow and use recorded operational data for any decision.";
  }

  if (phase === "airborne") {
    return "Monitor the flight and keep the dispatcher record aligned with KVA OS events.";
  }

  if (phase === "arrived") {
    return "Complete the flight workflow, then prepare the PIREP from recorded values.";
  }

  return "The flight is complete. Submit or review the PIREP and post-flight systems.";
}

export function buildAirbotBriefing(
  evidence: AirbotEvidence,
): AirbotBriefing {
  const checks: AirbotCheck[] = [
    {
      code: "route_available",
      label: "Published route",
      passed: evidence.routeActive,
      blocking: true,
      detail: evidence.routeActive
        ? "The booked route is available in KVA OS."
        : "The booked route is not currently active.",
    },
    {
      code: "dispatch_available",
      label: "Dispatch record",
      passed: evidence.dispatchAvailable,
      blocking: true,
      detail: evidence.dispatchAvailable
        ? "A dispatch record exists for this booking."
        : "No dispatch record is available for this booking.",
    },
    {
      code: "aircraft_assigned",
      label: "Aircraft assignment",
      passed: evidence.aircraftAssigned,
      blocking: false,
      detail: evidence.aircraftAssigned
        ? `Assigned aircraft: ${evidence.aircraftRegistration ?? "recorded aircraft"}.`
        : "Aircraft assignment is still pending.",
    },
    {
      code: "aircraft_operational",
      label: "Aircraft operational state",
      passed:
        evidence.aircraftAssigned &&
        evidence.aircraftStatus === "active",
      blocking: false,
      detail: !evidence.aircraftAssigned
        ? "Cannot confirm aircraft state until an aircraft is assigned."
        : evidence.aircraftStatus === "active"
          ? "The assigned aircraft is active in the fleet record."
          : `Aircraft state is ${evidence.aircraftStatus ?? "unknown"}.`,
    },
  ];

  const passedCount = checks.filter((check) => check.passed).length;
  const readinessScore = Math.round(
    passedCount / checks.length * 100,
  );
  const hasBlockingFailure = checks.some(
    (check) => check.blocking && !check.passed,
  );

  const readiness: AirbotReadiness = hasBlockingFailure
    ? "blocked"
    : readinessScore === 100
      ? "ready"
      : "attention";

  const phase = phaseFromBookingStatus(evidence.bookingStatus);
  const routeLabel =
    evidence.departure && evidence.arrival
      ? `${evidence.departure} → ${evidence.arrival}`
      : "the booked route";

  const summary =
    readiness === "ready"
      ? `${evidence.flightNumber} is fully dispatch-ready for ${routeLabel} from the recorded KVA OS evidence.`
      : readiness === "blocked"
        ? `${evidence.flightNumber} has a blocking dispatch issue that must be resolved before continuing.`
        : `${evidence.flightNumber} is operationally available with attention items still visible in the briefing.`;

  return {
    phase,
    readiness,
    readinessScore,
    summary,
    nextStep: nextStepFor(phase, readiness),
    checks,
  };
}

export function answerAirbotIntent(
  intent: AirbotIntent,
  evidence: AirbotEvidence,
  briefing: AirbotBriefing,
  customMessage?: string | null,
) {
  if (intent === "briefing") {
    return `${briefing.summary} Planned block time: ${
      evidence.scheduledMinutes ?? "not recorded"
    } minutes.`;
  }

  if (intent === "readiness") {
    const failed = briefing.checks.filter((check) => !check.passed);

    if (!failed.length) {
      return `Readiness is ${briefing.readinessScore}%. All recorded dispatch checks pass.`;
    }

    return `Readiness is ${briefing.readinessScore}%. Review: ${failed
      .map((check) => check.label)
      .join(", ")}.`;
  }

  if (intent === "aircraft") {
    if (!evidence.aircraftAssigned) {
      return "No aircraft is assigned yet. I will keep the assignment visible as pending rather than inventing one.";
    }

    return `Aircraft ${evidence.aircraftRegistration ?? "assigned"}${
      evidence.aircraftType ? ` (${evidence.aircraftType})` : ""
    } is recorded with fleet state ${
      evidence.aircraftStatus ?? "unknown"
    }.`;
  }

  if (intent === "next_step") {
    return briefing.nextStep;
  }

  const normalized = (customMessage ?? "").toLowerCase();

  if (normalized.includes("aircraft") || normalized.includes("plane")) {
    return answerAirbotIntent("aircraft", evidence, briefing);
  }

  if (
    normalized.includes("ready") ||
    normalized.includes("readiness") ||
    normalized.includes("check")
  ) {
    return answerAirbotIntent("readiness", evidence, briefing);
  }

  if (
    normalized.includes("route") ||
    normalized.includes("flight") ||
    normalized.includes("brief")
  ) {
    return answerAirbotIntent("briefing", evidence, briefing);
  }

  return `I can only answer from recorded KVA OS dispatch evidence. Current phase: ${briefing.phase}. ${briefing.nextStep}`;
}
