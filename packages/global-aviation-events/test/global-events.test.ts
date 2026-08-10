import assert from "node:assert/strict";
import test from "node:test";
import {
  canCreditEventFlight,
  eventProgressPercent,
  getGlobalEventPhase,
  isGlobalEventRegistrationOpen,
} from "../src";

const start = new Date("2026-08-10T10:00:00Z");
const end = new Date("2026-08-20T10:00:00Z");

test("marks an event live inside its window", () => {
  assert.equal(
    getGlobalEventPhase(
      {
        lifecycleStatus: "published",
        startsAt: start,
        endsAt: end,
      },
      new Date("2026-08-15T10:00:00Z"),
    ),
    "live",
  );
});

test("marks a future event upcoming", () => {
  assert.equal(
    getGlobalEventPhase(
      {
        lifecycleStatus: "published",
        startsAt: start,
        endsAt: end,
      },
      new Date("2026-08-09T10:00:00Z"),
    ),
    "upcoming",
  );
});

test("registration respects lifecycle and registration window", () => {
  assert.equal(
    isGlobalEventRegistrationOpen(
      {
        lifecycleStatus: "published",
        startsAt: start,
        endsAt: end,
        registrationOpensAt: new Date("2026-08-08T10:00:00Z"),
        registrationClosesAt: new Date("2026-08-19T10:00:00Z"),
      },
      new Date("2026-08-12T10:00:00Z"),
    ),
    true,
  );
});

test("progress is capped at one hundred percent", () => {
  assert.equal(
    eventProgressPercent({
      completedFlights: 3,
      targetFlights: 2,
    }),
    100,
  );
});

test("credits only eligible post-join event flights", () => {
  assert.equal(
    canCreditEventFlight({
      joinedAt: new Date("2026-08-11T10:00:00Z"),
      flightRecordedAt: new Date("2026-08-12T10:00:00Z"),
      eventStartsAt: start,
      eventEndsAt: end,
      routeEligible: true,
      pirepStatus: "submitted",
    }),
    true,
  );
});

test("does not retroactively credit a flight before joining", () => {
  assert.equal(
    canCreditEventFlight({
      joinedAt: new Date("2026-08-12T10:00:00Z"),
      flightRecordedAt: new Date("2026-08-11T10:00:00Z"),
      eventStartsAt: start,
      eventEndsAt: end,
      routeEligible: true,
      pirepStatus: "submitted",
    }),
    false,
  );
});
