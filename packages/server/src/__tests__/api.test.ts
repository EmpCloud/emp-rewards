// ============================================================================
// EMP REWARDS — Comprehensive API Integration Tests
// Tests against live deployment at https://test-rewards.empcloud.com
// Run: npx vitest run src/__tests__/api.test.ts
// ============================================================================

import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.API_BASE_URL || "https://test-rewards.empcloud.com/api/v1";
let token = "";
let userId: number;
const U = Date.now(); // unique suffix to avoid collisions

// Peer user IDs for interactions
const PEER_USER_2 = 2;
const PEER_USER_3 = 3;

// -- Shared IDs populated during tests --
let kudosId = "";
let commentId = "";
let badgeId = "";
let badgeId2 = "";
let rewardId = "";
let rewardId2 = "";
let redemptionId = "";
let programId = "";
let nominationId = "";
let challengeId = "";
let budgetId = "";
let categoryId = "";
let milestoneRuleId = "";

// ============================================================================
// Helper
// ============================================================================
async function api(path: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let body: any = {};
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

// ============================================================================
// Auth
// ============================================================================
beforeAll(async () => {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ananya@technova.in", password: "Welcome@123" }),
  });
  const json = await res.json();
  token = json.data?.tokens?.accessToken || json.data?.token || json.data?.accessToken;
  userId = json.data?.user?.empcloudUserId || json.data?.user?.id;
  expect(token).toBeTruthy();
  expect(userId).toBeTruthy();
});

