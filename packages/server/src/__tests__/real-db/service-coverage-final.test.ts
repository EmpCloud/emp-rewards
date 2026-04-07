// ============================================================================
// EMP REWARDS — Service Coverage Final Tests
// Targets: badge, budget, kudos, leaderboard, points, celebration, errors
// ============================================================================

process.env.DB_HOST = "localhost";
process.env.DB_PORT = "3306";
process.env.DB_USER = "empcloud";
process.env.DB_PASSWORD = "EmpCloud2026";
process.env.DB_NAME = "emp_rewards";
process.env.DB_PROVIDER = "mysql";
process.env.EMPCLOUD_DB_HOST = "localhost";
process.env.EMPCLOUD_DB_PORT = "3306";
process.env.EMPCLOUD_DB_USER = "empcloud";
process.env.EMPCLOUD_DB_PASSWORD = "EmpCloud2026";
process.env.EMPCLOUD_DB_NAME = "empcloud";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-cov-final";
process.env.EMPCLOUD_URL = "http://localhost:3000";
process.env.LOG_LEVEL = "error";

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { initDB, closeDB, getDB } from "../../db/adapters";
import { initEmpCloudDB, closeEmpCloudDB } from "../../db/empcloud";

vi.mock("../../services/push/push.service", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}));

let db: ReturnType<typeof getDB>;
let dbReady = false;
const ORG = 5;
const U = String(Date.now()).slice(-6);

beforeAll(async () => {
  try {
    await initDB();
    await initEmpCloudDB();
    db = getDB();
    dbReady = true;
  } catch {
    // DB not available — tests will be skipped
  }
}, 30000);

beforeEach((ctx) => { if (!dbReady) ctx.skip(); });

afterAll(async () => {
  if (!dbReady) return;
  try { await closeEmpCloudDB(); } catch {}
  try { await closeDB(); } catch {}
}, 10000);

// ── ERROR CLASSES ────────────────────────────────────────────────────────────

describe("Rewards error classes", () => {
  let errors: any;

  beforeAll(async () => {
    errors = await import("../../utils/errors");
  });

  it("NotFoundError with resource and id", () => {
    const err = new errors.NotFoundError("Badge", "abc-123");
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain("abc-123");
  });

  it("ValidationError", () => {
    const err = new errors.ValidationError("Invalid points");
    expect(err.statusCode).toBe(400);
  });

  it("ForbiddenError", () => {
    const err = new errors.ForbiddenError();
    expect(err.statusCode).toBe(403);
  });

  it("ConflictError", () => {
    const err = new errors.ConflictError("Already awarded");
    expect(err.statusCode).toBe(409);
  });
});

// ── BADGE SERVICE ────────────────────────────────────────────────────────────

describe("Badge service", () => {
  let badgeService: any;
  let badgeId: string;

  beforeAll(async () => {
    badgeService = await import("../../services/badge/badge.service");
  });

  afterAll(async () => {
    try { if (badgeId) await db.delete("badge_definitions", badgeId); } catch {}
  });

  it("createBadge", async () => {
    const result = await badgeService.createBadge(ORG, {
      name: "CovBadge-" + U,
      description: "Test badge",
      icon: "star",
      criteria: "test coverage",
    });
    expect(result).toBeDefined();
    expect(result.name).toBe("CovBadge-" + U);
    badgeId = result.id;
  });

  it("listBadges returns array", async () => {
    const result = await badgeService.listBadges(ORG);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("getBadge", async () => {
    const result = await badgeService.getBadge(ORG, badgeId);
    expect(result.name).toContain("CovBadge");
  });

  it("getBadge throws NotFoundError", async () => {
    await expect(badgeService.getBadge(ORG, "nonexistent"))
      .rejects.toThrow();
  });

  it("updateBadge", async () => {
    const result = await badgeService.updateBadge(ORG, badgeId, {
      description: "Updated desc",
    });
    expect(result.description).toBe("Updated desc");
  });
});

// ── POINTS SERVICE ───────────────────────────────────────────────────────────

describe("Points service", () => {
  let pointsService: any;

  beforeAll(async () => {
    pointsService = await import("../../services/points/points.service");
  });

  it("getBalance returns balance for unknown user", async () => {
    const result = await pointsService.getBalance(ORG, 999999);
    expect(result).toBeDefined();
    // Balance object may have total, available, etc.
    expect(typeof result === "object").toBe(true);
  });

  it("getTransactions returns data for unknown user", async () => {
    const result = await pointsService.getTransactions(ORG, 999999, {});
    expect(result).toBeDefined();
  });
});

// ── KUDOS SERVICE — error branches ───────────────────────────────────────────

describe("Kudos service — error branches", () => {
  let kudosService: any;

  beforeAll(async () => {
    kudosService = await import("../../services/kudos/kudos.service");
  });

  it("getKudos throws NotFoundError", async () => {
    await expect(kudosService.getKudos(ORG, "nonexistent"))
      .rejects.toThrow();
  });

  it("listKudos returns data", async () => {
    const result = await kudosService.listKudos(ORG, {});
    expect(result).toBeDefined();
  });
});

// ── CELEBRATION SERVICE ──────────────────────────────────────────────────────

describe("Celebration service", () => {
  let celebrationService: any;

  beforeAll(async () => {
    celebrationService = await import("../../services/celebration/celebration.service");
  });

  it("getTodaysBirthdays returns array", async () => {
    const result = await celebrationService.getTodaysBirthdays(ORG);
    expect(Array.isArray(result)).toBe(true);
  });

  it("getTodaysAnniversaries returns array", async () => {
    const result = await celebrationService.getTodaysAnniversaries(ORG);
    expect(Array.isArray(result)).toBe(true);
  });

  it("getUpcomingBirthdays returns array", async () => {
    const result = await celebrationService.getUpcomingBirthdays(ORG, 30);
    expect(Array.isArray(result)).toBe(true);
  });

  it("getUpcomingAnniversaries returns array", async () => {
    const result = await celebrationService.getUpcomingAnniversaries(ORG, 30);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── NOMINATION SERVICE ───────────────────────────────────────────────────────

describe("Nomination service — list", () => {
  let nominationService: any;

  beforeAll(async () => {
    nominationService = await import("../../services/nomination/nomination.service");
  });

  it("listNominations returns data", async () => {
    const result = await nominationService.listNominations(ORG, {});
    expect(result).toBeDefined();
  });
});
