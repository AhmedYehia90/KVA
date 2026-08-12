import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCareerXp,
  calculateFlightSalary,
  canPilotControlFleet,
  eligibleCareerRank,
  isLedgerAmountValid,
  isPilotMarketplaceScope,
  routeSupportPercent,
} from "../src";

test("calculates salary from recorded block time", () => {
  assert.deepEqual(
    calculateFlightSalary(
      {
        baseSalary: 500,
        perBlockMinute: 10,
        performanceThreshold: 85,
        performanceBonus: 250,
      },
      {blockMinutes: 60},
    ),
    {salary: 1100, performanceBonus: 0, total: 1100},
  );
});

test("adds performance bonus only with qualifying evidence", () => {
  assert.equal(
    calculateFlightSalary(
      {
        baseSalary: 500,
        perBlockMinute: 10,
        performanceThreshold: 85,
        performanceBonus: 250,
      },
      {blockMinutes: 60, companionScore: 90},
    ).performanceBonus,
    250,
  );
});

test("career XP is deterministic from a completed flight", () => {
  assert.equal(calculateCareerXp(85), 185);
});

test("selects the highest eligible career rank", () => {
  assert.equal(
    eligibleCareerRank(
      [
        {code: "CADET", minimumHours: 0, minimumFlights: 0, priority: 1},
        {code: "FO", minimumHours: 10, minimumFlights: 5, priority: 2},
        {code: "CPT", minimumHours: 100, minimumFlights: 50, priority: 3},
      ],
      {totalMinutes: 1200, totalFlights: 10},
    )?.code,
    "FO",
  );
});

test("route support is capped at one hundred percent", () => {
  assert.equal(
    routeSupportPercent({fundedAmount: 4000, targetAmount: 3000}),
    100,
  );
});

test("pilot and company marketplaces remain separate", () => {
  assert.equal(isPilotMarketplaceScope("pilot"), true);
  assert.equal(isPilotMarketplaceScope("company"), false);
});

test("pilots never receive fleet-control authority", () => {
  assert.equal(canPilotControlFleet(), false);
});

test("ledger rejects zero and non-integer movements", () => {
  assert.equal(isLedgerAmountValid(0), false);
  assert.equal(isLedgerAmountValid(12.5), false);
  assert.equal(isLedgerAmountValid(-250), true);
});
