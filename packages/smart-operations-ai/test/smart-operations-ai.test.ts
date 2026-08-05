import assert from "node:assert/strict";
import test from "node:test";
import {
  analyseOperations,
  calculateOperationsHealthScore,
  type OperationSnapshot,
} from "../src";

function healthySnapshot(): OperationSnapshot {
  return {
    failedEvents: 0,
    pendingEvents: 0,
    deadLetterEvents: 0,
    stalledFlights: [],
    unassignedFlights: [],
    completedWithoutPirep: [],
    delayedPireps: [],
    aircraftStateGaps: [],
  };
}

test("returns no findings for a healthy operation", () => {
  assert.deepEqual(analyseOperations(healthySnapshot()), []);
});

test("marks dead letters as critical", () => {
  const findings = analyseOperations({
    ...healthySnapshot(),
    deadLetterEvents: 1,
  });

  assert.equal(findings[0]?.severity, "critical");
  assert.equal(findings[0]?.type, "event_platform_degraded");
});

test("detects a stalled flight after the threshold", () => {
  const findings = analyseOperations({
    ...healthySnapshot(),
    stalledFlights: [{bookingId: "booking-1", ageHours: 7}],
  });

  assert.equal(findings[0]?.fingerprint, "stalled-flight:booking-1");
});

test("does not report a completed flight before the grace period", () => {
  const findings = analyseOperations({
    ...healthySnapshot(),
    completedWithoutPirep: [{bookingId: "booking-2", ageHours: 1}],
  });

  assert.equal(findings.length, 0);
});

test("calculates a bounded operational health score", () => {
  const findings = analyseOperations({
    ...healthySnapshot(),
    deadLetterEvents: 1,
    unassignedFlights: [{bookingId: "booking-3"}],
  });

  assert.equal(calculateOperationsHealthScore(findings), 55);
});
