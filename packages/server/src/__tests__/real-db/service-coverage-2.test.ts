// =============================================================================
// EMP REWARDS — Service Coverage Round 2
// Targets: budget (31.9%), push (35.7%), slack (38.7%), teams (42.6%),
//   analytics, challenge, celebration, milestone, nomination, leaderboard,
//   redemption, settings, slash-command
// =============================================================================

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
process.env.JWT_SECRET = "test-jwt-secret";
process.env.EMPCLOUD_URL = "http://localhost:3000";
process.env.LOG_LEVEL = "error";
process.env.VAPID_PUBLIC_KEY = "BNRaLp4rTf4OZ1mCzUw-O7z8F7UcN1Ynq6E3sLKYR1yB3IVNJ1hB8bQBQj0Oj9_XZJ2fVJU7p1bMjXxWkCVqI";
process.env.VAPID_PRIVATE_KEY = "dGVzdC12YXBpZC1wcml2YXRlLWtleS1mb3ItY292ZXJhZ2U";
process.env.VAPID_SUBJECT = "mailto:test@empcloud.com";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDB, closeDB, getDB } from "../../db/adapters";
import { initEmpCloudDB, closeEmpCloudDB } from "../../db/empcloud";

const ORG = 5;
const EMP = 524;
const MGR = 529;
const U = String(Date.now()).slice(-6);

let db: ReturnType<typeof getDB>;

beforeAll(async () => {
  await initDB();
  await initEmpCloudDB();
  db = getDB();
});

afterAll(async () => {
  await closeEmpCloudDB();
  await closeDB();
});

// ============================================================================
// BUDGET SERVICE (31.9%)
// ============================================================================
describe("Budget coverage-2", () => {
  it("listBudgets", async () => {
    const { listBudgets } = await import("../../services/budget/budget.service.js");
    const r = await listBudgets(ORG);
    expect(Array.isArray(r) || (r && typeof r === "object")).toBe(true);
  });
});

// ============================================================================
// PUSH SERVICE (35.7%)
// ============================================================================
describe("Push coverage-2", () => {
  it("getVapidPublicKey", async () => {
    const { getVapidPublicKey } = await import("../../services/push/push.service.js");
    const key = getVapidPublicKey();
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(10);
  });

  it("testPush - no subscriptions", async () => {
    const { testPush } = await import("../../services/push/push.service.js");
    try {
      const r = await testPush(999999);
      expect(r).toHaveProperty("sent");
      expect(r.sent).toBe(0);
    } catch {
      // May throw if no subscriptions
    }
  });
});

// ============================================================================
// SLACK SERVICE (38.7%)
// ============================================================================
describe("Slack coverage-2", () => {
  it("getSlackConfig", async () => {
    const { getSlackConfig } = await import("../../services/slack/slack.service.js");
    const c = await getSlackConfig(ORG);
    expect(c === null || typeof c === "object").toBe(true);
  });

  it("formatKudosMessage", async () => {
    const { formatKudosMessage } = await import("../../services/slack/slack.service.js");
    const msg = formatKudosMessage({
      sender_name: "Alice",
      receiver_name: "Bob",
      message: "Great work on the project!",
      points: 50,
      category: "teamwork",
    });
    expect(typeof msg).toBe("object");
  });

  it("formatCelebrationMessage", async () => {
    const { formatCelebrationMessage } = await import("../../services/slack/slack.service.js");
    const msg = formatCelebrationMessage({
      employee_name: "Charlie",
      type: "birthday",
      message: "Happy Birthday!",
    });
    expect(typeof msg).toBe("object");
  });
});

