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
  deleteMany: vi.fn(),
  count: vi.fn(),
  raw: vi.fn(),
};

vi.mock("../../db/adapters", () => ({
  getDB: () => mockDB,
}));

vi.mock("../../utils/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Mock dependent services
vi.mock("../points/points.service", () => ({
  earnPoints: vi.fn().mockResolvedValue({ id: "txn-1" }),
  spendPoints: vi.fn().mockResolvedValue({ id: "txn-2" }),
}));

vi.mock("../slack/slack.service", () => ({
  sendKudosNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../teams/teams.service", () => ({
  sendKudosToTeams: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../push/push.service", () => ({
  notifyKudosReceived: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../milestone/milestone.service", () => ({
  checkMilestones: vi.fn().mockResolvedValue([]),
}));

import { sendKudos, listKudos, deleteKudos, addReaction, getKudos } from "./kudos.service";
import * as pointsService from "../points/points.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 1;
const SENDER_ID = 10;
const RECEIVER_ID = 20;

function makeKudos(overrides: Record<string, any> = {}) {
  return {
    id: "kudos-1",
    organization_id: ORG_ID,
    sender_id: SENDER_ID,
    receiver_id: RECEIVER_ID,
    category_id: null,
    message: "You did an amazing job!",
    points: 10,
    visibility: "public",
    feedback_type: "kudos",
    is_anonymous: false,
    created_at: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("kudos.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // sendKudos
  // -------------------------------------------------------------------------
  describe("sendKudos", () => {
    it("should create kudos and award points to receiver", async () => {
      // No settings - will use default 10 points
      mockDB.findOne.mockResolvedValue(null); // no recognition_settings
      mockDB.create.mockResolvedValue(makeKudos());

      const result = await sendKudos(ORG_ID, SENDER_ID, {
        receiver_id: RECEIVER_ID,
        message: "You did an amazing job!",
      });

      expect(result.id).toBe("kudos-1");
      expect(mockDB.create).toHaveBeenCalledWith(
        "kudos",
        expect.objectContaining({
          sender_id: SENDER_ID,
          receiver_id: RECEIVER_ID,
          points: 10,
        }),
      );

      // Points earned by receiver
      expect(pointsService.earnPoints).toHaveBeenCalledWith(
        ORG_ID,
        RECEIVER_ID,
        10,
        expect.any(String), // PointTransactionType
        "kudos",
        "kudos-1",
        expect.any(String),
      );
    });

    it("should award sender bonus (10% of points)", async () => {
      mockDB.findOne.mockResolvedValue(null);
      mockDB.create.mockResolvedValue(makeKudos({ points: 100 }));

      await sendKudos(ORG_ID, SENDER_ID, {
        receiver_id: RECEIVER_ID,
        message: "Great!",
        points: 100,
      });

      // Sender gets 10% = 10 points
      expect(pointsService.earnPoints).toHaveBeenCalledWith(
        ORG_ID,
        SENDER_ID,
        10,
        expect.any(String),
        "kudos",
        "kudos-1",
        "Bonus for sending kudos",
      );
    });

    it("should throw if self-kudos is not allowed", async () => {
      mockDB.findOne.mockResolvedValue({ allow_self_kudos: false, points_per_kudos: 10 }); // settings

      await expect(
        sendKudos(ORG_ID, SENDER_ID, {
          receiver_id: SENDER_ID,
          message: "Self praise",
        }),
      ).rejects.toThrow("cannot send kudos to yourself");
    });

    it("should throw if daily limit is reached", async () => {
      mockDB.findOne.mockResolvedValue({ max_kudos_per_day: 5, points_per_kudos: 10 });
      mockDB.raw.mockResolvedValue([[{ count: 5 }]]);

      await expect(
        sendKudos(ORG_ID, SENDER_ID, {
          receiver_id: RECEIVER_ID,
          message: "Great!",
        }),
      ).rejects.toThrow("daily kudos limit");
    });

    it("should apply category points multiplier", async () => {
      mockDB.findOne.mockResolvedValue(null); // no settings
      mockDB.findById.mockResolvedValue({
        id: "cat-1",
        organization_id: ORG_ID,
        points_multiplier: 2,
      });
      mockDB.create.mockResolvedValue(makeKudos({ points: 20 }));

      await sendKudos(ORG_ID, SENDER_ID, {
        receiver_id: RECEIVER_ID,
        message: "Wow",
        category_id: "cat-1",
      });

      // Points = 10 (default) * 2 (multiplier) = 20
      expect(mockDB.create).toHaveBeenCalledWith(
        "kudos",
        expect.objectContaining({ points: 20 }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // deleteKudos — points reversed
  // -------------------------------------------------------------------------
  describe("deleteKudos", () => {
    it("should delete kudos and reverse points", async () => {
      mockDB.findById.mockResolvedValue(makeKudos({ points: 50 }));
      mockDB.delete.mockResolvedValue(true);

      await deleteKudos(ORG_ID, "kudos-1", SENDER_ID);

      // Points reversed for receiver
      expect(pointsService.spendPoints).toHaveBeenCalledWith(
        ORG_ID,
        RECEIVER_ID,
        50,
        expect.any(String),
        "kudos",
        "kudos-1",
        expect.stringContaining("reversed"),
      );

      // Sender bonus reversed (10% of 50 = 5)
      expect(pointsService.spendPoints).toHaveBeenCalledWith(
        ORG_ID,
        SENDER_ID,
        5,
        expect.any(String),
        "kudos",
        "kudos-1",
        expect.stringContaining("reversed"),
      );

      expect(mockDB.delete).toHaveBeenCalledWith("kudos", "kudos-1");
    });

    it("should throw ForbiddenError if non-sender tries to delete", async () => {
      mockDB.findById.mockResolvedValue(makeKudos());

      await expect(deleteKudos(ORG_ID, "kudos-1", 999)).rejects.toThrow("sender");
    });

    it("should throw NotFoundError for missing kudos", async () => {
      mockDB.findById.mockResolvedValue(null);

      await expect(deleteKudos(ORG_ID, "nope", SENDER_ID)).rejects.toThrow("not found");
    });
  });

  // -------------------------------------------------------------------------
  // addReaction
  // -------------------------------------------------------------------------
  describe("addReaction", () => {
    it("should add a reaction to existing kudos", async () => {
      mockDB.findById.mockResolvedValue(makeKudos());
      mockDB.raw.mockResolvedValue(undefined);

      await addReaction(ORG_ID, "kudos-1", SENDER_ID, "thumbsup");

      expect(mockDB.raw).toHaveBeenCalledWith(
        expect.stringContaining("INSERT IGNORE INTO kudos_reactions"),
        expect.arrayContaining(["kudos-1", SENDER_ID, "thumbsup"]),
      );
    });

    it("should throw NotFoundError for missing kudos", async () => {
      mockDB.findById.mockResolvedValue(null);

      await expect(addReaction(ORG_ID, "nope", SENDER_ID, "heart")).rejects.toThrow("not found");
    });
  });

  // -------------------------------------------------------------------------
  // listKudos
  // -------------------------------------------------------------------------
  describe("listKudos", () => {
    it("should return paginated kudos", async () => {
      mockDB.findMany.mockResolvedValue({
        data: [makeKudos()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const result = await listKudos(ORG_ID, {});

      expect(result.data).toHaveLength(1);
    });
  });
});
