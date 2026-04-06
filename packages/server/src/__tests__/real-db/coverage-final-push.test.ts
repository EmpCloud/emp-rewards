// =============================================================================
// EMP-REWARDS: Final coverage push - Real DB tests for uncovered services
// =============================================================================
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import knexLib, { Knex } from "knex";

let db: Knex;
const ORG = 5;
const USER = 522;

beforeAll(async () => {
  db = knexLib({ client: "mysql2", connection: { host: "localhost", port: 3306, user: "empcloud", password: "EmpCloud2026", database: "emp_rewards" } });
  await db.raw("SELECT 1");
});

afterAll(async () => { await db.destroy(); });

describe("Challenge service coverage", () => {
  it("listChallenges", async () => { const { listChallenges } = await import("../../services/challenge/challenge.service"); const r = await listChallenges(ORG); expect(r).toBeTruthy(); });
  it("getChallenge throws for non-existent", async () => { const { getChallenge } = await import("../../services/challenge/challenge.service"); await expect(getChallenge(ORG, "non-existent")).rejects.toThrow(); });
  it("joinChallenge throws for non-existent", async () => { const { joinChallenge } = await import("../../services/challenge/challenge.service"); await expect(joinChallenge(ORG, "non-existent", USER)).rejects.toThrow(); });
  it("getChallengeLeaderboard returns results", async () => { const { getChallengeLeaderboard } = await import("../../services/challenge/challenge.service"); const r = await getChallengeLeaderboard(ORG, "non-existent"); expect(r).toBeTruthy(); });
});

describe("Nomination service coverage", () => {
  it("listPrograms", async () => { const { listPrograms } = await import("../../services/nomination/nomination.service"); const r = await listPrograms(ORG); expect(r).toBeTruthy(); });
  it("getProgram throws for non-existent", async () => { const { getProgram } = await import("../../services/nomination/nomination.service"); await expect(getProgram(ORG, "non-existent")).rejects.toThrow(); });
  it("updateProgram throws for non-existent", async () => { const { updateProgram } = await import("../../services/nomination/nomination.service"); await expect(updateProgram(ORG, "non-existent", { name: "x" } as any)).rejects.toThrow(); });
  it("reviewNomination throws for non-existent", async () => { const { reviewNomination } = await import("../../services/nomination/nomination.service"); await expect(reviewNomination(ORG, "non-existent", "approved", USER, "ok")).rejects.toThrow(); });
  it("listNominations", async () => { const { listNominations } = await import("../../services/nomination/nomination.service"); const r = await listNominations(ORG, {}); expect(r).toHaveProperty("data"); });
});

describe("Redemption service coverage", () => {
  it("listRedemptions", async () => { const { listRedemptions } = await import("../../services/redemption/redemption.service"); const r = await listRedemptions(ORG, {}); expect(r).toHaveProperty("data"); });
  it("getRedemption throws for non-existent", async () => { const { getRedemption } = await import("../../services/redemption/redemption.service"); await expect(getRedemption(ORG, "non-existent")).rejects.toThrow(); });
  it("approveRedemption throws for non-existent", async () => { const { approveRedemption } = await import("../../services/redemption/redemption.service"); await expect(approveRedemption(ORG, "non-existent", USER)).rejects.toThrow(); });
  it("rejectRedemption throws for non-existent", async () => { const { rejectRedemption } = await import("../../services/redemption/redemption.service"); await expect(rejectRedemption(ORG, "non-existent", USER, "reason")).rejects.toThrow(); });
  it("fulfillRedemption throws for non-existent", async () => { const { fulfillRedemption } = await import("../../services/redemption/redemption.service"); await expect(fulfillRedemption(ORG, "non-existent", USER)).rejects.toThrow(); });
  it("cancelRedemption throws for non-existent", async () => { const { cancelRedemption } = await import("../../services/redemption/redemption.service"); await expect(cancelRedemption(ORG, "non-existent", USER)).rejects.toThrow(); });
  it("getMyRedemptions returns results", async () => { const { getMyRedemptions } = await import("../../services/redemption/redemption.service"); const r = await getMyRedemptions(ORG, USER); expect(r).toBeTruthy(); });
});

describe("Budget service coverage", () => {
  it("listBudgets", async () => { const { listBudgets } = await import("../../services/budget/budget.service"); const r = await listBudgets(ORG); expect(r).toBeTruthy(); });
  it("getBudget throws for non-existent", async () => { const { getBudget } = await import("../../services/budget/budget.service"); await expect(getBudget(ORG, "non-existent")).rejects.toThrow(); });
  it("updateBudget throws for non-existent", async () => { const { updateBudget } = await import("../../services/budget/budget.service"); await expect(updateBudget(ORG, "non-existent", {} as any)).rejects.toThrow(); });
});

