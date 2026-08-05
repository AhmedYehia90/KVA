import type {
  ExperienceEntry,
  ExperienceSummary,
  PassportVisibility,
} from "./types";

export function createPassportNumber(pilotId: string): string {
  const normalized = pilotId.replaceAll("-", "").toUpperCase();
  if (!/^[0-9A-F]{32}$/.test(normalized)) {
    throw new Error("pilotId must be a UUID.");
  }
  return `UPP-${normalized}`;
}

export function createPublicSlug(callsign: string, pilotId: string): string {
  const call = callsign
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const suffix = pilotId.replaceAll("-", "").slice(0, 8).toLowerCase();
  return `${call || "pilot"}-${suffix}`;
}

export function canViewPassport(
  visibility: PassportVisibility,
  viewerIsOwner: boolean,
  viewerIsNetworkMember: boolean,
): boolean {
  if (viewerIsOwner) return true;
  if (visibility === "public") return true;
  return visibility === "network" && viewerIsNetworkMember;
}

export function summarizeExperience(
  entries: ExperienceEntry[],
): ExperienceSummary {
  const totalMinutes = entries.reduce(
    (sum, entry) => sum + Math.max(0, Math.trunc(entry.blockMinutes)),
    0,
  );
  const verified = entries.filter((entry) => entry.status === "approved");
  const verifiedMinutes = verified.reduce(
    (sum, entry) => sum + Math.max(0, Math.trunc(entry.blockMinutes)),
    0,
  );
  return {
    totalFlights: entries.length,
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    verifiedFlights: verified.length,
    verifiedMinutes,
    verifiedHours: Math.round((verifiedMinutes / 60) * 10) / 10,
    organizations: new Set(entries.map((entry) => entry.organizationId)).size,
  };
}
