import type {
  MentorDebriefInput,
  MentorDebriefItem,
  MentorGoalCategory,
  MentorGoalRecommendation,
  MentorLessonStep,
  MentorSessionPlan,
} from "./types";

const systemOnlyCodes = new Set(["replay_integrity_warning"]);

function firstUsefulFocus(input: MentorDebriefInput): MentorDebriefItem {
  const performanceFocus = input.focusItems.find(
    (item) => !systemOnlyCodes.has(item.code),
  );

  return (
    performanceFocus ??
    input.focusItems[0] ?? {
      code: "consistency_next",
      title: "Repeat the standard",
      message:
        "No major focus item was detected. Reproduce the same stable result on the next flight.",
      evidence: {},
    }
  );
}

function categoryFor(code: string): MentorGoalCategory {
  if (code === "landing_firm" || code === "landing_hard") {
    return "landing_control";
  }

  if (code === "block_time_variance") {
    return "timing_control";
  }

  if (code === "landing_data_missing" || code === "fuel_data_missing") {
    return "data_discipline";
  }

  if (code === "replay_integrity_warning") {
    return "record_awareness";
  }

  return "consistency";
}

function lessonFor(
  category: MentorGoalCategory,
): MentorLessonStep[] {
  if (category === "landing_control") {
    return [
      {
        phase: "Before approach",
        title: "Create a stable setup",
        guidance:
          "Review the expected approach sequence early and avoid carrying unfinished tasks into the final segment.",
        why:
          "A settled setup leaves more attention for vertical-speed and flare control.",
      },
      {
        phase: "Final approach",
        title: "Protect the descent trend",
        guidance:
          "Watch the trend rather than chasing a single indication. Make small, early corrections.",
        why:
          "Large late corrections often create an unstable touchdown picture.",
      },
      {
        phase: "Flare and touchdown",
        title: "Reduce descent progressively",
        guidance:
          "Use a smooth transition and keep the correction proportional to what the aircraft is doing.",
        why:
          "Progressive control supports a consistent landing without forcing a cosmetic result.",
      },
    ];
  }

  if (category === "timing_control") {
    return [
      {
        phase: "Before departure",
        title: "Know the planned block time",
        guidance:
          "Keep the route plan visible and identify where taxi, cruise or turnaround variation is most likely.",
        why:
          "A clear baseline makes operational delays easier to understand after the flight.",
      },
      {
        phase: "During flight",
        title: "Observe the source of variance",
        guidance:
          "Notice whether the difference comes from ground time, cruise profile or operational interruption.",
        why:
          "The useful lesson is the cause of the variance, not the number alone.",
      },
      {
        phase: "After arrival",
        title: "Compare actual with planned",
        guidance:
          "Review the difference and record a brief explanation when it is material.",
        why:
          "Repeated comparisons build better planning judgment.",
      },
    ];
  }

  if (category === "data_discipline") {
    return [
      {
        phase: "Before flight",
        title: "Prepare the evidence fields",
        guidance:
          "Confirm that landing-rate and fuel-used values will be available before submitting the PIREP.",
        why:
          "The mentor can only coach from evidence that KVA OS actually records.",
      },
      {
        phase: "After landing",
        title: "Capture the values",
        guidance:
          "Record the available landing and fuel information before leaving the flight workflow.",
        why:
          "Complete records make later comparisons more precise.",
      },
      {
        phase: "Before submission",
        title: "Check completeness",
        guidance:
          "Review the PIREP fields once and leave unavailable data explicitly empty.",
        why:
          "Honest missing data is safer than estimated or invented data.",
      },
    ];
  }

  if (category === "record_awareness") {
    return [
      {
        phase: "Review",
        title: "Separate system evidence from pilot performance",
        guidance:
          "Treat replay-integrity warnings as data-quality notes unless another recorded metric supports a pilot-performance conclusion.",
        why:
          "A platform record problem must not become an unsupported judgment about the pilot.",
      },
      {
        phase: "Verification",
        title: "Use the source record",
        guidance:
          "Review the Black Box Replay integrity checks and identify which system link is incomplete.",
        why:
          "The exact warning is more useful than a generic caution.",
      },
    ];
  }

  return [
    {
      phase: "Before next flight",
      title: "Choose one repeatable cue",
      guidance:
        "Keep one short cue from this debrief and use it throughout the next flight.",
      why:
        "Consistency is easier to build when the next objective is simple and observable.",
    },
    {
      phase: "After next flight",
      title: "Compare, do not guess",
      guidance:
        "Use the next recorded debrief to confirm whether the standard was repeated.",
      why:
        "Progress should be based on evidence across flights.",
    },
  ];
}

function goalFor(
  category: MentorGoalCategory,
): MentorGoalRecommendation {
  const shared = {
    category,
    targetCount: category === "record_awareness" ? 1 : 2,
  };

  if (category === "landing_control") {
    return {
      ...shared,
      title: "Build consistent touchdown control",
      objective:
        "Record two later flights with a stable or excellent landing assessment.",
      successCodes: ["landing_stable", "landing_excellent"],
    };
  }

  if (category === "timing_control") {
    return {
      ...shared,
      title: "Improve block-time control",
      objective:
        "Complete two flights with precise or reasonable block-time variance.",
      successCodes: ["block_time_precise", "block_time_reasonable"],
    };
  }

  if (category === "data_discipline") {
    return {
      ...shared,
      title: "Complete the flight evidence",
      objective:
        "Submit two later PIREPs with landing-rate and fuel-used data recorded.",
      successCodes: ["landing_data_recorded", "fuel_data_recorded"],
    };
  }

  if (category === "record_awareness") {
    return {
      ...shared,
      title: "Verify the next operational record",
      objective:
        "Complete one flight whose Black Box Replay integrity is healthy.",
      successCodes: ["replay_integrity_healthy"],
    };
  }

  return {
    ...shared,
    title: "Repeat the operational standard",
    objective:
      "Complete two later flights with a score of at least 85 and a healthy replay.",
    successCodes: ["score_85_plus", "replay_integrity_healthy"],
  };
}

function openingMessage(
  tone: MentorDebriefInput["tone"],
  input: MentorDebriefInput,
  focus: MentorDebriefItem,
) {
  if (tone === "direct") {
    return `${input.flightNumber} is complete. Keep the strengths, then work on ${focus.title.toLowerCase()}.`;
  }

  if (tone === "professional") {
    return `${input.flightNumber} provides a clear learning point: preserve the successful elements and address ${focus.title.toLowerCase()}.`;
  }

  return `You completed ${input.flightNumber}. Keep what worked, and take one calm step toward ${focus.title.toLowerCase()}.`;
}

export function createMentorSession(
  input: MentorDebriefInput,
): MentorSessionPlan {
  const primaryFocus = firstUsefulFocus(input);
  const category = categoryFor(primaryFocus.code);

  return {
    primaryFocus,
    openingMessage: openingMessage(input.tone, input, primaryFocus),
    diagnosis:
      primaryFocus.code === "replay_integrity_warning"
        ? "The recorded concern belongs to the system evidence chain and is not automatically a pilot-performance issue."
        : `${primaryFocus.message} The mentor has converted this into a practical next-flight lesson.`,
    lessonPlan: lessonFor(category),
    recommendedGoal: goalFor(category),
  };
}