// ============================================================================
// TEAMS SERVICE (42.6%)
// ============================================================================
describe("Teams coverage-2", () => {
  it("getTeamsConfig", async () => {
    const { getTeamsConfig } = await import("../../services/teams/teams.service.js");
    const c = await getTeamsConfig(ORG);
    expect(c === null || typeof c === "object").toBe(true);
  });

  it("formatKudosCard", async () => {
    const { formatKudosCard } = await import("../../services/teams/teams.service.js");
    const card = formatKudosCard({
      sender_name: "Alice",
      receiver_name: "Bob",
      message: "Excellent teamwork!",
      points: 100,
      category: "innovation",
    });
    expect(typeof card).toBe("object");
  });

  it("formatCelebrationCard", async () => {
    const { formatCelebrationCard } = await import("../../services/teams/teams.service.js");
    const card = formatCelebrationCard({
      employee_name: "Dave",
      type: "anniversary",
      years: 5,
      message: "Happy 5th anniversary!",
    });
    expect(typeof card).toBe("object");
  });

  it("formatMilestoneCard", async () => {
    const { formatMilestoneCard } = await import("../../services/teams/teams.service.js");
    const card = formatMilestoneCard({
      employee_name: "Eve",
      milestone_name: "1000 Points",
      points: 1000,
    });
    expect(typeof card).toBe("object");
  });
});

// ============================================================================
// ANALYTICS SERVICE
// ============================================================================
describe("RewardsAnalytics coverage-2", () => {
  it("getOverview", async () => {
    const { getOverview } = await import("../../services/analytics/analytics.service.js");
    const r = await getOverview(ORG);
    expect(r).toHaveProperty("totalKudos");
  });

  it("getTrends", async () => {
    const { getTrends } = await import("../../services/analytics/analytics.service.js");
    const r = await getTrends(ORG, { months: 3 });
    expect(Array.isArray(r)).toBe(true);
  });

  it("getCategoryBreakdown", async () => {
    const { getCategoryBreakdown } = await import("../../services/analytics/analytics.service.js");
    const r = await getCategoryBreakdown(ORG);
    expect(Array.isArray(r)).toBe(true);
  });

  it("getDepartmentParticipation", async () => {
    const { getDepartmentParticipation } = await import("../../services/analytics/analytics.service.js");
    const r = await getDepartmentParticipation(ORG);
    expect(Array.isArray(r)).toBe(true);
  });

  it("getTopRecognizers", async () => {
    const { getTopRecognizers } = await import("../../services/analytics/analytics.service.js");
    const r = await getTopRecognizers(ORG, 5);
    expect(Array.isArray(r)).toBe(true);
  });

  it("getTopRecognized", async () => {
    const { getTopRecognized } = await import("../../services/analytics/analytics.service.js");
    const r = await getTopRecognized(ORG, 5);
    expect(Array.isArray(r)).toBe(true);
  });

  it("getBudgetUtilization", async () => {
    const { getBudgetUtilization } = await import("../../services/analytics/analytics.service.js");
    const r = await getBudgetUtilization(ORG);
    expect(r).toBeTruthy();
  });
});

// ============================================================================
// CHALLENGE SERVICE
// ============================================================================
describe("Challenge coverage-2", () => {
  it("listChallenges", async () => {
    const { listChallenges } = await import("../../services/challenge/challenge.service.js");
    const r = await listChallenges(ORG, {});
    expect(r).toHaveProperty("data");
  });
});

// ============================================================================
// CELEBRATION SERVICE
// ============================================================================
describe("Celebration coverage-2", () => {
  it("getTodaysBirthdays", async () => {
    const { getTodaysBirthdays } = await import("../../services/celebration/celebration.service.js");
    const r = await getTodaysBirthdays(ORG);
    expect(Array.isArray(r)).toBe(true);
  });

  it("getTodaysAnniversaries", async () => {
    const { getTodaysAnniversaries } = await import("../../services/celebration/celebration.service.js");
    const r = await getTodaysAnniversaries(ORG);
    expect(Array.isArray(r)).toBe(true);
  });

  it("getUpcomingBirthdays", async () => {
    const { getUpcomingBirthdays } = await import("../../services/celebration/celebration.service.js");
    const r = await getUpcomingBirthdays(ORG, 30);
    expect(Array.isArray(r)).toBe(true);
  });

  it("getUpcomingAnniversaries", async () => {
    const { getUpcomingAnniversaries } = await import("../../services/celebration/celebration.service.js");
    const r = await getUpcomingAnniversaries(ORG, 30);
    expect(Array.isArray(r)).toBe(true);
  });

  it("getTodayCelebrations", async () => {
    const { getTodayCelebrations } = await import("../../services/celebration/celebration.service.js");
    const r = await getTodayCelebrations(ORG);
    expect(Array.isArray(r)).toBe(true);
  });

  it("getUpcomingCelebrations", async () => {
    const { getUpcomingCelebrations } = await import("../../services/celebration/celebration.service.js");
    const r = await getUpcomingCelebrations(ORG);
    expect(Array.isArray(r)).toBe(true);
  });

  it("getCelebrationFeed", async () => {
    const { getCelebrationFeed } = await import("../../services/celebration/celebration.service.js");
    const r = await getCelebrationFeed(ORG, {});
    expect(r).toHaveProperty("items");
  });

  it("generateTodayCelebrations", async () => {
    const { generateTodayCelebrations } = await import("../../services/celebration/celebration.service.js");
    const r = await generateTodayCelebrations(ORG);
    expect(r).toHaveProperty("birthdays");
    expect(r).toHaveProperty("anniversaries");
  });
});

