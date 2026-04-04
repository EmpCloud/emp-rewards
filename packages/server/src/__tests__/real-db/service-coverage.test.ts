// =============================================================================
// EMP REWARDS SERVICE COVERAGE — Real DB Tests calling actual service functions
// Imports and invokes the real service functions instead of raw knex.
// Targets: kudos, challenge, budget, milestone, redemption, reward,
//   badge, celebration, leaderboard, nomination, points, settings,
//   analytics, teams
// =============================================================================

// Set env vars BEFORE any imports (config reads at import time)
process.env.DB_HOST = "localhost";
process.env.DB_PORT = "3306";
process.env.DB_USER = "empcloud";
process.env.DB_PASSWORD = "EmpCloud2026";
process.env.DB_NAME = "emp_rewards";
process.env.EMPCLOUD_DB_HOST = "localhost";
process.env.EMPCLOUD_DB_USER = "empcloud";
process.env.EMPCLOUD_DB_PASSWORD = "EmpCloud2026";
process.env.EMPCLOUD_DB_NAME = "empcloud";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-key";

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { initDB, closeDB, getDB } from "../../db/adapters";
import { initEmpCloudDB } from "../../db/empcloud";

// Services
import * as kudosService from "../../services/kudos/kudos.service";
import * as challengeService from "../../services/challenge/challenge.service";
import * as budgetService from "../../services/budget/budget.service";
import * as milestoneService from "../../services/milestone/milestone.service";
import * as redemptionService from "../../services/redemption/redemption.service";
import * as rewardService from "../../services/reward/reward.service";
import * as badgeService from "../../services/badge/badge.service";
import * as celebrationService from "../../services/celebration/celebration.service";
import * as leaderboardService from "../../services/leaderboard/leaderboard.service";
import * as nominationService from "../../services/nomination/nomination.service";
import * as pointsService from "../../services/points/points.service";
import * as settingsService from "../../services/settings/settings.service";
import * as analyticsService from "../../services/analytics/analytics.service";
import * as teamsService from "../../services/teams/teams.service";

const ORG_ID = 5; // TechNova
const USER_ID = 522; // ananya (admin)
const RECEIVER_USER_ID = 524; // priya

const db = getDB();
const cleanupIds: { table: string; id: string }[] = [];

function trackCleanup(table: string, id: string) {
  cleanupIds.push({ table, id });
}

beforeAll(async () => {
  await initDB();
  try { await initEmpCloudDB(); } catch { /* may already be initialized */ }
}, 30000);

afterEach(async () => {
  for (const item of cleanupIds.reverse()) {
    try { await db.delete(item.table, item.id); } catch { /* ignore */ }
  }
  cleanupIds.length = 0;
});

afterAll(async () => {
  await closeDB();
}, 10000);

// -- Kudos Service ------------------------------------------------------------

