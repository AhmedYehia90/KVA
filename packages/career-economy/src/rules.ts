import type {
  CareerRank,
  CareerTotals,
  MarketplaceScope,
  RouteSupportProgress,
  SalaryEvidence,
  SalaryPolicy,
} from "./types";

export function calculateFlightSalary(
  policy: SalaryPolicy,
  evidence: SalaryEvidence,
) {
  const base =
    Math.max(0, Math.trunc(policy.baseSalary)) +
    Math.max(0, Math.trunc(evidence.blockMinutes)) *
      Math.max(0, Math.trunc(policy.perBlockMinute));

  const bonus =
    evidence.companionScore != null &&
    evidence.companionScore >= policy.performanceThreshold
      ? Math.max(0, Math.trunc(policy.performanceBonus))
      : 0;

  return {
    salary: base,
    performanceBonus: bonus,
    total: base + bonus,
  };
}

export function calculateCareerXp(blockMinutes: number) {
  return 100 + Math.max(0, Math.trunc(blockMinutes));
}

export function eligibleCareerRank(
  ranks: CareerRank[],
  totals: CareerTotals,
) {
  const hours = Math.max(0, totals.totalMinutes) / 60;

  return [...ranks]
    .filter(
      (rank) =>
        hours >= rank.minimumHours &&
        totals.totalFlights >= rank.minimumFlights,
    )
    .sort((a, b) => b.priority - a.priority)[0] ?? null;
}

export function routeSupportPercent(
  progress: RouteSupportProgress,
) {
  if (progress.targetAmount <= 0) return 0;

  return Math.min(
    100,
    Math.round(
      progress.fundedAmount / progress.targetAmount * 100,
    ),
  );
}

export function isPilotMarketplaceScope(scope: MarketplaceScope) {
  return scope === "pilot";
}

export function canPilotControlFleet() {
  return false;
}

export function isLedgerAmountValid(amount: number) {
  return Number.isFinite(amount) && Number.isInteger(amount) && amount !== 0;
}