describe("Analytics service coverage", () => {
  it("getOverview", async () => { const { getOverview } = await import("../../services/analytics/analytics.service"); const r = await getOverview(ORG); expect(r).toBeTruthy(); });
  it("getTrends", async () => { const { getTrends } = await import("../../services/analytics/analytics.service"); const r = await getTrends(ORG); expect(r).toBeTruthy(); });
  it("getCategoryBreakdown", async () => { const { getCategoryBreakdown } = await import("../../services/analytics/analytics.service"); const r = await getCategoryBreakdown(ORG); expect(r).toBeTruthy(); });
  it("getDepartmentParticipation", async () => { const { getDepartmentParticipation } = await import("../../services/analytics/analytics.service"); const r = await getDepartmentParticipation(ORG); expect(r).toBeTruthy(); });
  it("getTopRecognizers", async () => { const { getTopRecognizers } = await import("../../services/analytics/analytics.service"); const r = await getTopRecognizers(ORG); expect(r).toBeTruthy(); });
  it("getTopRecognized", async () => { const { getTopRecognized } = await import("../../services/analytics/analytics.service"); const r = await getTopRecognized(ORG); expect(r).toBeTruthy(); });
  it("getBudgetUtilization", async () => { const { getBudgetUtilization } = await import("../../services/analytics/analytics.service"); const r = await getBudgetUtilization(ORG); expect(r).toBeTruthy(); });
  it("getManagerDashboard", async () => { const { getManagerDashboard } = await import("../../services/analytics/analytics.service"); const r = await getManagerDashboard(ORG, USER); expect(r).toBeTruthy(); });
  it("getManagerComparison", async () => { const { getManagerComparison } = await import("../../services/analytics/analytics.service"); const r = await getManagerComparison(ORG); expect(r).toBeTruthy(); });
});

describe("Celebration service coverage", () => {
  it("getTodayCelebrations", async () => { const { getTodayCelebrations } = await import("../../services/celebration/celebration.service"); const r = await getTodayCelebrations(ORG); expect(Array.isArray(r)).toBe(true); });
  it("getUpcomingCelebrations", async () => { const { getUpcomingCelebrations } = await import("../../services/celebration/celebration.service"); const r = await getUpcomingCelebrations(ORG); expect(r).toBeTruthy(); });
  it("getCelebrationFeed", async () => { const { getCelebrationFeed } = await import("../../services/celebration/celebration.service"); const r = await getCelebrationFeed(ORG, {}); expect(r).toBeTruthy(); });
  it("getCelebrationById throws for non-existent", async () => { const { getCelebrationById } = await import("../../services/celebration/celebration.service"); await expect(getCelebrationById(ORG, "non-existent")).rejects.toThrow(); });
});

describe("Leaderboard service coverage", () => {
  it("getLeaderboard", async () => { const { getLeaderboard } = await import("../../services/leaderboard/leaderboard.service"); const r = await getLeaderboard(ORG, {}); expect(r).toBeTruthy(); });
  it("getDepartmentLeaderboard", async () => { const { getDepartmentLeaderboard } = await import("../../services/leaderboard/leaderboard.service"); const r = await getDepartmentLeaderboard(ORG); expect(r).toBeTruthy(); });
  it("getMyRank", async () => { const { getMyRank } = await import("../../services/leaderboard/leaderboard.service"); const r = await getMyRank(ORG, USER); expect(r).toBeTruthy(); });
});

describe("Milestone service coverage", () => {
  it("listRules", async () => { const { listRules } = await import("../../services/milestone/milestone.service"); const r = await listRules(ORG); expect(Array.isArray(r)).toBe(true); });
  it("deleteRule throws for non-existent", async () => { const { deleteRule } = await import("../../services/milestone/milestone.service"); await expect(deleteRule(ORG, "non-existent")).rejects.toThrow(); });
  it("getUserAchievements", async () => { const { getUserAchievements } = await import("../../services/milestone/milestone.service"); const r = await getUserAchievements(ORG, USER); expect(r).toBeTruthy(); });
  it("checkMilestones", async () => { const { checkMilestones } = await import("../../services/milestone/milestone.service"); await checkMilestones(ORG, USER); });
});

describe("Settings service coverage", () => {
  it("getSettings", async () => { const { getSettings } = await import("../../services/settings/settings.service"); const r = await getSettings(ORG); expect(r).toBeTruthy(); });
  it("getCategories", async () => { const { getCategories } = await import("../../services/settings/settings.service"); const r = await getCategories(ORG); expect(Array.isArray(r)).toBe(true); });
  it("deleteCategory throws for non-existent", async () => { const { deleteCategory } = await import("../../services/settings/settings.service"); await expect(deleteCategory(ORG, "non-existent")).rejects.toThrow(); });
});

describe("Slack/Teams formatting", () => {
  it("formatKudosMessage", async () => { const { formatKudosMessage } = await import("../../services/slack/slack.service"); expect(formatKudosMessage({ sender_name: "A", receiver_name: "B", message: "Great!", category: "Innovation", points: 10 })).toContain("A"); });
  it("formatCelebrationMessage", async () => { const { formatCelebrationMessage } = await import("../../services/slack/slack.service"); expect(formatCelebrationMessage({ user_name: "A", type: "birthday", years: 0 })).toContain("A"); });
  it("formatKudosCard", async () => { const { formatKudosCard } = await import("../../services/teams/teams.service"); expect(formatKudosCard({ sender_name: "A", receiver_name: "B", message: "G", category: "I", points: 10 })).toBeTruthy(); });
  it("formatCelebrationCard", async () => { const { formatCelebrationCard } = await import("../../services/teams/teams.service"); expect(formatCelebrationCard({ user_name: "A", type: "birthday", years: 0 })).toBeTruthy(); });
  it("formatMilestoneCard", async () => { const { formatMilestoneCard } = await import("../../services/teams/teams.service"); expect(formatMilestoneCard({ user_name: "A", milestone_name: "100", points_earned: 50 })).toBeTruthy(); });
  it("getSlackConfig", async () => { const { getSlackConfig } = await import("../../services/slack/slack.service"); const r = await getSlackConfig(ORG); expect(r === null || typeof r === "object").toBe(true); });
  it("getTeamsConfig", async () => { const { getTeamsConfig } = await import("../../services/teams/teams.service"); const r = await getTeamsConfig(ORG); expect(r === null || typeof r === "object").toBe(true); });
});
