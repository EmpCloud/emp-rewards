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

import {
  createReward,
  listRewards,
  getReward,
  redeemReward,
  deleteReward,
} from "./reward.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 1;
const USER_ID = 10;

function makeReward(overrides: Record<string, any> = {}) {
  return {
    id: "reward-1",
    organization_id: ORG_ID,
    name: "Gift Card $25",
    description: "Amazon gift card",
    category: "gift_cards",
    points_cost: 500,
    monetary_value: 2500,
    image_url: null,
    quantity_available: 10,
    is_active: true,
    created_at: new Date(),
    ...overrides,
  };
}

function makeBalance(overrides: Record<string, any> = {}) {
  return {
    id: "bal-1",
    organization_id: ORG_ID,
    user_id: USER_ID,
    total_earned: 1000,
    total_redeemed: 200,
    current_balance: 800,
    ...overrides,
  };
}

function makeRedemption(overrides: Record<string, any> = {}) {
  return {
    id: "red-1",
    organization_id: ORG_ID,
    user_id: USER_ID,
    reward_id: "reward-1",
    points_spent: 500,
    status: "pending",
    created_at: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("reward.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // createReward
  // -------------------------------------------------------------------------
  describe("createReward", () => {
    it("should create a reward in the catalog", async () => {
      const reward = makeReward();
      mockDB.create.mockResolvedValue(reward);

      const result = await createReward(ORG_ID, {
        name: "Gift Card $25",
        category: "gift_cards",
        points_cost: 500,
      });

      expect(result.name).toBe("Gift Card $25");
      expect(mockDB.create).toHaveBeenCalledWith(
        "reward_catalog",
        expect.objectContaining({
          organization_id: ORG_ID,
          name: "Gift Card $25",
          points_cost: 500,
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // listRewards
  // -------------------------------------------------------------------------
  describe("listRewards", () => {
    it("should return paginated rewards", async () => {
      mockDB.findMany.mockResolvedValue({
        data: [makeReward()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const result = await listRewards(ORG_ID, {});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("should filter by category", async () => {
      mockDB.findMany.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });

      await listRewards(ORG_ID, { category: "experiences" });

      expect(mockDB.findMany).toHaveBeenCalledWith(
        "reward_catalog",
        expect.objectContaining({
          filters: expect.objectContaining({ category: "experiences" }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // redeemReward — balance check
  // -------------------------------------------------------------------------
  describe("redeemReward", () => {
    it("should redeem reward and deduct points", async () => {
      const reward = makeReward({ points_cost: 500, quantity_available: 10 });
      const balance = makeBalance({ current_balance: 800 });
      const redemption = makeRedemption();

      // findOne calls in order: reward, balance
      mockDB.findOne
        .mockResolvedValueOnce(reward)   // reward lookup
        .mockResolvedValueOnce(balance); // balance lookup

      mockDB.update.mockResolvedValue(balance); // balance update
      mockDB.create
        .mockResolvedValueOnce({})           // point_transactions
        .mockResolvedValueOnce(redemption);  // reward_redemptions

      mockDB.raw.mockResolvedValue(undefined); // update transaction reference

      const result = await redeemReward(ORG_ID, USER_ID, "reward-1");

      expect(result.status).toBe("pending");
      // Balance should be updated: 800 - 500 = 300
      expect(mockDB.update).toHaveBeenCalledWith(
        "point_balances",
        "bal-1",
        expect.objectContaining({ current_balance: 300 }),
      );
    });

    it("should throw if insufficient balance", async () => {
      const reward = makeReward({ points_cost: 500 });
      const balance = makeBalance({ current_balance: 100 });

      mockDB.findOne
        .mockResolvedValueOnce(reward)
        .mockResolvedValueOnce(balance);

      await expect(redeemReward(ORG_ID, USER_ID, "reward-1")).rejects.toThrow("Insufficient points");
    });

    it("should throw if reward is out of stock", async () => {
      const reward = makeReward({ quantity_available: 0 });
      mockDB.findOne.mockResolvedValueOnce(reward);

      await expect(redeemReward(ORG_ID, USER_ID, "reward-1")).rejects.toThrow("out of stock");
    });

    it("should throw if reward not found or inactive", async () => {
      mockDB.findOne.mockResolvedValueOnce(null);

      await expect(redeemReward(ORG_ID, USER_ID, "nope")).rejects.toThrow("not found");
    });

    it("should decrement stock after redemption", async () => {
      const reward = makeReward({ points_cost: 100, quantity_available: 5 });
      const balance = makeBalance({ current_balance: 200 });

      mockDB.findOne
        .mockResolvedValueOnce(reward)
        .mockResolvedValueOnce(balance);
      mockDB.update.mockResolvedValue(balance);
      mockDB.create
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce(makeRedemption());
      mockDB.raw.mockResolvedValue(undefined);

      await redeemReward(ORG_ID, USER_ID, "reward-1");

      // Stock decremented from 5 to 4
      expect(mockDB.update).toHaveBeenCalledWith(
        "reward_catalog",
        "reward-1",
        expect.objectContaining({ quantity_available: 4 }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // deleteReward (soft delete)
  // -------------------------------------------------------------------------
  describe("deleteReward", () => {
    it("should soft-delete by marking inactive", async () => {
      mockDB.findOne.mockResolvedValue(makeReward());
      mockDB.update.mockResolvedValue(makeReward({ is_active: false }));

      const result = await deleteReward(ORG_ID, "reward-1");

      expect(mockDB.update).toHaveBeenCalledWith(
        "reward_catalog",
        "reward-1",
        expect.objectContaining({ is_active: false }),
      );
    });

    it("should throw NotFoundError for missing reward", async () => {
      mockDB.findOne.mockResolvedValue(null);

      await expect(deleteReward(ORG_ID, "nope")).rejects.toThrow("not found");
    });
  });
});