// ============================================================================
// 1. AUTH
// ============================================================================
describe("Auth", () => {
  it("1.1 POST /auth/login — valid credentials return tokens", async () => {
    const { status, body } = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "ananya@technova.in", password: "Welcome@123" }),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.tokens?.accessToken || body.data.token).toBeTruthy();
  });

  it("1.2 POST /auth/login — invalid password returns error", async () => {
    const { status, body } = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "ananya@technova.in", password: "WrongPassword" }),
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(body.success).toBe(false);
  });

  it("1.3 Unauthenticated request returns 401", async () => {
    const res = await fetch(`${BASE}/kudos`, {
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// 2. KUDOS
// ============================================================================
describe("Kudos", () => {
  it("2.1 POST /kudos — send kudos to employee 2", async () => {
    const { status, body } = await api("/kudos", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: PEER_USER_2,
        message: `Outstanding teamwork on API testing ${U}`,
        visibility: "public",
        feedback_type: "kudos",
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    kudosId = body.data.id;
    expect(kudosId).toBeTruthy();
  });

  it("2.2 GET /kudos — list public feed", async () => {
    const { status, body } = await api("/kudos?perPage=50");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const items = Array.isArray(body.data) ? body.data : body.data?.data || [];
    expect(items.length).toBeGreaterThan(0);
  });

  it("2.3 GET /kudos/received — received kudos", async () => {
    const { status, body } = await api("/kudos/received");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("2.4 GET /kudos/sent — sent kudos", async () => {
    const { status, body } = await api("/kudos/sent");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("2.5 GET /kudos/:id — get specific kudos", async () => {
    const { status, body } = await api(`/kudos/${kudosId}`);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const kudos = body.data?.kudos || body.data;
    expect(kudos.id).toBe(kudosId);
  });

  it("2.6 POST /kudos/:id/reactions — add like reaction", async () => {
    const { status, body } = await api(`/kudos/${kudosId}/reactions`, {
      method: "POST",
      body: JSON.stringify({ reaction_type: "like" }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
  });

  it("2.7 POST /kudos/:id/reactions — add clap reaction", async () => {
    const { status, body } = await api(`/kudos/${kudosId}/reactions`, {
      method: "POST",
      body: JSON.stringify({ reaction_type: "clap" }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
  });

  it("2.8 POST /kudos/:id/comments — add comment", async () => {
    const { status, body } = await api(`/kudos/${kudosId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content: `Great work! API test ${U}` }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    commentId = body.data?.id || "";
  });

  it("2.9 GET /kudos/:id — verify reactions and comments attached", async () => {
    const { status, body } = await api(`/kudos/${kudosId}`);
    expect(status).toBe(200);
    const reactions = body.data?.reactions || [];
    const comments = body.data?.comments || [];
    expect(reactions.length).toBeGreaterThanOrEqual(2);
    expect(comments.length).toBeGreaterThanOrEqual(1);
  });

  it("2.10 DELETE /kudos/:id/reactions/:reaction — remove like", async () => {
    const { status, body } = await api(`/kudos/${kudosId}/reactions/like`, {
      method: "DELETE",
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("2.11 DELETE /kudos/:id/comments/:commentId — remove comment", async () => {
    if (!commentId) return;
    const { status, body } = await api(`/kudos/${kudosId}/comments/${commentId}`, {
      method: "DELETE",
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ============================================================================
// 3. POINTS
// ============================================================================
describe("Points", () => {
  it("3.1 GET /points/balance — check balance", async () => {
    const { status, body } = await api("/points/balance");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.data.current_balance).toBe("number");
    expect(typeof body.data.total_earned).toBe("number");
  });

  it("3.2 GET /points/transactions — list transactions", async () => {
    const { status, body } = await api("/points/transactions");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const items = body.data?.data || body.data || [];
    expect(Array.isArray(items)).toBe(true);
  });

  it("3.3 POST /points/adjust — admin manual adjustment", async () => {
    const { status, body } = await api("/points/adjust", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        amount: 500,
        description: `API test adjustment ${U}`,
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it("3.4 GET /points/balance — verify balance increased", async () => {
    const { status, body } = await api("/points/balance");
    expect(status).toBe(200);
    expect(body.data.current_balance).toBeGreaterThanOrEqual(500);
  });
});

// ============================================================================
// 4. BADGES
// ============================================================================
describe("Badges", () => {
  it("4.1 POST /badges — create auto badge", async () => {
    const { status, body } = await api("/badges", {
      method: "POST",
      body: JSON.stringify({
        name: `API Test Badge Auto ${U}`,
        description: "Awarded for 5 kudos received",
        criteria_type: "auto_kudos_count",
        criteria_value: 5,
        points_awarded: 50,
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    badgeId = body.data.id;
    expect(badgeId).toBeTruthy();
  });

  it("4.2 POST /badges — create manual badge", async () => {
    const { status, body } = await api("/badges", {
      method: "POST",
      body: JSON.stringify({
        name: `API Test Badge Manual ${U}`,
        description: "Manually awarded for excellence",
        criteria_type: "manual",
        points_awarded: 100,
      }),
    });
    expect(status).toBe(201);
    badgeId2 = body.data.id;
    expect(badgeId2).toBeTruthy();
  });

  it("4.3 GET /badges — list all badges", async () => {
    const { status, body } = await api("/badges");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    const ids = body.data.map((b: any) => b.id);
    expect(ids).toContain(badgeId);
    expect(ids).toContain(badgeId2);
  });

  it("4.4 GET /badges/:id — get badge by ID", async () => {
    const { status, body } = await api(`/badges/${badgeId}`);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(badgeId);
  });

  it("4.5 PUT /badges/:id — update badge", async () => {
    const { status, body } = await api(`/badges/${badgeId}`, {
      method: "PUT",
      body: JSON.stringify({ description: `Updated desc ${U}` }),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("4.6 POST /badges/award — award badge to user", async () => {
    const { status, body } = await api("/badges/award", {
      method: "POST",
      body: JSON.stringify({
        user_id: PEER_USER_2,
        badge_id: badgeId2,
        awarded_reason: `API test award ${U}`,
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
  });

  it("4.7 GET /badges/user/:userId — verify user badge", async () => {
    const { status, body } = await api(`/badges/user/${PEER_USER_2}`);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const badgeIds = body.data.map((ub: any) => ub.badge_id);
    expect(badgeIds).toContain(badgeId2);
  });

  it("4.8 GET /badges/my — my badges", async () => {
    const { status, body } = await api("/badges/my");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("4.9 DELETE /badges/:id — soft-delete badge", async () => {
    const { status, body } = await api(`/badges/${badgeId}`, { method: "DELETE" });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ============================================================================
// 5. REWARDS CATALOG
// ============================================================================
describe("Rewards Catalog", () => {
  it("5.1 POST /rewards — create gift card reward", async () => {
    const { status, body } = await api("/rewards", {
      method: "POST",
      body: JSON.stringify({
        name: `Amazon Gift Card ${U}`,
        description: "Amazon gift card worth 500",
        category: "gift_card",
        points_cost: 500,
        monetary_value: 50000,
        quantity_available: 10,
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    rewardId = body.data.id;
    expect(rewardId).toBeTruthy();
  });

  it("5.2 POST /rewards — create PTO reward", async () => {
    const { status, body } = await api("/rewards", {
      method: "POST",
      body: JSON.stringify({
        name: `Extra PTO Day ${U}`,
        description: "One additional paid time off day",
        category: "pto",
        points_cost: 1000,
        quantity_available: 5,
      }),
    });
    expect(status).toBe(201);
    rewardId2 = body.data.id;
    expect(rewardId2).toBeTruthy();
  });

  it("5.3 GET /rewards — list catalog", async () => {
    const { status, body } = await api("/rewards");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const rewards = body.data?.data || body.data;
    expect(Array.isArray(rewards)).toBe(true);
    const ids = rewards.map((r: any) => r.id);
    expect(ids).toContain(rewardId);
  });

  it("5.4 GET /rewards/:id — get single reward", async () => {
    const { status, body } = await api(`/rewards/${rewardId}`);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(rewardId);
  });

  it("5.5 PUT /rewards/:id — update reward", async () => {
    const { status, body } = await api(`/rewards/${rewardId}`, {
      method: "PUT",
      body: JSON.stringify({ description: `Updated desc ${U}` }),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("5.6 POST /rewards/:id/redeem — redeem reward", async () => {
    // Top up points first
    await api("/points/adjust", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, amount: 2000, description: "Top up for redeem test" }),
    });

    const { status, body } = await api(`/rewards/${rewardId}/redeem`, { method: "POST" });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    redemptionId = body.data.id;
    expect(body.data.status).toBe("pending");
  });

  it("5.7 DELETE /rewards/:id — soft-delete reward", async () => {
    const { status, body } = await api(`/rewards/${rewardId2}`, { method: "DELETE" });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ============================================================================
// 6. REDEMPTIONS
// ============================================================================
describe("Redemptions", () => {
  it("6.1 GET /redemptions/my — my redemptions", async () => {
    const { status, body } = await api("/redemptions/my");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const items = body.data?.data || body.data;
    expect(Array.isArray(items)).toBe(true);
    const found = items.find((r: any) => r.id === redemptionId);
    expect(found).toBeDefined();
  });

  it("6.2 GET /redemptions — admin list all", async () => {
    const { status, body } = await api("/redemptions");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("6.3 GET /redemptions/:id — get single", async () => {
    const { status, body } = await api(`/redemptions/${redemptionId}`);
    expect(status).toBe(200);
    expect(body.data.status).toBe("pending");
  });

  it("6.4 PUT /redemptions/:id/approve — approve", async () => {
    const { status, body } = await api(`/redemptions/${redemptionId}/approve`, { method: "PUT" });
    expect(status).toBe(200);
    expect(body.data.status).toBe("approved");
  });

  it("6.5 PUT /redemptions/:id/fulfill — fulfill", async () => {
    const { status, body } = await api(`/redemptions/${redemptionId}/fulfill`, {
      method: "PUT",
      body: JSON.stringify({ notes: `Fulfilled via API test ${U}` }),
    });
    expect(status).toBe(200);
    expect(body.data.status).toBe("fulfilled");
  });
});

// ============================================================================
// 7. LEADERBOARD
// ============================================================================
describe("Leaderboard", () => {
  it("7.1 GET /leaderboard — org leaderboard", async () => {
    const { status, body } = await api("/leaderboard");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it("7.2 GET /leaderboard?period=monthly — monthly", async () => {
    const { status, body } = await api("/leaderboard?period=monthly");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("7.3 GET /leaderboard/my-rank — current user rank", async () => {
    const { status, body } = await api("/leaderboard/my-rank");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("7.4 GET /leaderboard/department/:deptId — department leaderboard", async () => {
    const { status, body } = await api("/leaderboard/department/1");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ============================================================================
// 8. CHALLENGES
// ============================================================================
describe("Challenges", () => {
  it("8.1 POST /challenges — create challenge", async () => {
    const start = new Date().toISOString().split("T")[0];
    const end = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
    const { status, body } = await api("/challenges", {
      method: "POST",
      body: JSON.stringify({
        title: `API Test Challenge ${U}`,
        description: "Send the most kudos to win",
        type: "individual",
        metric: "kudos_sent",
        target_value: 10,
        start_date: start,
        end_date: end,
        reward_points: 300,
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    challengeId = body.data.id;
    expect(challengeId).toBeTruthy();
  });

  it("8.2 GET /challenges — list challenges", async () => {
    const { status, body } = await api("/challenges");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const items = body.data?.data || body.data;
    expect(Array.isArray(items)).toBe(true);
  });

  it("8.3 GET /challenges/:id — get challenge details", async () => {
    const { status, body } = await api(`/challenges/${challengeId}`);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const challenge = body.data.challenge || body.data;
    expect(challenge.id).toBe(challengeId);
  });

  it("8.4 POST /challenges/:id/join — join challenge", async () => {
    const { status, body } = await api(`/challenges/${challengeId}/join`, { method: "POST" });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
  });

  it("8.5 POST /challenges/:id/refresh-progress — refresh progress", async () => {
    const { status, body } = await api(`/challenges/${challengeId}/refresh-progress`, { method: "POST" });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("8.6 GET /challenges/:id/leaderboard — challenge leaderboard", async () => {
    const { status, body } = await api(`/challenges/${challengeId}/leaderboard`);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ============================================================================
// 9. CELEBRATIONS
// ============================================================================
describe("Celebrations", () => {
  it("9.1 GET /celebrations/today — today's celebrations", async () => {
    const { status, body } = await api("/celebrations/today");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("9.2 GET /celebrations/upcoming — upcoming celebrations", async () => {
    const { status, body } = await api("/celebrations/upcoming?days=14");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("9.3 GET /celebrations/feed — celebration feed", async () => {
    const { status, body } = await api("/celebrations/feed");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("9.4 POST /celebrations/custom — create custom celebration (HR)", async () => {
    const { status, body } = await api("/celebrations/custom", {
      method: "POST",
      body: JSON.stringify({
        user_id: PEER_USER_2,
        type: "custom",
        title: `API Test Celebration ${U}`,
        description: "Testing custom celebration creation",
        celebration_date: new Date().toISOString().split("T")[0],
      }),
    });
    // May succeed or fail depending on permissions; verify it's handled
    expect([200, 201, 403]).toContain(status);
    if (status === 201) {
      expect(body.success).toBe(true);
    }
  });
});

// ============================================================================
// 10. ANALYTICS
// ============================================================================
describe("Analytics", () => {
  it("10.1 GET /analytics/overview — overview", async () => {
    const { status, body } = await api("/analytics/overview");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it("10.2 GET /analytics/trends — trends", async () => {
    const { status, body } = await api("/analytics/trends?interval=week&months=3");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("10.3 GET /analytics/categories — category breakdown", async () => {
    const { status, body } = await api("/analytics/categories");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("10.4 GET /analytics/departments — department participation", async () => {
    const { status, body } = await api("/analytics/departments");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("10.5 GET /analytics/top-recognizers — top recognizers", async () => {
    const { status, body } = await api("/analytics/top-recognizers?limit=5");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("10.6 GET /analytics/top-recognized — top recognized", async () => {
    const { status, body } = await api("/analytics/top-recognized?limit=5");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("10.7 GET /analytics/budget-utilization — budget utilization", async () => {
    const { status, body } = await api("/analytics/budget-utilization");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("10.8 GET /analytics/managers — manager comparison", async () => {
    const { status, body } = await api("/analytics/managers");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ============================================================================
// 11. BUDGET MANAGEMENT
// ============================================================================
describe("Budget", () => {
  it("11.1 POST /budgets — create budget", async () => {
    const { status, body } = await api("/budgets", {
      method: "POST",
      body: JSON.stringify({
        budget_type: "manager",
        owner_id: userId,
        period: "monthly",
        total_amount: 75000,
        period_start: "2026-04-01",
        period_end: "2026-04-30",
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    budgetId = body.data.id;
    expect(budgetId).toBeTruthy();
  });

  it("11.2 GET /budgets — list budgets", async () => {
    const { status, body } = await api("/budgets");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const budgets = body.data?.data || body.data;
    expect(Array.isArray(budgets)).toBe(true);
    const found = budgets.find((b: any) => b.id === budgetId);
    expect(found).toBeDefined();
  });

  it("11.3 GET /budgets/:id — get single budget", async () => {
    const { status, body } = await api(`/budgets/${budgetId}`);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(budgetId);
  });

  it("11.4 PUT /budgets/:id — update budget", async () => {
    const { status, body } = await api(`/budgets/${budgetId}`, {
      method: "PUT",
      body: JSON.stringify({ total_amount: 100000 }),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("11.5 GET /budgets/:id/usage — budget usage", async () => {
    const { status, body } = await api(`/budgets/${budgetId}/usage`);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ============================================================================
// 12. NOMINATIONS
// ============================================================================
describe("Nominations", () => {
  it("12.1 POST /nominations/programs — create program", async () => {
    const { status, body } = await api("/nominations/programs", {
      method: "POST",
      body: JSON.stringify({
        name: `Employee of the Month ${U}`,
        description: "Monthly recognition for outstanding employees",
        frequency: "monthly",
        nominations_per_user: 3,
        points_awarded: 200,
        start_date: "2026-01-01",
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    programId = body.data.id;
    expect(programId).toBeTruthy();
  });

  it("12.2 GET /nominations/programs — list programs", async () => {
    const { status, body } = await api("/nominations/programs");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const programs = body.data?.data || body.data;
    expect(Array.isArray(programs)).toBe(true);
  });

  it("12.3 PUT /nominations/programs/:id — update program", async () => {
    const { status, body } = await api(`/nominations/programs/${programId}`, {
      method: "PUT",
      body: JSON.stringify({ description: `Updated desc ${U}` }),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("12.4 POST /nominations — submit nomination", async () => {
    const { status, body } = await api("/nominations", {
      method: "POST",
      body: JSON.stringify({
        program_id: programId,
        nominee_id: PEER_USER_3,
        reason: `Exceptional performance in API testing ${U}`,
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    nominationId = body.data.id;
    expect(nominationId).toBeTruthy();
  });

  it("12.5 GET /nominations — list nominations", async () => {
    const { status, body } = await api("/nominations");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const nominations = body.data?.data || body.data;
    expect(Array.isArray(nominations)).toBe(true);
    const found = nominations.find((n: any) => n.id === nominationId);
    expect(found).toBeDefined();
  });

  it("12.6 PUT /nominations/:id/review — approve nomination", async () => {
    const { status, body } = await api(`/nominations/${nominationId}/review`, {
      method: "PUT",
      body: JSON.stringify({ status: "selected", review_note: `Selected via API test ${U}` }),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("selected");
  });
});

// ============================================================================
// 13. MILESTONES
// ============================================================================
describe("Milestones", () => {
  it("13.1 GET /milestones/rules — list rules", async () => {
    const { status, body } = await api("/milestones/rules");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("13.2 POST /milestones/rules — create milestone rule", async () => {
    const { status, body } = await api("/milestones/rules", {
      method: "POST",
      body: JSON.stringify({
        name: `5 Kudos Milestone ${U}`,
        description: "Awarded after receiving 5 kudos",
        trigger_type: "kudos_count",
        trigger_value: 5,
        reward_points: 50,
        is_active: true,
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    milestoneRuleId = body.data.id;
    expect(milestoneRuleId).toBeTruthy();
  });

  it("13.3 PUT /milestones/rules/:id — update rule", async () => {
    const { status, body } = await api(`/milestones/rules/${milestoneRuleId}`, {
      method: "PUT",
      body: JSON.stringify({ reward_points: 75 }),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("13.4 GET /milestones/my-achievements — my achievements", async () => {
    const { status, body } = await api("/milestones/my-achievements");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("13.5 POST /milestones/check/:userId — trigger milestone check", async () => {
    const { status, body } = await api(`/milestones/check/${userId}`, { method: "POST" });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("13.6 DELETE /milestones/rules/:id — delete rule", async () => {
    const { status, body } = await api(`/milestones/rules/${milestoneRuleId}`, { method: "DELETE" });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ============================================================================
// 14. SETTINGS & CATEGORIES
// ============================================================================
describe("Settings", () => {
  let originalPointsPerKudos: number;

  it("14.1 GET /settings — get settings", async () => {
    const { status, body } = await api("/settings");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.data.points_per_kudos).toBe("number");
    originalPointsPerKudos = body.data.points_per_kudos;
  });

  it("14.2 PUT /settings — update settings", async () => {
    const newVal = originalPointsPerKudos === 15 ? 10 : 15;
    const { status, body } = await api("/settings", {
      method: "PUT",
      body: JSON.stringify({ points_per_kudos: newVal }),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.points_per_kudos).toBe(newVal);

    // Restore
    await api("/settings", {
      method: "PUT",
      body: JSON.stringify({ points_per_kudos: originalPointsPerKudos }),
    });
  });

  it("14.3 GET /settings/categories — list categories", async () => {
    const { status, body } = await api("/settings/categories");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("14.4 POST /settings/categories — create category", async () => {
    const { status, body } = await api("/settings/categories", {
      method: "POST",
      body: JSON.stringify({
        name: `Customer Focus ${U}`,
        description: "Recognition for exceptional customer service",
        icon: "star",
        color: "#FF6B35",
        points_multiplier: 1.5,
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    categoryId = body.data.id;
    expect(categoryId).toBeTruthy();
  });

  it("14.5 PUT /settings/categories/:id — update category", async () => {
    const { status, body } = await api(`/settings/categories/${categoryId}`, {
      method: "PUT",
      body: JSON.stringify({ color: "#00AA00" }),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("14.6 DELETE /settings/categories/:id — deactivate category", async () => {
    const { status, body } = await api(`/settings/categories/${categoryId}`, { method: "DELETE" });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ============================================================================
// 15. HEALTH CHECK
// ============================================================================
describe("Health", () => {
  it("15.1 GET /health — health check passes", async () => {
    const healthBase = BASE.replace("/api/v1", "/health");
    const res = await fetch(healthBase);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