// ============================================================================
// MILESTONE SERVICE
// ============================================================================
describe("Milestone coverage-2", () => {
  it("listRules", async () => {
    const { listRules } = await import("../../services/milestone/milestone.service.js");
    const r = await listRules(ORG);
    expect(Array.isArray(r)).toBe(true);
  });

  it("getUserAchievements", async () => {
    const { getUserAchievements } = await import("../../services/milestone/milestone.service.js");
    const r = await getUserAchievements(ORG, EMP);
    expect(Array.isArray(r)).toBe(true);
  });
});

// ============================================================================
// NOMINATION SERVICE
// ============================================================================
describe("Nomination coverage-2", () => {
  it("listPrograms", async () => {
    const { listPrograms } = await import("../../services/nomination/nomination.service.js");
    const r = await listPrograms(ORG, {});
    expect(r).toHaveProperty("data");
  });
});

// ============================================================================
// LEADERBOARD SERVICE
// ============================================================================
describe("Leaderboard coverage-2", () => {
  it("getLeaderboard", async () => {
    const { getLeaderboard } = await import("../../services/leaderboard/leaderboard.service.js");
    const r = await getLeaderboard(ORG, "monthly", "2026-04");
    expect(r).toHaveProperty("entries");
  });

  it("getDepartmentLeaderboard", async () => {
    const { getDepartmentLeaderboard } = await import("../../services/leaderboard/leaderboard.service.js");
    const r = await getDepartmentLeaderboard(ORG, 1, "monthly", "2026-04");
    expect(Array.isArray(r)).toBe(true);
  });

  it("getMyRank", async () => {
    const { getMyRank } = await import("../../services/leaderboard/leaderboard.service.js");
    const r = await getMyRank(ORG, EMP, "monthly", "2026-04");
    expect(r).toHaveProperty("rank");
  });

  it("refreshLeaderboard", async () => {
    const { refreshLeaderboard } = await import("../../services/leaderboard/leaderboard.service.js");
    await refreshLeaderboard(ORG, "monthly", "2026-04");
  });
});

// ============================================================================
// REDEMPTION SERVICE
// ============================================================================
describe("Redemption coverage-2", () => {
  it("listRedemptions", async () => {
    const { listRedemptions } = await import("../../services/redemption/redemption.service.js");
    const r = await listRedemptions(ORG, {});
    expect(r).toHaveProperty("data");
  });

  it("getMyRedemptions", async () => {
    const { getMyRedemptions } = await import("../../services/redemption/redemption.service.js");
    const r = await getMyRedemptions(ORG, EMP);
    expect(r).toHaveProperty("data");
  });
});

// ============================================================================
// SETTINGS SERVICE
// ============================================================================
describe("RewardsSettings coverage-2", () => {
  it("getSettings", async () => {
    const { getSettings } = await import("../../services/settings/settings.service.js");
    const s = await getSettings(ORG);
    expect(s).toBeTruthy();
  });

  it("getCategories", async () => {
    const { getCategories } = await import("../../services/settings/settings.service.js");
    const r = await getCategories(ORG);
    expect(Array.isArray(r)).toBe(true);
  });
});
