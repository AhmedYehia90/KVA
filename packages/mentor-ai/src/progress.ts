import type {
  MentorDebriefInput,
  MentorGoalEvaluation,
  MentorGoalState,
} from "./types";

function hasCode(
  items: MentorDebriefInput["strengths"],
  codes: string[],
) {
  return items.some((item) => codes.includes(item.code));
}

export function evaluateMentorGoal(
  goal: MentorGoalState,
  debrief: MentorDebriefInput,
): MentorGoalEvaluation {
  let progressed = false;
  let reason = "The available evidence did not yet meet this goal.";

  if (goal.category === "landing_control") {
    progressed = hasCode(debrief.strengths, [
      "landing_stable",
      "landing_excellent",
    ]);
    reason = progressed
      ? "The debrief recorded a stable or excellent landing."
      : reason;
  } else if (goal.category === "timing_control") {
    progressed = hasCode(debrief.strengths, [
      "block_time_precise",
      "block_time_reasonable",
    ]);
    reason = progressed
      ? "The flight stayed inside the accepted block-time range."
      : reason;
  } else if (goal.category === "data_discipline") {
    const landingRecorded = !debrief.focusItems.some(
      (item) => item.code === "landing_data_missing",
    );
    const fuelRecorded = hasCode(debrief.strengths, [
      "fuel_data_recorded",
    ]);
    progressed = landingRecorded && fuelRecorded;
    reason = progressed
      ? "Landing and fuel evidence were both recorded."
      : reason;
  } else if (goal.category === "record_awareness") {
    progressed = debrief.replayHealthy === true;
    reason = progressed
      ? "The next flight record passed replay integrity."
      : reason;
  } else {
    progressed =
      debrief.score >= 85 && debrief.replayHealthy === true;
    reason = progressed
      ? "The flight score and replay integrity both met the consistency standard."
      : reason;
  }

  const progressCount = progressed
    ? Math.min(goal.targetCount, goal.progressCount + 1)
    : goal.progressCount;

  return {
    progressed,
    completed: progressCount >= goal.targetCount,
    progressCount,
    reason,
  };
}
