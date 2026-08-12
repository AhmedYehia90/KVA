export type EconomyOwnerScope = "pilot" | "company";

export type MarketplaceScope = "pilot" | "company";

export interface SalaryPolicy {
  baseSalary: number;
  perBlockMinute: number;
  performanceThreshold: number;
  performanceBonus: number;
}

export interface SalaryEvidence {
  blockMinutes: number;
  companionScore?: number | null;
}

export interface CareerRank {
  code: string;
  minimumHours: number;
  minimumFlights: number;
  priority: number;
}

export interface CareerTotals {
  totalMinutes: number;
  totalFlights: number;
}

export interface RouteSupportProgress {
  fundedAmount: number;
  targetAmount: number;
}
