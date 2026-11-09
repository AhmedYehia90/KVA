type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const text = (value: unknown) => typeof value === "string" ? value : "";
const numeric = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const records = (value: unknown): RecordValue[] => Array.isArray(value) ? value.map(object) : [];

/** Explicit public DTO. Never spread an RPC result into public output or component props. */
export function toPublicPassport(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = object(value);
  if (!text(data.passportNumber) || !text(data.publicSlug)) return null;
  const rank = object(data.currentRank);
  const experience = object(data.experience);
  const callsign = text(data.callsign);
  return {
    passportNumber: text(data.passportNumber),
    publicSlug: text(data.publicSlug),
    issuedAt: text(data.issuedAt),
    callsign: /^[A-Z0-9-]{2,32}$/i.test(callsign) ? callsign : "Pilot",
    totalHours: numeric(data.totalHours),
    totalFlights: numeric(data.totalFlights),
    currentRank: {code: text(rank.code), name: text(rank.name)},
    memberships: records(data.memberships).map(row => ({
      organizationId: text(row.organizationId), organizationCode: text(row.organizationCode),
      organizationName: text(row.organizationName), role: text(row.role), status: text(row.status),
      joinedAt: text(row.joinedAt), isPrimary: row.isPrimary === true,
    })),
    qualifications: records(data.qualifications).map(row => ({
      code: text(row.code), name: text(row.name), status: text(row.status),
      issuedAt: text(row.issuedAt), expiresAt: text(row.expiresAt), aircraftType: text(row.aircraftType),
    })),
    experience: {
      flights: numeric(experience.flights), hours: numeric(experience.hours),
      verifiedFlights: numeric(experience.verifiedFlights), verifiedHours: numeric(experience.verifiedHours),
    },
  };
}
