import type {
  CompanionTone,
  DebriefItem,
  FlightDebrief,
  FlightDebriefInput,
} from "./types";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function absoluteLandingRate(value: number | null) {
  return value === null ? null : Math.abs(value);
}

function toneSummary(
  tone: CompanionTone,
  score: number,
  flightNumber: string,
) {
  if (tone === "direct") {
    return score >= 85
      ? `${flightNumber} met a strong operational standard. Preserve the same discipline.`
      : `${flightNumber} is complete. Review the focus items before the next flight.`;
  }

  if (tone === "professional") {
    return score >= 85
      ? `${flightNumber} demonstrates a strong and consistent operational result.`
      : `${flightNumber} was completed successfully with clear areas for continued improvement.`;
  }

  return score >= 85
    ? `Well flown. ${flightNumber} shows calm, consistent progress you can build on.`
    : `Flight complete. ${flightNumber} gives you useful experience, and the next improvement is already clear.`;
}

export function generateFlightDebrief(
  input: FlightDebriefInput,
): FlightDebrief {
  const tone = input.tone ?? "supportive";
  const strengths: DebriefItem[] = [];
  const focusItems: DebriefItem[] = [];
  let score = 70;
  let evidencePoints = 1;

  const landingRate = absoluteLandingRate(input.landingRate);

  if (landingRate === null) {
    focusItems.push({
      code: "landing_data_missing",
      title: "Capture landing data",
      message:
        "No landing rate was recorded, so the companion cannot assess touchdown consistency.",
      evidence: {landingRate: null},
    });
  } else {
    evidencePoints += 1;

    if (landingRate <= 150) {
      score += 20;
      strengths.push({
        code: "landing_excellent",
        title: "Excellent touchdown control",
        message:
          "The recorded landing rate indicates a smooth and highly controlled touchdown.",
        evidence: {landingRate: input.landingRate},
      });
    } else if (landingRate <= 300) {
      score += 14;
      strengths.push({
        code: "landing_stable",
        title: "Stable landing",
        message:
          "The touchdown remained inside a solid operational range.",
        evidence: {landingRate: input.landingRate},
      });
    } else if (landingRate <= 500) {
      score += 4;
      focusItems.push({
        code: "landing_firm",
        title: "Refine the flare",
        message:
          "The landing was firm. Review flare timing and vertical-speed control.",
        evidence: {landingRate: input.landingRate},
      });
    } else {
      score -= 16;
      focusItems.push({
        code: "landing_hard",
        title: "Review touchdown technique",
        message:
          "The recorded landing rate is outside the preferred range and deserves a focused review.",
        evidence: {landingRate: input.landingRate},
      });
    }
  }

  let varianceMinutes: number | null = null;
  let variancePercent: number | null = null;

  if (
    input.plannedBlockMinutes !== null &&
    input.plannedBlockMinutes > 0
  ) {
    evidencePoints += 1;
    varianceMinutes = input.blockMinutes - input.plannedBlockMinutes;
    variancePercent =
      Math.abs(varianceMinutes) / input.plannedBlockMinutes * 100;

    if (variancePercent <= 10) {
      score += 10;
      strengths.push({
        code: "block_time_precise",
        title: "Accurate operational timing",
        message:
          "Actual block time remained close to the published plan.",
        evidence: {
          blockMinutes: input.blockMinutes,
          plannedBlockMinutes: input.plannedBlockMinutes,
          varianceMinutes,
        },
      });
    } else if (variancePercent <= 25) {
      score += 5;
      strengths.push({
        code: "block_time_reasonable",
        title: "Reasonable block-time control",
        message:
          "The flight remained within a reasonable timing variance.",
        evidence: {
          blockMinutes: input.blockMinutes,
          plannedBlockMinutes: input.plannedBlockMinutes,
          varianceMinutes,
        },
      });
    } else {
      score -= 6;
      focusItems.push({
        code: "block_time_variance",
        title: "Review flight timing",
        message:
          "Actual block time differed materially from the route plan. Review taxi, cruise and turnaround timing.",
        evidence: {
          blockMinutes: input.blockMinutes,
          plannedBlockMinutes: input.plannedBlockMinutes,
          varianceMinutes,
          variancePercent: Math.round(variancePercent * 10) / 10,
        },
      });
    }
  }

  if (input.fuelUsedKg !== null) {
    evidencePoints += 1;
    strengths.push({
      code: "fuel_data_recorded",
      title: "Fuel data recorded",
      message:
        "Fuel usage was captured, improving the quality of future operational comparisons.",
      evidence: {fuelUsedKg: input.fuelUsedKg},
    });
  } else {
    focusItems.push({
      code: "fuel_data_missing",
      title: "Record fuel usage",
      message:
        "Adding fuel-used data will make future debriefs more precise.",
      evidence: {fuelUsedKg: null},
    });
  }

  if (input.replayHealthy === true) {
    evidencePoints += 1;
    score += 6;
    strengths.push({
      code: "replay_integrity_healthy",
      title: "Complete operational record",
      message:
        "The flight event chain is complete and agrees with the operational projection.",
      evidence: {replayHealthy: true},
    });
  } else if (input.replayHealthy === false) {
    evidencePoints += 1;
    score -= 4;
    focusItems.push({
      code: "replay_integrity_warning",
      title: "System record note",
      message:
        "The flight record contains an integrity warning. This is an operational data note, not automatically a pilot-performance issue.",
      evidence: {replayHealthy: false},
    });
  }

  if (focusItems.length === 0) {
    focusItems.push({
      code: "consistency_next",
      title: "Repeat the standard",
      message:
        "No major focus item was detected. Aim to reproduce the same stable result on the next flight.",
      evidence: {},
    });
  }

  const finalScore = clamp(Math.round(score), 0, 100);
  const confidence = clamp(
    Math.round((evidencePoints / 5) * 100) / 100,
    0.2,
    1,
  );

  const headline =
    finalScore >= 90
      ? "Excellent operational performance"
      : finalScore >= 80
        ? "Strong and controlled flight"
        : finalScore >= 65
          ? "Flight complete with useful progress"
          : "Focused review recommended";

  return {
    score: finalScore,
    confidence,
    tone,
    headline,
    summary: toneSummary(tone, finalScore, input.flightNumber),
    strengths,
    focusItems,
    metrics: {
      blockMinutes: input.blockMinutes,
      plannedBlockMinutes: input.plannedBlockMinutes,
      blockVarianceMinutes: varianceMinutes,
      blockVariancePercent:
        variancePercent === null
          ? null
          : Math.round(variancePercent * 10) / 10,
      landingRate: input.landingRate,
      fuelUsedKg: input.fuelUsedKg,
      replayHealthy: input.replayHealthy,
    },
  };
}
