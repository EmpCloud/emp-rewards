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

vi.mock("../points/points.service", () => ({
  earnPoints: vi.fn().mockResolvedValue({ id: "txn-1" }),
}));

import {
  createBadge,
  listBadges,
  getBadge,
  awardBadge,
  getUserBadges,
  deleteBadge,
} from "./badge.service";
import * as pointsService from "../points/points.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 1;
const USER_ID = 10;
const ADMIN_ID = 5;

function makeBadge(overrides: Record<string, any> = {}) {
  return {
    id: "badge-1",
    organization_id: ORG_ID,
    name: "Team Player",
    description: "Awarded to great team players",
    icon_url: null,
    criteria_type: "manual",
    criteria_value: null,
    points_awarded: 50,
    is_active: true,
    created_at: new Date(),
    ...overrides,
  };
}

function makeUserBadge(overrides: Record<string, any> = {}) {
  return {
    id: "ub-1",
    organization_id: ORG_ID,
    user_id: USER_ID,
    badge_id: "badge-1",
    awarded_by: ADMIN_ID,
    awarded_reason: "Outstanding contribution",
    created_at: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("badge.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // createBadge
  // -------------------------------------------------------------------------
  describe("createBadge", () => {
    it("should create a badge with provided data", async () => {
      const badge = makeBadge();
      mockDB.create.mockResolvedValue(badge);

      const result = await createBadge(ORG_ID, {
        name: "Team Player",
        description: "Awarded to great team players",
        criteria_type: "manual",
        points_awarded: 50,
      });

      expect(result.name).toBe("Team Player");
      expect(mockDB.create).toHaveBeenCalledWith(
        "badge_definitions",
        expect.objectContaining({
          organization_id: ORG_ID,
          name: "Team Player",
          points_awarded: 50,
          is_active: true,
        }),
      );
    });

    it("should default is_active to true", async () => {
      mockDB.create.mockResolvedValue(makeBadge());

      await createBadge(ORG_ID, { name: "Test", criteria_type: "manual" });

      expect(mockDB.create).toHaveBeenCalledWith(
        "badge_definitions",
        expect.objectContaining({ is_active: true }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // listBadges
  // -------------------------------------------------------------------------
  describe("listBadges", () => {
    it("should return active badges for org", async () => {
      mockDB.findMany.mockResolvedValue({
        data: [makeBadge(), makeBadge({ id: "badge-2", name: "Innovator" })],
        total: 2,
        page: 1,
        limit: 100,
        totalPages: 1,
      });

      const result = await listBadges(ORG_ID);

      expect(result).toHaveLength(2);
      expect(mockDB.findMany).toHaveBeenCalledWith(
        "badge_definitions",
        expect.objectContaining({
          filters: expect.objectContaining({ organization_id: ORG_ID, is_active: true }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // awardBadge
  // -------------------------------------------------------------------------
  describe("awardBadge", () => {
    it("should award badge and credit points", async () => {
      mockDB.findById.mockResolvedValue(makeBadge({ points_awarded: 50 }));
      mockDB.findOne.mockResolvedValue(null); // not already awarded
      mockDB.create.mockResolvedValue(makeUserBadge());

      const result = await awardBadge(ORG_ID, USER_ID, "badge-1", ADMIN_ID, "Outstanding contribution");

      expect(result.user_id).toBe(USER_ID);
      expect(pointsService.earnPoints).toHaveBeenCalledWith(
        ORG_ID,
        USER_ID,
        50,
        expect.any(String),
        "badge",
        "badge-1",
        expect.stringContaining("Team Player"),
      );
    });

    it("should throw BADGE_ALREADY_AWARDED if user has badge", async () => {
      mockDB.findById.mockResolvedValue(makeBadge());
      mockDB.findOne.mockResolvedValue(makeUserBadge()); // already awarded

      await expect(awardBadge(ORG_ID, USER_ID, "badge-1", ADMIN_ID, null)).rejects.toThrow("already");
    });

    it("should throw NotFoundError for inactive badge", async () => {
      mockDB.findById.mockResolvedValue(makeBadge({ is_active: false }));

      await expect(awardBadge(ORG_ID, USER_ID, "badge-1", ADMIN_ID, null)).rejects.toThrow("not found");
    });

    it("should not credit points when badge has zero points", async () => {
      mockDB.findById.mockResolvedValue(makeBadge({ points_awarded: 0 }));
      mockDB.findOne.mockResolvedValue(null);
      mockDB.create.mockResolvedValue(makeUserBadge());

      await awardBadge(ORG_ID, USER_ID, "badge-1", ADMIN_ID, null);

      expect(pointsService.earnPoints).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getUserBadges
  // -------------------------------------------------------------------------
  describe("getUserBadges", () => {
    it("should return badges for a user", async () => {
      mockDB.findMany.mockResolvedValue({
        data: [makeUserBadge()],
        total: 1,
        page: 1,
        limit: 100,
        totalPages: 1,
      });

      const result = await getUserBadges(ORG_ID, USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0].badge_id).toBe("badge-1");
    });
  });

  // -------------------------------------------------------------------------
  // deleteBadge (soft delete)
  // -------------------------------------------------------------------------
  describe("deleteBadge", () => {
    it("should soft-delete by setting is_active=false", async () => {
      mockDB.findById.mockResolvedValue(makeBadge());
      mockDB.update.mockResolvedValue(makeBadge({ is_active: false }));

      await deleteBadge(ORG_ID, "badge-1");

      expect(mockDB.update).toHaveBeenCalledWith("badge_definitions", "badge-1", { is_active: false });
    });

    it("should throw NotFoundError for missing badge", async () => {
      mockDB.findById.mockResolvedValue(null);

      await expect(deleteBadge(ORG_ID, "nope")).rejects.toThrow("not found");
    });
  });
});