describe("KudosService", () => {
  it("listKudos returns array", async () => {
    const result = await kudosService.listKudos(ORG_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it("sendKudos creates a kudos entry", async () => {
    const kudos = await kudosService.sendKudos(ORG_ID, {
      senderId: USER_ID,
      receiverId: RECEIVER_USER_ID,
      message: "Great work on service coverage tests!",
      category: "teamwork",
      points: 10,
      visibility: "public",
    });
    expect(kudos).toHaveProperty("id");
    trackCleanup("kudos", kudos.id);
  });

  it("getKudos returns a specific kudos entry", async () => {
    const kudos = await kudosService.sendKudos(ORG_ID, {
      senderId: USER_ID,
      receiverId: RECEIVER_USER_ID,
      message: "Test get kudos",
      category: "innovation",
      points: 5,
      visibility: "public",
    });
    trackCleanup("kudos", kudos.id);

    const fetched = await kudosService.getKudos(ORG_ID, kudos.id);
    expect(fetched).toHaveProperty("id", kudos.id);
    expect(fetched).toHaveProperty("message");
  });

  it("addComment and deleteComment work", async () => {
    const kudos = await kudosService.sendKudos(ORG_ID, {
      senderId: USER_ID,
      receiverId: RECEIVER_USER_ID,
      message: "Test comments",
      category: "teamwork",
      points: 5,
      visibility: "public",
    });
    trackCleanup("kudos", kudos.id);

    const comment = await kudosService.addComment(ORG_ID, kudos.id, USER_ID, "Great job!");
    expect(comment).toHaveProperty("id");
    trackCleanup("kudos_comments", comment.id);

    await kudosService.deleteComment(comment.id, USER_ID);
    cleanupIds.pop();
  });

  it("addReaction and removeReaction work", async () => {
    const kudos = await kudosService.sendKudos(ORG_ID, {
      senderId: USER_ID,
      receiverId: RECEIVER_USER_ID,
      message: "Test reactions",
      category: "teamwork",
      points: 5,
      visibility: "public",
    });
    trackCleanup("kudos", kudos.id);

    const reaction = await kudosService.addReaction(ORG_ID, kudos.id, USER_ID, "thumbs_up");
    expect(reaction).toHaveProperty("id");

    await kudosService.removeReaction(ORG_ID, kudos.id, USER_ID, "thumbs_up");
  });
});

// -- Challenge Service --------------------------------------------------------

describe("ChallengeService", () => {
  it("listChallenges returns array", async () => {
    const result = await challengeService.listChallenges(ORG_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it("CRUD: create and get challenge", async () => {
    const challenge = await challengeService.createChallenge(ORG_ID, {
      name: "SC Test Challenge",
      description: "Service coverage challenge",
      type: "individual",
      metric: "kudos_sent",
      target: 10,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      rewardPoints: 100,
      createdBy: USER_ID,
    });
    expect(challenge).toHaveProperty("id");
    trackCleanup("challenges", challenge.id);

    const fetched = await challengeService.getChallenge(ORG_ID, challenge.id);
    expect(fetched).toHaveProperty("name", "SC Test Challenge");
  });

  it("getChallengeLeaderboard returns leaderboard data", async () => {
    const challenge = await challengeService.createChallenge(ORG_ID, {
      name: "SC Leaderboard Challenge",
      description: "Test leaderboard",
      type: "individual",
      metric: "kudos_sent",
      target: 5,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      rewardPoints: 50,
      createdBy: USER_ID,
    });
    trackCleanup("challenges", challenge.id);

    const leaderboard = await challengeService.getChallengeLeaderboard(ORG_ID, challenge.id);
    expect(Array.isArray(leaderboard)).toBe(true);
  });
});

// -- Budget Service -----------------------------------------------------------

describe("BudgetService", () => {
  it("listBudgets returns paginated data", async () => {
    const result = await budgetService.listBudgets(ORG_ID);
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
  });

  it("CRUD: create, get, update budget", async () => {
    const budget = await budgetService.createBudget(ORG_ID, {
      name: "SC Test Budget",
      amount: 100000,
      period: "monthly",
      departmentId: null,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
    expect(budget).toHaveProperty("id");
    trackCleanup("recognition_budgets", budget.id);

    const fetched = await budgetService.getBudget(ORG_ID, budget.id);
    expect(fetched).toHaveProperty("name", "SC Test Budget");

    await budgetService.updateBudget(ORG_ID, budget.id, {
      name: "SC Updated Budget",
    });
  });

  it("getBudgetUsage returns usage data", async () => {
    const budget = await budgetService.createBudget(ORG_ID, {
      name: "SC Usage Budget",
      amount: 50000,
      period: "monthly",
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
    trackCleanup("recognition_budgets", budget.id);

    const usage = await budgetService.getBudgetUsage(ORG_ID, budget.id);
    expect(usage).toBeDefined();
  });
});

// -- Milestone Service --------------------------------------------------------

describe("MilestoneService", () => {
  it("listRules returns array", async () => {
    const result = await milestoneService.listRules(ORG_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it("CRUD: create, update, delete rule", async () => {
    const rule = await milestoneService.createRule(ORG_ID, {
      name: "SC Test Milestone",
      type: "kudos_received",
      threshold: 50,
      rewardPoints: 200,
      badgeId: null,
      description: "Test milestone for service coverage",
    });
    expect(rule).toHaveProperty("id");
    trackCleanup("milestone_rules", rule.id);

    await milestoneService.updateRule(ORG_ID, rule.id, {
      name: "SC Updated Milestone",
    });

    await milestoneService.deleteRule(ORG_ID, rule.id);
    cleanupIds.length = 0;
  });

  it("getUserAchievements returns array", async () => {
    const result = await milestoneService.getUserAchievements(ORG_ID, USER_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it("checkMilestones runs without error", async () => {
    const result = await milestoneService.checkMilestones(ORG_ID, USER_ID);
    expect(Array.isArray(result)).toBe(true);
  });
});

// -- Redemption Service -------------------------------------------------------

describe("RedemptionService", () => {
  it("listRedemptions returns paginated data", async () => {
    const result = await redemptionService.listRedemptions(ORG_ID);
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
  });

  it("getMyRedemptions returns user redemptions", async () => {
    const result = await redemptionService.getMyRedemptions(ORG_ID, USER_ID);
    expect(Array.isArray(result)).toBe(true);
  });
});

// -- Reward Service -----------------------------------------------------------

describe("RewardService", () => {
  it("listRewards returns paginated data", async () => {
    const result = await rewardService.listRewards(ORG_ID);
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
  });

  it("CRUD: create, get, update, delete reward", async () => {
    const reward = await rewardService.createReward(ORG_ID, {
      name: "SC Test Reward",
      description: "Test reward for service coverage",
      category: "merchandise",
      pointsCost: 500,
      quantity: 10,
    });
    expect(reward).toHaveProperty("id");
    trackCleanup("reward_catalog", reward.id);

    const fetched = await rewardService.getReward(ORG_ID, reward.id);
    expect(fetched).toHaveProperty("name", "SC Test Reward");

    await rewardService.updateReward(ORG_ID, reward.id, {
      name: "SC Updated Reward",
    });

    await rewardService.deleteReward(ORG_ID, reward.id);
    cleanupIds.length = 0;
  });
});

// -- Badge Service ------------------------------------------------------------

describe("BadgeService", () => {
  it("listBadges returns array", async () => {
    const result = await badgeService.listBadges(ORG_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it("CRUD: create, get, update, delete badge", async () => {
    const badge = await badgeService.createBadge(ORG_ID, {
      name: "SC Test Badge",
      description: "Test badge for service coverage",
      icon: "star",
      category: "achievement",
      criteria: { type: "manual" },
    });
    expect(badge).toHaveProperty("id");
    trackCleanup("badge_definitions", badge.id);

    const fetched = await badgeService.getBadge(ORG_ID, badge.id);
    expect(fetched).toHaveProperty("name", "SC Test Badge");

    await badgeService.updateBadge(ORG_ID, badge.id, {
      name: "SC Updated Badge",
    });

    await badgeService.deleteBadge(ORG_ID, badge.id);
    cleanupIds.length = 0;
  });

  it("getUserBadges returns array", async () => {
    const result = await badgeService.getUserBadges(ORG_ID, USER_ID);
    expect(Array.isArray(result)).toBe(true);
  });
});

// -- Celebration Service ------------------------------------------------------

describe("CelebrationService", () => {
  it("getTodaysBirthdays returns array", async () => {
    const result = await celebrationService.getTodaysBirthdays(ORG_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it("getTodaysAnniversaries returns array", async () => {
    const result = await celebrationService.getTodaysAnniversaries(ORG_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it("getUpcomingBirthdays returns array", async () => {
    const result = await celebrationService.getUpcomingBirthdays(ORG_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it("getCelebrationFeed returns array", async () => {
    const result = await celebrationService.getCelebrationFeed(ORG_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it("getTodayCelebrations returns array", async () => {
    const result = await celebrationService.getTodayCelebrations(ORG_ID);
    expect(Array.isArray(result)).toBe(true);
  });
});

// -- Leaderboard Service ------------------------------------------------------

describe("LeaderboardService", () => {
  it("getLeaderboard returns array", async () => {
    const result = await leaderboardService.getLeaderboard(ORG_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it("getDepartmentLeaderboard returns array", async () => {
    const result = await leaderboardService.getDepartmentLeaderboard(ORG_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it("getMyRank returns rank data", async () => {
    const result = await leaderboardService.getMyRank(ORG_ID, USER_ID);
    expect(result).toBeDefined();
  });
});

// -- Nomination Service -------------------------------------------------------

describe("NominationService", () => {
  it("listPrograms returns paginated data", async () => {
    const result = await nominationService.listPrograms(ORG_ID);
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
  });

  it("CRUD: create and get program", async () => {
    const program = await nominationService.createProgram(ORG_ID, {
      name: "SC Test Award Program",
      description: "Service coverage test program",
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      maxNominationsPerUser: 3,
    });
    expect(program).toHaveProperty("id");
    trackCleanup("nomination_programs", program.id);

    const fetched = await nominationService.getProgram(ORG_ID, program.id);
    expect(fetched).toHaveProperty("name", "SC Test Award Program");
  });
});

// -- Points Service -----------------------------------------------------------

describe("PointsService", () => {
  it("getBalance returns balance object", async () => {
    const result = await pointsService.getBalance(ORG_ID, USER_ID);
    expect(result).toBeDefined();
  });

  it("getTransactions returns array", async () => {
    const result = await pointsService.getTransactions(ORG_ID, USER_ID);
    expect(Array.isArray(result)).toBe(true);
  });
});

// -- Settings Service ---------------------------------------------------------

describe("SettingsService", () => {
  it("getSettings returns settings", async () => {
    const result = await settingsService.getSettings(ORG_ID);
    expect(result).toBeDefined();
  });

  it("getCategories returns array", async () => {
    const result = await settingsService.getCategories(ORG_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it("CRUD: create, update, delete category", async () => {
    const cat = await settingsService.createCategory(ORG_ID, {
      name: "SC Test Category",
      icon: "star",
      color: "#FF0000",
      description: "Service coverage test category",
    });
    expect(cat).toHaveProperty("id");
    trackCleanup("recognition_categories", cat.id);

    await settingsService.updateCategory(ORG_ID, cat.id, {
      name: "SC Updated Category",
    });

    await settingsService.deleteCategory(ORG_ID, cat.id);
    cleanupIds.length = 0;
  });
});

// -- Analytics Service --------------------------------------------------------

describe("AnalyticsService", () => {
  it("getOverview returns overview data", async () => {
    const result = await analyticsService.getOverview(ORG_ID);
    expect(result).toBeDefined();
  });

  it("getTrends returns trends data", async () => {
    const result = await analyticsService.getTrends(ORG_ID);
    expect(result).toBeDefined();
  });

  it("getCategoryBreakdown returns breakdown", async () => {
    const result = await analyticsService.getCategoryBreakdown(ORG_ID);
    expect(result).toBeDefined();
  });

  it("getDepartmentParticipation returns participation data", async () => {
    const result = await analyticsService.getDepartmentParticipation(ORG_ID);
    expect(result).toBeDefined();
  });

  it("getTopRecognizers returns array", async () => {
    const result = await analyticsService.getTopRecognizers(ORG_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it("getTopRecognized returns array", async () => {
    const result = await analyticsService.getTopRecognized(ORG_ID);
    expect(Array.isArray(result)).toBe(true);
  });

  it("getBudgetUtilization returns data", async () => {
    const result = await analyticsService.getBudgetUtilization(ORG_ID);
    expect(result).toBeDefined();
  });
});

// -- Teams Service ------------------------------------------------------------

describe("TeamsService", () => {
  it("getTeamsConfig returns config or null", async () => {
    const result = await teamsService.getTeamsConfig(ORG_ID);
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("formatKudosCard returns adaptive card object", () => {
    const card = teamsService.formatKudosCard({
      senderName: "Alice",
      receiverName: "Bob",
      message: "Great work!",
      category: "teamwork",
      points: 10,
    });
    expect(card).toBeDefined();
    expect(typeof card).toBe("object");
  });

  it("formatCelebrationCard returns adaptive card object", () => {
    const card = teamsService.formatCelebrationCard({
      type: "birthday",
      employeeName: "Alice",
      message: "Happy Birthday!",
    });
    expect(card).toBeDefined();
    expect(typeof card).toBe("object");
  });
});
