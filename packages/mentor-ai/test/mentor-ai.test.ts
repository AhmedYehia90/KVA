import assert from "node:assert/strict";
import test from "node:test";
import {
  createMentorSession,
  evaluateMentorGoal,
  type MentorDebriefInput,
} from "../src";

function input(
  overrides: Partial<MentorDebriefInput> = {},
): MentorDebriefInput {
  return {
    debriefId: "debrief-1",
    flightNumber: "KVA145",
    tone: "supportive",
    score: 80,
    confidence: 0.8,
    summary: "Flight complete.",
    strengths: [],
    focusItems: [],
    replayHealthy: true,
    ...overrides,
  };
}

test("creates a landing-control lesson for a firm landing", () => {
  const session = createMentorSession(
    input({
      focusItems: [
        {
          code: "landing_firm",
          title: "Refine the flare",
          message: "The landing was firm.",
        },
      ],
    }),
  );

  assert.equal(
    session.recommendedGoal.category,
    "landing_control",
  );
  assert.equal(session.lessonPlan.length, 3);
});

test("creates a data-discipline lesson when evidence is missing", () => {
  const session = createMentorSession(
    input({
      focusItems: [
        {
          code: "landing_data_missing",
          title: "Capture landing data",
          message: "No landing rate was recorded.",
        },
      ],
    }),
  );

  assert.equal(
    session.recommendedGoal.category,
    "data_discipline",
  );
});

test("does not prioritize a system warning over a pilot focus", () => {
  const session = createMentorSession(
    input({
      focusItems: [
        {
          code: "replay_integrity_warning",
          title: "System record note",
          message: "The record has a warning.",
        },
        {
          code: "fuel_data_missing",
          title: "Record fuel usage",
          message: "Fuel data was missing.",
        },
      ],
    }),
  );

  assert.equal(session.primaryFocus.code, "fuel_data_missing");
});

test("uses the direct tone", () => {
  const session = createMentorSession(
    input({
      tone: "direct",
      focusItems: [
        {
          code: "block_time_variance",
          title: "Review flight timing",
          message: "Timing varied.",
        },
      ],
    }),
  );

  assert.match(session.openingMessage, /is complete/i);
});

test("progresses a landing goal from recorded strength", () => {
  const result = evaluateMentorGoal(
    {
      category: "landing_control",
      progressCount: 1,
      targetCount: 2,
    },
    input({
      strengths: [
        {
          code: "landing_stable",
          title: "Stable landing",
          message: "Stable.",
        },
      ],
    }),
  );

  assert.equal(result.progressed, true);
  assert.equal(result.completed, true);
});

test("keeps data-discipline goal pending when fuel is missing", () => {
  const result = evaluateMentorGoal(
    {
      category: "data_discipline",
      progressCount: 0,
      targetCount: 2,
    },
    input({
      focusItems: [
        {
          code: "fuel_data_missing",
          title: "Record fuel usage",
          message: "Missing.",
        },
      ],
    }),
  );

  assert.equal(result.progressed, false);
});
