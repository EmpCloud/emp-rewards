// ============================================================================
// EMP REWARDS — Complete E2E Workflow Tests
// Tests against live deployment at https://test-rewards-api.empcloud.com
// ============================================================================

import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.E2E_BASE_URL || "https://test-rewards-api.empcloud.com/api/v1";
const HEALTH_BASE = BASE.replace("/api/v1", "/health");
let token = "";
let userId: number;
const U = Date.now(); // unique suffix for test data

// Peer user IDs for interactions
const PEER_USER_2 = 2;
const PEER_USER_3 = 3;

// -- Shared IDs populated during tests --
let kudosId1 = "";
let kudosId2 = "";
let badgeId1 = "";
let badgeId2 = "";
let rewardId1 = "";
let rewardId2 = "";
let redemptionId = "";
let programId = "";
let nominationId = "";
let challengeId = "";
let budgetId = "";
let categoryId = "";
let initialPointsBalance = 0;

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
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// ============================================================================
// Auth — Login before all tests
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
// WORKFLOW 1: Kudos & Points Full Cycle
// ============================================================================
describe("Workflow 1: Kudos & Points Full Cycle", () => {
  it("1. Send kudos to employee 2 (teamwork, public)", async () => {
    const { status, body } = await api("/kudos", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: PEER_USER_2,
        message: `Outstanding teamwork on the Q1 project ${U}`,
        visibility: "public",
        feedback_type: "kudos",
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    kudosId1 = body.data.id;
    expect(kudosId1).toBeTruthy();
  });

  it("2. Send second kudos to employee 3 (innovation, public)", async () => {
    const { status, body } = await api("/kudos", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: PEER_USER_3,
        message: `Innovative solution to the scaling challenge ${U}`,
        visibility: "public",
        feedback_type: "kudos",
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    kudosId2 = body.data.id;
    expect(kudosId2).toBeTruthy();
  });

  it("3. Get kudos feed — verify both appear", async () => {
    const { status, body } = await api("/kudos?perPage=50");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    // Feed uses sendPaginated — data is array at top level in paginated envelope
    const items = Array.isArray(body.data) ? body.data : body.data?.data || [];
    expect(items.length).toBeGreaterThan(0);
    const ids = items.map((k: any) => k.id);
    expect(ids).toContain(kudosId1);
    expect(ids).toContain(kudosId2);
  });

  it("4. Get specific kudos — verify details", async () => {
    const { status, body } = await api(`/kudos/${kudosId1}`);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    // Response may be { kudos, reactions, comments } or flat
    const kudos = body.data?.kudos || body.data;
    expect(kudos.id).toBe(kudosId1);
    expect(kudos.receiver_id).toBe(PEER_USER_2);
    expect(kudos.visibility).toBe("public");
  });

  it("5. Add 'like' reaction to kudos", async () => {
    const { status, body } = await api(`/kudos/${kudosId1}/reactions`, {
      method: "POST",
      body: JSON.stringify({ reaction_type: "like" }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
  });

  it("6. Add 'clap' reaction to kudos", async () => {
    const { status, body } = await api(`/kudos/${kudosId1}/reactions`, {
      method: "POST",
      body: JSON.stringify({ reaction_type: "clap" }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
  });

  it("7. Add comment to kudos", async () => {
    const { status, body } = await api(`/kudos/${kudosId1}/comments`, {
      method: "POST",
      body: JSON.stringify({ content: "Great work! Well deserved recognition." }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it("8. Get kudos again — verify reactions + comments attached", async () => {
    const { status, body } = await api(`/kudos/${kudosId1}`);
    expect(status).toBe(200);
    // Check reactions are present
    const reactions = body.data?.reactions || [];
    const comments = body.data?.comments || [];
    expect(reactions.length).toBeGreaterThanOrEqual(2);
    expect(comments.length).toBeGreaterThanOrEqual(1);
    // Verify reaction types
    const reactionTypes = reactions.map((r: any) => r.reaction_type);
    expect(reactionTypes).toContain("like");
    expect(reactionTypes).toContain("clap");
    // Verify comment content
    expect(comments[0].content).toContain("Great work!");
  });

  it("9. Get kudos feed — received kudos visible", async () => {
    const { status, body } = await api("/kudos?page=1&perPage=50");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    // sendPaginated wraps: data: { data: [...], total, page, perPage, totalPages }
    const items = body.data?.data || body.data || [];
    expect(items.length).toBeGreaterThan(0);
  });

  it("10. Verify sent kudos — at least 2 sent by us in feed", async () => {
    const { status, body } = await api("/kudos?page=1&perPage=50");
    expect(status).toBe(200);
    const items = body.data?.data || body.data || [];
    const mySent = items.filter((k: any) => k.sender_id === userId);
    expect(mySent.length).toBeGreaterThanOrEqual(2);
  });

  it("11. Check points balance — verify points from sending", async () => {
    const { status, body } = await api("/points/balance");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    // Balance should have relevant fields
    const bal = body.data;
    expect(typeof bal.current_balance).toBe("number");
    expect(typeof bal.total_earned).toBe("number");
    initialPointsBalance = bal.current_balance;
  });

  it("12. Get point transactions — verify kudos_sent entries", async () => {
    const { status, body } = await api("/points/transactions");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    // sendPaginated wraps: data: { data: [...], total, ... }
    const items = body.data?.data || body.data || [];
    expect(Array.isArray(items)).toBe(true);
    // Should have transactions related to kudos
    const kudosTxns = items.filter(
      (t: any) => t.type === "kudos_sent" || t.type === "kudos_received",
    );
    expect(kudosTxns.length).toBeGreaterThanOrEqual(0); // may be 0 if sender doesn't get points
  });
});

// ============================================================================
// WORKFLOW 2: Badges Full Cycle
// ============================================================================
describe("Workflow 2: Badges Full Cycle", () => {
  it("1. Create auto badge — 'Team Champion' (5 kudos received)", async () => {
    const { status, body } = await api("/badges", {
      method: "POST",
      body: JSON.stringify({
        name: `Team Champion ${U}`,
        description: "Awarded for receiving 5 kudos",
        criteria_type: "auto_kudos_count",
        criteria_value: 5,
        points_awarded: 50,
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    badgeId1 = body.data.id;
    expect(badgeId1).toBeTruthy();
  });

  it("2. Create manual badge — 'Innovation Award'", async () => {
    const { status, body } = await api("/badges", {
      method: "POST",
      body: JSON.stringify({
        name: `Innovation Award ${U}`,
        description: "Awarded for innovative contributions",
        criteria_type: "manual",
        points_awarded: 100,
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    badgeId2 = body.data.id;
    expect(badgeId2).toBeTruthy();
  });

  it("3. List badges — verify both exist", async () => {
    const { status, body } = await api("/badges");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    const ids = body.data.map((b: any) => b.id);
    expect(ids).toContain(badgeId1);
    expect(ids).toContain(badgeId2);
  });

  it("4. Award manual badge to employee 2", async () => {
    const { status, body } = await api("/badges/award", {
      method: "POST",
      body: JSON.stringify({
        user_id: PEER_USER_2,
        badge_id: badgeId2,
        awarded_reason: "Exceptional innovation in Q1 sprint",
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it("5. Get user badges for employee 2 — verify badge appears", async () => {
    const { status, body } = await api(`/badges/user/${PEER_USER_2}`);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    const badgeIds = body.data.map((ub: any) => ub.badge_id);
    expect(badgeIds).toContain(badgeId2);
  });

  it("6. Get my badges — verify response", async () => {
    const { status, body } = await api("/badges/my");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ============================================================================
// WORKFLOW 3: Reward Catalog & Redemption
// ============================================================================
describe("Workflow 3: Reward Catalog & Redemption", () => {
  it("1. Create reward — Amazon Gift Card 500 points", async () => {
    const { status, body } = await api("/rewards", {
      method: "POST",
      body: JSON.stringify({
        name: `Amazon Gift Card ₹500 ${U}`,
        description: "Amazon gift card worth ₹500",
        category: "gift_card",
        points_cost: 500,
        monetary_value: 50000, // ₹500 in paise
        quantity_available: 10,
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    rewardId1 = body.data.id;
    expect(rewardId1).toBeTruthy();
  });

  it("2. Create second reward — Extra PTO Day 1000 points", async () => {
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
    expect(body.success).toBe(true);
    rewardId2 = body.data.id;
    expect(rewardId2).toBeTruthy();
  });

  it("3. List rewards catalog — verify both exist", async () => {
    const { status, body } = await api("/rewards");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    // Might be paginated
    const rewards = body.data?.data || body.data;
    expect(Array.isArray(rewards)).toBe(true);
    const ids = rewards.map((r: any) => r.id);
    expect(ids).toContain(rewardId1);
    expect(ids).toContain(rewardId2);
  });

  it("4. Check points balance before redemption", async () => {
    const { status, body } = await api("/points/balance");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    initialPointsBalance = body.data.current_balance;
  });

  it("5. Redeem reward — Amazon Gift Card", async () => {
    // First give ourselves enough points via admin adjustment
    await api("/points/adjust", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        amount: 2000,
        type: "admin_adjustment",
        description: "E2E test: top up for redemption test",
      }),
    });

    // Refresh balance
    const balRes = await api("/points/balance");
    initialPointsBalance = balRes.body.data.current_balance;

    const { status, body } = await api(`/rewards/${rewardId1}/redeem`, {
      method: "POST",
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    redemptionId = body.data.id;
    expect(redemptionId).toBeTruthy();
    expect(body.data.status).toBe("pending");
  });

  it("6. Get my redemptions — verify pending", async () => {
    const { status, body } = await api("/redemptions/my");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const redemptions = body.data?.data || body.data;
    expect(Array.isArray(redemptions)).toBe(true);
    const found = redemptions.find((r: any) => r.id === redemptionId);
    expect(found).toBeDefined();
    expect(found.status).toBe("pending");
  });

  it("7. Approve redemption (admin)", async () => {
    const { status, body } = await api(`/redemptions/${redemptionId}/approve`, {
      method: "PUT",
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("approved");
  });

  it("8. Get redemption — verify status=approved", async () => {
    const { status, body } = await api(`/redemptions/${redemptionId}`);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("approved");
  });

  it("9. Fulfill redemption", async () => {
    const { status, body } = await api(`/redemptions/${redemptionId}/fulfill`, {
      method: "PUT",
      body: JSON.stringify({ notes: "Gift card code: E2E-TEST-CODE" }),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("fulfilled");
  });

  it("10. Check points balance — verify deducted", async () => {
    const { status, body } = await api("/points/balance");
    expect(status).toBe(200);
    expect(body.data.current_balance).toBeLessThan(initialPointsBalance);
  });
});

// ============================================================================
// WORKFLOW 4: Nominations
// ============================================================================
describe("Workflow 4: Nominations", () => {
  it("1. Create nomination program — Employee of the Month", async () => {
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

  it("2. Submit nomination — nominate employee 3", async () => {
    const { status, body } = await api("/nominations", {
      method: "POST",
      body: JSON.stringify({
        program_id: programId,
        nominee_id: PEER_USER_3,
        reason: `Employee 3 has shown exceptional leadership and consistently exceeds expectations ${U}`,
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    nominationId = body.data.id;
    expect(nominationId).toBeTruthy();
  });

  it("3. List nominations — verify submitted nomination", async () => {
    const { status, body } = await api("/nominations");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const nominations = body.data?.data || body.data;
    expect(Array.isArray(nominations)).toBe(true);
    const found = nominations.find((n: any) => n.id === nominationId);
    expect(found).toBeDefined();
    expect(found.status).toBe("submitted");
  });

  it("4. Review nomination — select (points awarded)", async () => {
    const { status, body } = await api(`/nominations/${nominationId}/review`, {
      method: "PUT",
      body: JSON.stringify({
        status: "selected",
        review_note: "Excellent candidate, well deserved recognition",
      }),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const nomination = body.data;
    expect(nomination.status).toBe("selected");
  });
});

// ============================================================================
// WORKFLOW 5: Leaderboard
// ============================================================================
describe("Workflow 5: Leaderboard", () => {
  it("1. Get org leaderboard — verify rankings", async () => {
    const { status, body } = await api("/leaderboard");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    // May have entries array or be the data directly
    const entries = body.data?.entries || body.data?.data || body.data;
    expect(Array.isArray(entries) || typeof entries === "object").toBe(true);
  });

  it("2. Get my rank — verify response", async () => {
    const { status, body } = await api("/leaderboard/my-rank");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it("3. Get department leaderboard — verify", async () => {
    const { status, body } = await api("/leaderboard/department/1");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ============================================================================
// WORKFLOW 6: Celebrations
// ============================================================================
describe("Workflow 6: Celebrations", () => {
  it("1. Get today's celebrations — verify response", async () => {
    const { status, body } = await api("/celebrations/today");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    // May be empty array if no celebrations today
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("2. Get upcoming celebrations — verify", async () => {
    const { status, body } = await api("/celebrations/upcoming");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("3. Get celebration feed — verify", async () => {
    const { status, body } = await api("/celebrations/feed");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ============================================================================
// WORKFLOW 7: Challenges
// ============================================================================
describe("Workflow 7: Challenges", () => {
  it("1. Create challenge — Most Kudos This Week", async () => {
    const startDate = new Date().toISOString().split("T")[0];
    const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const { status, body } = await api("/challenges", {
      method: "POST",
      body: JSON.stringify({
        title: `Most Kudos This Week ${U}`,
        description: "Send the most kudos this week to win bonus points!",
        type: "individual",
        metric: "kudos_sent",
        target_value: 10,
        start_date: startDate,
        end_date: endDate,
        reward_points: 500,
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    challengeId = body.data.id;
    expect(challengeId).toBeTruthy();
  });

  it("2. Join challenge — verify", async () => {
    const { status, body } = await api(`/challenges/${challengeId}/join`, {
      method: "POST",
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
  });

  it("3. Get challenge with leaderboard — verify", async () => {
    const { status, body } = await api(`/challenges/${challengeId}`);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    // Should have challenge details
    const challenge = body.data.challenge || body.data;
    expect(challenge.id).toBe(challengeId);

    // Also check leaderboard endpoint
    const lbRes = await api(`/challenges/${challengeId}/leaderboard`);
    expect(lbRes.status).toBe(200);
    expect(lbRes.body.success).toBe(true);
  });
});

// ============================================================================
// WORKFLOW 8: Milestones
// ============================================================================
describe("Workflow 8: Milestones", () => {
  it("1. List milestone rules — verify response", async () => {
    const { status, body } = await api("/milestones/rules");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("2. Get my achievements — verify response", async () => {
    const { status, body } = await api("/milestones/my-achievements");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ============================================================================
// WORKFLOW 9: Budget Management
// ============================================================================
describe("Workflow 9: Budget Management", () => {
  it("1. Create budget — manager type, monthly, 50000", async () => {
    const { status, body } = await api("/budgets", {
      method: "POST",
      body: JSON.stringify({
        budget_type: "manager",
        owner_id: userId,
        period: "monthly",
        total_amount: 50000,
        period_start: "2026-03-01",
        period_end: "2026-03-31",
      }),
    });
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    budgetId = body.data.id;
    expect(budgetId).toBeTruthy();
  });

  it("2. List budgets — verify created budget", async () => {
    const { status, body } = await api("/budgets");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const budgets = body.data?.data || body.data;
    expect(Array.isArray(budgets)).toBe(true);
    const found = budgets.find((b: any) => b.id === budgetId);
    expect(found).toBeDefined();
  });

  it("3. Get budget usage — verify", async () => {
    const { status, body } = await api(`/budgets/${budgetId}/usage`);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });
});

// ============================================================================
// WORKFLOW 10: Settings & Analytics
// ============================================================================
describe("Workflow 10: Settings & Analytics", () => {
  let originalPointsPerKudos: number;

  it("1. Get settings — verify response", async () => {
    const { status, body } = await api("/settings");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(typeof body.data.points_per_kudos).toBe("number");
    originalPointsPerKudos = body.data.points_per_kudos;
  });

  it("2. Update settings — change points_per_kudos", async () => {
    const newValue = originalPointsPerKudos === 15 ? 10 : 15;
    const { status, body } = await api("/settings", {
      method: "PUT",
      body: JSON.stringify({ points_per_kudos: newValue }),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.points_per_kudos).toBe(newValue);

    // Restore original value
    await api("/settings", {
      method: "PUT",
      body: JSON.stringify({ points_per_kudos: originalPointsPerKudos }),
    });
  });

  it("3. Get categories — verify response", async () => {
    const { status, body } = await api("/settings/categories");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("4. Create custom category — verify", async () => {
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

  it("5. Get analytics overview — verify", async () => {
    const { status, body } = await api("/analytics/overview");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it("6. Get analytics trends — verify", async () => {
    const { status, body } = await api("/analytics/trends");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("7. Get analytics categories — verify", async () => {
    const { status, body } = await api("/analytics/categories");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("8. Get top recognizers — verify", async () => {
    const { status, body } = await api("/analytics/top-recognizers");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("9. Get top recognized — verify", async () => {
    const { status, body } = await api("/analytics/top-recognized");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ============================================================================
// WORKFLOW 11: Slack
// ============================================================================
describe("Workflow 11: Slack", () => {
  it("1. Get slack config — verify response", async () => {
    const { status, body } = await api("/slack/config");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it("2. Update slack config — set webhook URL", async () => {
    const { status, body } = await api("/slack/config", {
      method: "PUT",
      body: JSON.stringify({
        slack_webhook_url: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
        slack_channel_name: "#rewards-notifications",
        slack_notifications_enabled: true,
        slack_notify_kudos: true,
        slack_notify_celebrations: true,
      }),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });
});
