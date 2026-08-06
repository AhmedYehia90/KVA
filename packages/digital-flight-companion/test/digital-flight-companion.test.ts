import assert from "node:assert/strict";
import test from "node:test";
import {generateFlightDebrief} from "../src";

test("rewards a precise flight with a smooth landing", () => {
  const result = generateFlightDebrief({
    flightNumber: "KVA111",
    blockMinutes: 62,
    plannedBlockMinutes: 60,
    landingRate: -120,
    fuelUsedKg: 2200,
    replayHealthy: true,
  });

  assert.equal(result.score, 100);
  assert.equal(result.strengths.some((item) => item.code === "landing_excellent"), true);
});

test("identifies a hard landing", () => {
  const result = generateFlightDebrief({
    flightNumber: "KVA201",
    blockMinutes: 60,
    plannedBlockMinutes: 60,
    landingRate: -650,
    fuelUsedKg: 2500,
    replayHealthy: true,
  });

  assert.equal(result.focusItems.some((item) => item.code === "landing_hard"), true);
});

test("identifies material block-time variance", () => {
  const result = generateFlightDebrief({
    flightNumber: "KVA301",
    blockMinutes: 100,
    plannedBlockMinutes: 60,
    landingRate: -220,
    fuelUsedKg: null,
    replayHealthy: true,
  });

  assert.equal(result.focusItems.some((item) => item.code === "block_time_variance"), true);
});

test("keeps replay warnings separate from pilot blame", () => {
  const result = generateFlightDebrief({
    flightNumber: "KVA101",
    blockMinutes: 60,
    plannedBlockMinutes: 60,
    landingRate: -200,
    fuelUsedKg: 2000,
    replayHealthy: false,
  });

  const warning = result.focusItems.find(
    (item) => item.code === "replay_integrity_warning",
  );

  assert.match(warning?.message ?? "", /not automatically a pilot-performance issue/i);
});

test("supports the direct coaching tone", () => {
  const result = generateFlightDebrief({
    flightNumber: "KVA401",
    blockMinutes: 60,
    plannedBlockMinutes: 60,
    landingRate: -350,
    fuelUsedKg: null,
    replayHealthy: true,
    tone: "direct",
  });

  assert.equal(result.tone, "direct");
  assert.match(result.summary, /review|preserve/i);
});
