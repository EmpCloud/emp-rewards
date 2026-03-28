import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock DB adapter
// ---------------------------------------------------------------------------

const mockDB = {
  create: vi.fn(),
  findOne: vi.fn(),
  findMany: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
  raw: vi.fn(),
};

vi.mock("../../db/adapters", () => ({
  getDB: () => mockDB,
}));

vi.mock("../../utils/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { getBalance, earnPoints, spendPoints, adjustPoints } from "./points.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 1;
const USER_ID = 10;

function makeBalance(overrides: Record<string, any> = {}) {
  return {
    id: "bal-1",
    organization_id: ORG_ID,
    user_id: USER_ID,
    total_earned: 100,
    total_redeemed: 20,
    current_balance: 80,
    ...overrides,
  };
}

function makeTxn(overrides: Record<string, any> = {}) {
  return {
    id: "txn-1",
    organization_id: ORG_ID,
    user_id: USER_ID,
    type: "kudos_received",
    amount: 10,
    balance_after: 90,
    reference_type: null,
    reference_id: null,
    description: null,
    created_at: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("points.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // getBalance
  // -------------------------------------------------------------------------
  describe("getBalance", () => {
    it("should return existing balance", async () => {
      const balance = makeBalance();
      mockDB.findOne.mockResolvedValue(balance);

      const result = await getBalance(ORG_ID, USER_ID);

      expect(result.current_balance).toBe(80);
    });

    it("should auto-create zero balance if none exists", async () => {
      mockDB.findOne.mockResolvedValue(null);
      const newBalance = makeBalance({ total_earned: 0, total_redeemed: 0, current_balance: 0 });
      mockDB.create.mockResolvedValue(newBalance);

      const result = await getBalance(ORG_ID, USER_ID);

      expect(mockDB.create).toHaveBeenCalledWith(
        "point_balances",
        expect.objectContaining({
          organization_id: ORG_ID,
          user_id: USER_ID,
          total_earned: 0,
          current_balance: 0,
        }),
      );
      expect(result.current_balance).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // earnPoints
  // -------------------------------------------------------------------------
  describe("earnPoints", () => {
    it("should credit points and create transaction", async () => {
      mockDB.findOne.mockResolvedValue(makeBalance());
      mockDB.raw.mockResolvedValue(undefined);
      mockDB.create.mockResolvedValue(makeTxn({ amount: 50, balance_after: 130 }));

      const result = await earnPoints(
        ORG_ID,
        USER_ID,
        50,
        "kudos_received" as any,
        "kudos",
        "k-1",
        "Kudos received",
      );

      expect(mockDB.raw).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE point_balances"),
        [150, 130, "bal-1"], // total_earned=100+50, current_balance=80+50
      );
      expect(result.amount).toBe(50);
    });

    it("should throw if amount is zero or negative", async () => {
      await expect(earnPoints(ORG_ID, USER_ID, 0, "kudos_received" as any, null, null, null)).rejects.toThrow("positive");
      await expect(earnPoints(ORG_ID, USER_ID, -5, "kudos_received" as any, null, null, null)).rejects.toThrow("positive");
    });
  });

  // -------------------------------------------------------------------------
  // spendPoints
  // -------------------------------------------------------------------------
  describe("spendPoints", () => {
    it("should deduct points and create a negative transaction", async () => {
      mockDB.findOne.mockResolvedValue(makeBalance({ current_balance: 100 }));
      mockDB.raw.mockResolvedValue(undefined);
      mockDB.create.mockResolvedValue(makeTxn({ amount: -30, balance_after: 70 }));

      const result = await spendPoints(
        ORG_ID,
        USER_ID,
        30,
        "redemption" as any,
        "reward",
        "r-1",
        "Redeemed gift card",
      );

      expect(result.amount).toBe(-30);
    });

    it("should throw INSUFFICIENT_BALANCE when balance too low", async () => {
      mockDB.findOne.mockResolvedValue(makeBalance({ current_balance: 5 }));

      await expect(
        spendPoints(ORG_ID, USER_ID, 50, "redemption" as any, null, null, null),
      ).rejects.toThrow("Not enough points");
    });

    it("should throw if amount is zero or negative", async () => {
      await expect(spendPoints(ORG_ID, USER_ID, 0, "redemption" as any, null, null, null)).rejects.toThrow("positive");
    });

    it("should handle exact balance (race condition guard)", async () => {
      mockDB.findOne.mockResolvedValue(makeBalance({ current_balance: 30 }));
      mockDB.raw.mockResolvedValue(undefined);
      mockDB.create.mockResolvedValue(makeTxn({ amount: -30, balance_after: 0 }));

      const result = await spendPoints(
        ORG_ID,
        USER_ID,
        30,
        "redemption" as any,
        null,
        null,
        null,
      );

      expect(result.balance_after).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // adjustPoints
  // -------------------------------------------------------------------------
  describe("adjustPoints", () => {
    it("should positively adjust balance", async () => {
      mockDB.findOne.mockResolvedValue(makeBalance({ current_balance: 50, total_earned: 50 }));
      mockDB.raw.mockResolvedValue(undefined);
      mockDB.create.mockResolvedValue(makeTxn({ amount: 20, balance_after: 70 }));

      const result = await adjustPoints(ORG_ID, USER_ID, 20, "Admin bonus");

      expect(result.amount).toBe(20);
    });

    it("should reject negative adjustment that would result in negative balance", async () => {
      mockDB.findOne.mockResolvedValue(makeBalance({ current_balance: 10, total_earned: 10, total_redeemed: 0 }));

      await expect(adjustPoints(ORG_ID, USER_ID, -20, "Penalty")).rejects.toThrow("negative balance");
    });

    it("should allow negative adjustment within balance", async () => {
      mockDB.findOne.mockResolvedValue(makeBalance({ current_balance: 50, total_earned: 50, total_redeemed: 0 }));
      mockDB.raw.mockResolvedValue(undefined);
      mockDB.create.mockResolvedValue(makeTxn({ amount: -10, balance_after: 40 }));

      const result = await adjustPoints(ORG_ID, USER_ID, -10, "Correction");

      expect(result.amount).toBe(-10);
    });
  });
});
