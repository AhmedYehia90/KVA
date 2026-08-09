import assert from "node:assert/strict";
import test from "node:test";
import {
  answerAirbotIntent,
  buildAirbotBriefing,
  phaseFromBookingStatus,
  type AirbotEvidence,
} from "../src";

function evidence(
  overrides: Partial<AirbotEvidence> = {},
): AirbotEvidence {
  return {
    flightNumber: "KVA150",
    departure: "HECA",
    arrival: "OKKK",
    scheduledMinutes: 125,
    bookingStatus: "booked",
    dispatchAvailable: true,
    aircraftAssigned: true,
    aircraftRegistration: "SU-KVA",
    aircraftType: "A21N",
    aircraftStatus: "active",
    routeActive: true,
    ...overrides,
  };
}

test("builds a fully ready preflight briefing", () => {
  const result = buildAirbotBriefing(evidence());

  assert.equal(result.readiness, "ready");
  assert.equal(result.readinessScore, 100);
  assert.equal(result.phase, "preflight");
});

test("shows attention when aircraft assignment is pending", () => {
  const result = buildAirbotBriefing(
    evidence({
      aircraftAssigned: false,
      aircraftRegistration: null,
      aircraftType: null,
      aircraftStatus: null,
    }),
  );

  assert.equal(result.readiness, "attention");
  assert.equal(result.readinessScore, 50);
});

test("blocks when the dispatch record is absent", () => {
  const result = buildAirbotBriefing(
    evidence({dispatchAvailable: false}),
  );

  assert.equal(result.readiness, "blocked");
});

test("maps booking status to a living flight phase", () => {
  assert.equal(phaseFromBookingStatus("boarding"), "boarding");
  assert.equal(phaseFromBookingStatus("enroute"), "airborne");
  assert.equal(phaseFromBookingStatus("completed"), "completed");
});

test("does not invent an aircraft assignment", () => {
  const source = evidence({
    aircraftAssigned: false,
    aircraftRegistration: null,
    aircraftType: null,
    aircraftStatus: null,
  });
  const briefing = buildAirbotBriefing(source);
  const answer = answerAirbotIntent(
    "aircraft",
    source,
    briefing,
  );

  assert.match(answer, /No aircraft is assigned yet/i);
});

test("answers readiness from failed recorded checks", () => {
  const source = evidence({aircraftStatus: "maintenance"});
  const briefing = buildAirbotBriefing(source);
  const answer = answerAirbotIntent(
    "readiness",
    source,
    briefing,
  );

  assert.match(answer, /Aircraft operational state/i);
});
