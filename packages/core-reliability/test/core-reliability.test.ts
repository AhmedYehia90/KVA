import assert from "node:assert/strict";
import test from "node:test";
import {
  retryDelaySeconds,
  aircraftStatusForEvent,
  suggestedBlockMinutes,
} from "../src";

test("uses exponential retry delay", () => {
  assert.equal(retryDelaySeconds(1), 30);
  assert.equal(retryDelaySeconds(4), 240);
  assert.equal(retryDelaySeconds(5), null);
});

test("maps aircraft states", () => {
  assert.equal(aircraftStatusForEvent("flight.takeoff_recorded"), "enroute");
  assert.equal(aircraftStatusForEvent("flight.completed"), "available");
});

test("calculates auto PIREP time", () => {
  assert.equal(
    suggestedBlockMinutes(
      "2026-08-05T10:00:00Z",
      "2026-08-05T11:42:00Z",
      90,
    ),
    102,
  );
});
