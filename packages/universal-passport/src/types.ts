export type PassportVisibility = "private" | "network" | "public";

export interface ExperienceEntry {
  blockMinutes: number;
  status: string;
  organizationId: string;
}

export interface ExperienceSummary {
  totalFlights: number;
  totalMinutes: number;
  totalHours: number;
  verifiedFlights: number;
  verifiedMinutes: number;
  verifiedHours: number;
  organizations: number;
}
