import assert from "node:assert/strict";
import test from "node:test";
import {
  canViewPassport,
  createPassportNumber,
  createPublicSlug,
  summarizeExperience,
} from "../src";

const pilotId = "516ad725-db6f-4998-9516-d64fa40fdd34";

test("creates a stable passport number", () => {
  assert.equal(
    createPassportNumber(pilotId),
    "UPP-516AD725DB6F49989516D64FA40FDD34",
  );
});

test("creates a safe public slug", () => {
  assert.equal(createPublicSlug("KVA 001", pilotId), "kva-001-516ad725");
});

test("enforces visibility", () => {
  assert.equal(canViewPassport("private", false, true), false);
  assert.equal(canViewPassport("network", false, true), true);
  assert.equal(canViewPassport("public", false, false), true);
});

test("summarizes portable experience", () => {
  assert.deepEqual(
    summarizeExperience([
      {blockMinutes: 90, status: "approved", organizationId: "airline-a"},
      {blockMinutes: 60, status: "submitted", organizationId: "airline-b"},
    ]),
    {
      totalFlights: 2,
      totalMinutes: 150,
      totalHours: 2.5,
      verifiedFlights: 1,
      verifiedMinutes: 90,
      verifiedHours: 1.5,
      organizations: 2,
    },
  );
});
