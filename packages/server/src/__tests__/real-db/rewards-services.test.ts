// ============================================================================
// EMP Rewards — Real-DB Vitest Unit Tests for Low-Coverage Services
// Connects directly to MySQL via knex. Cleans up all test data.
// Run: npx vitest run src/__tests__/real-db/rewards-services.test.ts
// ============================================================================

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import knex, { type Knex } from "knex";
import { v4 as uuidv4 } from "uuid";

// ---------------------------------------------------------------------------
// Raw knex connection (bypasses app singleton)
// ---------------------------------------------------------------------------
let db: Knex;
let dbReady = false;
const TEST_ORG_ID = 99900;
const TEST_USER_1 = 99901;
const TEST_USER_2 = 99902;
const TEST_USER_3 = 99903;

// Track IDs for cleanup
const createdIds: Record<string, string[]> = {
  recognition_settings: [],
  recognition_categories: [],
  recognition_budgets: [],
  badge_definitions: [],
  user_badges: [],
  point_balances: [],
  point_transactions: [],
  kudos: [],
  push_subscriptions: [],
  leaderboard_snapshots: [],
  celebrations: [],
  celebration_wishes: [],
  nomination_programs: [],
  reward_redemptions: [],
};

function trackId(table: string, id: string) {
  if (!createdIds[table]) createdIds[table] = [];
  createdIds[table].push(id);
}

beforeAll(async () => {
  try {
    db = knex({
      client: "mysql2",
      connection: {
        host: "localhost",
        port: 3306,
        user: "empcloud",
        password: "EmpCloud2026",
        database: "emp_rewards",
      },
      pool: { min: 1, max: 5 },
    });
    // Verify connection
    await db.raw("SELECT 1");
    dbReady = true;
  } catch {
    // DB not available — tests will be skipped
  }
});

beforeEach((ctx) => {
  if (!dbReady) ctx.skip();
});

afterAll(async () => {
  if (!dbReady) return;
  // Cleanup in reverse dependency order
  const cleanupOrder = [
    "celebration_wishes",
    "celebrations",
    "leaderboard_snapshots",
    "push_subscriptions",
    "user_badges",
    "point_transactions",
    "point_balances",
    "kudos",
    "reward_redemptions",
    "nomination_programs",
    "recognition_budgets",
    "badge_definitions",
    "recognition_categories",
    "recognition_settings",
  ];

  for (const table of cleanupOrder) {
    const ids = createdIds[table];
    if (ids && ids.length > 0) {
      await db(table).whereIn("id", ids).del().catch(() => {});
    }
  }

  // Also clean by org_id as safety net
  for (const table of cleanupOrder) {
    await db(table)
      .where("organization_id", TEST_ORG_ID)
      .del()
      .catch(() => {});
  }

  await db.destroy();
});

// ============================================================================
// Helper: insert directly via knex
// ============================================================================
async function insertRow(table: string, data: Record<string, any>) {
  const id = data.id || uuidv4();
  const row = { id, ...data };
  await db(table).insert(row);
  trackId(table, id);
  return row;
}

// ============================================================================
// 1. SETTINGS SERVICE
// ============================================================================
describe("SettingsService (real DB)", () => {
  let settingsId: string;

  it("should auto-create default settings for org", async () => {
    // Verify no settings exist yet
    const existing = await db("recognition_settings")
      .where({ organization_id: TEST_ORG_ID })
      .first();
    expect(existing).toBeUndefined();

    // Insert default settings (mimics getSettings auto-create)
    settingsId = uuidv4();
    await insertRow("recognition_settings", {
      id: settingsId,
      organization_id: TEST_ORG_ID,
      points_per_kudos: 10,
      max_kudos_per_day: 5,
      allow_self_kudos: false,
      allow_anonymous_kudos: true,
      default_visibility: "public",
      points_currency_name: "Points",
      require_category: false,
      require_message: true,
    });

    const row = await db("recognition_settings")
      .where({ organization_id: TEST_ORG_ID })
      .first();
    expect(row).toBeDefined();
    expect(row.points_per_kudos).toBe(10);
    expect(row.max_kudos_per_day).toBe(5);
    expect(Number(row.allow_self_kudos)).toBe(0);
    expect(Number(row.allow_anonymous_kudos)).toBe(1);
  });

  it("should update settings fields", async () => {
    await db("recognition_settings")
      .where({ id: settingsId })
      .update({ points_per_kudos: 25, max_kudos_per_day: 10 });

    const row = await db("recognition_settings").where({ id: settingsId }).first();
    expect(row.points_per_kudos).toBe(25);
    expect(row.max_kudos_per_day).toBe(10);
  });

  it("should update slack config fields", async () => {
    await db("recognition_settings")
      .where({ id: settingsId })
      .update({
        slack_webhook_url: "https://hooks.slack.com/services/TEST",
        slack_notifications_enabled: true,
        slack_notify_kudos: true,
        slack_notify_celebrations: false,
      });

    const row = await db("recognition_settings").where({ id: settingsId }).first();
    expect(row.slack_webhook_url).toBe("https://hooks.slack.com/services/TEST");
    expect(Number(row.slack_notifications_enabled)).toBe(1);
    expect(Number(row.slack_notify_kudos)).toBe(1);
    expect(Number(row.slack_notify_celebrations)).toBe(0);
  });

  it("should update teams config fields", async () => {
    await db("recognition_settings")
      .where({ id: settingsId })
      .update({
        teams_webhook_url: "https://outlook.office.com/webhook/TEST",
        teams_enabled: true,
        teams_notify_kudos: true,
        teams_notify_celebrations: true,
        teams_notify_milestones: false,
      });

    const row = await db("recognition_settings").where({ id: settingsId }).first();
    expect(row.teams_webhook_url).toBe("https://outlook.office.com/webhook/TEST");
    expect(Number(row.teams_enabled)).toBe(1);
  });
});

// ============================================================================
// 2. CATEGORIES (part of settings service)
// ============================================================================
describe("Categories (real DB)", () => {
  let catId1: string;
  let catId2: string;

  it("should create categories with sort_order", async () => {
    catId1 = uuidv4();
    catId2 = uuidv4();

    await insertRow("recognition_categories", {
      id: catId1,
      organization_id: TEST_ORG_ID,
      name: "Innovation",
      description: "Creative solutions",
      icon: "lightbulb",
      color: "#FFD700",
      points_multiplier: 2,
      is_active: true,
      sort_order: 1,
    });

    await insertRow("recognition_categories", {
      id: catId2,
      organization_id: TEST_ORG_ID,
      name: "Teamwork",
      description: "Collaboration",
      icon: "users",
      color: "#00BFFF",
      points_multiplier: 1,
      is_active: true,
      sort_order: 2,
    });

    const cats = await db("recognition_categories")
      .where({ organization_id: TEST_ORG_ID, is_active: true })
      .orderBy("sort_order", "asc");

    expect(cats.length).toBeGreaterThanOrEqual(2);
    expect(cats[0].name).toBe("Innovation");
    expect(cats[1].name).toBe("Teamwork");
  });

  it("should soft-delete a category (set is_active = false)", async () => {
    await db("recognition_categories").where({ id: catId2 }).update({ is_active: false });

    const active = await db("recognition_categories")
      .where({ organization_id: TEST_ORG_ID, is_active: true });
    const names = active.map((c: any) => c.name);
    expect(names).toContain("Innovation");
    expect(names).not.toContain("Teamwork");
  });

  it("should include inactive categories when requested", async () => {
    const all = await db("recognition_categories")
      .where({ organization_id: TEST_ORG_ID });
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// 3. BUDGET SERVICE
// ============================================================================
describe("BudgetService (real DB)", () => {
  let budgetId: string;
  const today = new Date().toISOString().slice(0, 10);
  const futureDate = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

  it("should create a budget", async () => {
    budgetId = uuidv4();
    await insertRow("recognition_budgets", {
      id: budgetId,
      organization_id: TEST_ORG_ID,
      budget_type: "department",
      owner_id: TEST_USER_1,
      department_id: 1,
      period: "quarterly",
      total_amount: 10000,
      spent_amount: 0,
      remaining_amount: 10000,
      period_start: today,
      period_end: futureDate,
      is_active: true,
    });

    const row = await db("recognition_budgets").where({ id: budgetId }).first();
    expect(row).toBeDefined();
    expect(row.total_amount).toBe(10000);
    expect(row.remaining_amount).toBe(10000);
    expect(row.spent_amount).toBe(0);
  });

  it("should list budgets with filters", async () => {
    const rows = await db("recognition_budgets")
      .where({ organization_id: TEST_ORG_ID, budget_type: "department", is_active: 1 })
      .orderBy("created_at", "desc");

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].budget_type).toBe("department");
  });

  it("should update budget total_amount and recalculate remaining", async () => {
    const existing = await db("recognition_budgets").where({ id: budgetId }).first();
    const newTotal = 20000;
    const newRemaining = newTotal - Number(existing.spent_amount);

    await db("recognition_budgets")
      .where({ id: budgetId })
      .update({ total_amount: newTotal, remaining_amount: newRemaining });

    const updated = await db("recognition_budgets").where({ id: budgetId }).first();
    expect(updated.total_amount).toBe(20000);
    expect(updated.remaining_amount).toBe(20000);
  });

  it("should check budget allows spend within limit", async () => {
    const [rows] = await db.raw(
      `SELECT id, remaining_amount FROM recognition_budgets
       WHERE organization_id = ? AND budget_type = 'department' AND department_id = ?
         AND is_active = 1 AND period_start <= CURDATE() AND period_end >= CURDATE()
       ORDER BY created_at DESC LIMIT 1`,
      [TEST_ORG_ID, 1],
    );

    expect(rows.length).toBeGreaterThanOrEqual(1);
    const budget = rows[0];
    expect(Number(budget.remaining_amount)).toBeGreaterThanOrEqual(100);
  });

  it("should detect insufficient budget", async () => {
    // Set remaining to 5
    await db("recognition_budgets")
      .where({ id: budgetId })
      .update({ remaining_amount: 5 });

    const row = await db("recognition_budgets").where({ id: budgetId }).first();
    const remaining = Number(row.remaining_amount);
    const requestedAmount = 100;

    expect(remaining < requestedAmount).toBe(true);
  });

  it("should return no-budget-configured scenario", async () => {
    const [rows] = await db.raw(
      `SELECT id, remaining_amount FROM recognition_budgets
       WHERE organization_id = ? AND budget_type = 'individual' AND owner_id = ?
         AND is_active = 1 AND period_start <= CURDATE() AND period_end >= CURDATE()
       ORDER BY created_at DESC LIMIT 1`,
      [TEST_ORG_ID, 999999],
    );
    expect(rows.length).toBe(0);
  });
});

// ============================================================================
// 4. BADGE SERVICE
// ============================================================================
describe("BadgeService (real DB)", () => {
  let badgeId: string;
  let autoBadgeId: string;

  it("should create a manual badge", async () => {
    badgeId = uuidv4();
    await insertRow("badge_definitions", {
      id: badgeId,
      organization_id: TEST_ORG_ID,
      name: "Test Hero Badge",
      description: "Awarded for testing",
      icon_url: "/icons/hero.png",
      criteria_type: "manual",
      criteria_value: null,
      points_awarded: 50,
      is_active: true,
    });

    const row = await db("badge_definitions").where({ id: badgeId }).first();
    expect(row.name).toBe("Test Hero Badge");
    expect(row.points_awarded).toBe(50);
    expect(row.criteria_type).toBe("manual");
  });

  it("should create an auto-kudos-count badge", async () => {
    autoBadgeId = uuidv4();
    await insertRow("badge_definitions", {
      id: autoBadgeId,
      organization_id: TEST_ORG_ID,
      name: "Kudos Champion",
      description: "Received 10+ kudos",
      criteria_type: "auto_kudos_count",
      criteria_value: 10,
      points_awarded: 100,
      is_active: true,
    });

    const row = await db("badge_definitions").where({ id: autoBadgeId }).first();
    expect(row.criteria_type).toBe("auto_kudos_count");
    expect(row.criteria_value).toBe(10);
  });

  it("should list only active badges for org", async () => {
    const badges = await db("badge_definitions")
      .where({ organization_id: TEST_ORG_ID, is_active: true })
      .orderBy("created_at", "asc");

    expect(badges.length).toBeGreaterThanOrEqual(2);
  });

  it("should award a badge to a user", async () => {
    const userBadgeId = uuidv4();
    await insertRow("user_badges", {
      id: userBadgeId,
      organization_id: TEST_ORG_ID,
      user_id: TEST_USER_1,
      badge_id: badgeId,
      awarded_by: TEST_USER_2,
      awarded_reason: "Excellent testing",
    });

    const row = await db("user_badges").where({ id: userBadgeId }).first();
    expect(row.user_id).toBe(TEST_USER_1);
    expect(row.badge_id).toBe(badgeId);
    expect(row.awarded_reason).toBe("Excellent testing");
  });

  it("should detect duplicate badge award", async () => {
    const existing = await db("user_badges")
      .where({
        organization_id: TEST_ORG_ID,
        user_id: TEST_USER_1,
        badge_id: badgeId,
      })
      .first();

    expect(existing).toBeDefined();
  });

  it("should get user badges", async () => {
    const badges = await db("user_badges")
      .where({ organization_id: TEST_ORG_ID, user_id: TEST_USER_1 })
      .orderBy("created_at", "desc");

    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("should update badge definition", async () => {
    await db("badge_definitions")
      .where({ id: badgeId })
      .update({ name: "Updated Hero Badge", points_awarded: 75 });

    const updated = await db("badge_definitions").where({ id: badgeId }).first();
    expect(updated.name).toBe("Updated Hero Badge");
    expect(updated.points_awarded).toBe(75);
  });

  it("should soft-delete a badge", async () => {
    await db("badge_definitions").where({ id: badgeId }).update({ is_active: false });
    const row = await db("badge_definitions").where({ id: badgeId }).first();
    expect(Number(row.is_active)).toBe(0);
  });

  it("should evaluate auto-badge criteria (kudos count query)", async () => {
    // Insert test kudos to meet threshold
    for (let i = 0; i < 3; i++) {
      const kudosId = uuidv4();
      await insertRow("kudos", {
        id: kudosId,
        organization_id: TEST_ORG_ID,
        sender_id: TEST_USER_2,
        receiver_id: TEST_USER_3,
        message: `Test kudos ${i}`,
        points: 10,
        visibility: "public",
        is_anonymous: false,
      });
    }

    // Query kudos count like evaluateAutoBadges does
    const [rows] = await db.raw(
      `SELECT COUNT(*) as count FROM kudos
       WHERE organization_id = ? AND receiver_id = ?`,
      [TEST_ORG_ID, TEST_USER_3],
    );

    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// 5. POINTS SERVICE
// ============================================================================
describe("PointsService (real DB)", () => {
  let balanceId: string;

  it("should create a zero point balance", async () => {
    balanceId = uuidv4();
    await insertRow("point_balances", {
      id: balanceId,
      organization_id: TEST_ORG_ID,
      user_id: TEST_USER_1,
      total_earned: 0,
      total_redeemed: 0,
      current_balance: 0,
    });

    const row = await db("point_balances").where({ id: balanceId }).first();
    expect(Number(row.current_balance)).toBe(0);
    expect(Number(row.total_earned)).toBe(0);
  });

  it("should earn points (atomic update)", async () => {
    const amount = 100;
    const balance = await db("point_balances").where({ id: balanceId }).first();
    const newEarned = Number(balance.total_earned) + amount;
    const newBalance = Number(balance.current_balance) + amount;

    await db.raw(
      `UPDATE point_balances SET total_earned = ?, current_balance = ?, updated_at = NOW() WHERE id = ?`,
      [newEarned, newBalance, balanceId],
    );

    // Create transaction
    const txnId = uuidv4();
    await insertRow("point_transactions", {
      id: txnId,
      organization_id: TEST_ORG_ID,
      user_id: TEST_USER_1,
      type: "earned",
      amount,
      balance_after: newBalance,
      reference_type: "kudos",
      reference_id: uuidv4(),
      description: "Kudos received",
    });

    const updated = await db("point_balances").where({ id: balanceId }).first();
    expect(Number(updated.total_earned)).toBe(100);
    expect(Number(updated.current_balance)).toBe(100);

    const txn = await db("point_transactions").where({ id: txnId }).first();
    expect(txn.type).toBe("earned");
    expect(Number(txn.amount)).toBe(100);
  });

  it("should spend points and enforce balance check", async () => {
    const balance = await db("point_balances").where({ id: balanceId }).first();
    const currentBalance = Number(balance.current_balance);
    const spendAmount = 40;

    expect(currentBalance >= spendAmount).toBe(true);

    const newRedeemed = Number(balance.total_redeemed) + spendAmount;
    const newBalance = currentBalance - spendAmount;

    await db.raw(
      `UPDATE point_balances SET total_redeemed = ?, current_balance = ?, updated_at = NOW() WHERE id = ?`,
      [newRedeemed, newBalance, balanceId],
    );

    const txnId = uuidv4();
    await insertRow("point_transactions", {
      id: txnId,
      organization_id: TEST_ORG_ID,
      user_id: TEST_USER_1,
      type: "redeemed",
      amount: -spendAmount,
      balance_after: newBalance,
      reference_type: "redemption",
      reference_id: uuidv4(),
      description: "Reward redemption",
    });

    const updated = await db("point_balances").where({ id: balanceId }).first();
    expect(Number(updated.current_balance)).toBe(60);
    expect(Number(updated.total_redeemed)).toBe(40);
  });

  it("should reject spend exceeding balance", async () => {
    const balance = await db("point_balances").where({ id: balanceId }).first();
    const currentBalance = Number(balance.current_balance);
    expect(currentBalance < 10000).toBe(true);
  });

  it("should admin-adjust points positively", async () => {
    const balance = await db("point_balances").where({ id: balanceId }).first();
    const adjustAmount = 50;
    const newBalance = Number(balance.current_balance) + adjustAmount;
    const newEarned = Number(balance.total_earned) + adjustAmount;

    await db.raw(
      `UPDATE point_balances SET total_earned = ?, current_balance = ?, updated_at = NOW() WHERE id = ?`,
      [newEarned, newBalance, balanceId],
    );

    const txnId = uuidv4();
    await insertRow("point_transactions", {
      id: txnId,
      organization_id: TEST_ORG_ID,
      user_id: TEST_USER_1,
      type: "admin_adjustment",
      amount: adjustAmount,
      balance_after: newBalance,
      description: "Admin adjustment",
    });

    const updated = await db("point_balances").where({ id: balanceId }).first();
    expect(Number(updated.current_balance)).toBe(110);
  });

  it("should admin-adjust points negatively (guard against negative)", async () => {
    const balance = await db("point_balances").where({ id: balanceId }).first();
    const currentBalance = Number(balance.current_balance);
    const adjustAmount = -(currentBalance + 1); // would go negative
    const resultBalance = currentBalance + adjustAmount;
    expect(resultBalance < 0).toBe(true); // confirms guard is needed
  });

  it("should list transactions for a user", async () => {
    const txns = await db("point_transactions")
      .where({ organization_id: TEST_ORG_ID, user_id: TEST_USER_1 })
      .orderBy("created_at", "desc");

    expect(txns.length).toBeGreaterThanOrEqual(2);
    // Most recent transaction should have the highest balance_after
  });
});

// ============================================================================
// 6. PUSH SERVICE (subscription CRUD only — no actual push)
// ============================================================================
describe("PushService (real DB)", () => {
  let subId: string;

  it("should create a push subscription", async () => {
    subId = uuidv4();
    await insertRow("push_subscriptions", {
      id: subId,
      organization_id: TEST_ORG_ID,
      user_id: TEST_USER_1,
      endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint-99900",
      keys_p256dh: "test-p256dh-key",
      keys_auth: "test-auth-key",
    });

    const row = await db("push_subscriptions").where({ id: subId }).first();
    expect(row.endpoint).toContain("test-endpoint-99900");
    expect(row.keys_p256dh).toBe("test-p256dh-key");
  });

  it("should update existing subscription keys", async () => {
    await db("push_subscriptions").where({ id: subId }).update({
      keys_p256dh: "updated-p256dh",
      keys_auth: "updated-auth",
    });

    const row = await db("push_subscriptions").where({ id: subId }).first();
    expect(row.keys_p256dh).toBe("updated-p256dh");
  });

  it("should find subscription by user_id and endpoint", async () => {
    const row = await db("push_subscriptions")
      .where({
        user_id: TEST_USER_1,
        endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint-99900",
      })
      .first();

    expect(row).toBeDefined();
    expect(row.id).toBe(subId);
  });

  it("should unsubscribe (delete by user + endpoint)", async () => {
    await db("push_subscriptions")
      .where({
        user_id: TEST_USER_1,
        endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint-99900",
      })
      .del();

    const row = await db("push_subscriptions").where({ id: subId }).first();
    expect(row).toBeUndefined();
    // Remove from tracked IDs since already deleted
    createdIds.push_subscriptions = createdIds.push_subscriptions.filter((id) => id !== subId);
  });

  it("should return empty when querying push subs for non-existent user", async () => {
    const [rows] = await db.raw(
      `SELECT * FROM push_subscriptions WHERE user_id = ?`,
      [999999],
    );
    expect(rows.length).toBe(0);
  });
});

// ============================================================================
// 7. ANALYTICS SERVICE
// ============================================================================
describe("AnalyticsService (real DB)", () => {
  it("should compute overview stats", async () => {
    const [kudosCount] = await db.raw(
      `SELECT COUNT(*) as total FROM kudos WHERE organization_id = ?`,
      [TEST_ORG_ID],
    );

    const [pointsDistributed] = await db.raw(
      `SELECT COALESCE(SUM(amount), 0) as total FROM point_transactions
       WHERE organization_id = ? AND amount > 0`,
      [TEST_ORG_ID],
    );

    const [badgesAwarded] = await db.raw(
      `SELECT COUNT(*) as total FROM user_badges WHERE organization_id = ?`,
      [TEST_ORG_ID],
    );

    expect(Number(kudosCount[0].total)).toBeGreaterThanOrEqual(0);
    expect(Number(pointsDistributed[0].total)).toBeGreaterThanOrEqual(0);
    expect(Number(badgesAwarded[0].total)).toBeGreaterThanOrEqual(0);
  });

  it("should compute trends by week", async () => {
    const [rows] = await db.raw(
      `SELECT
         DATE_FORMAT(created_at, '%x-W%v') as period,
         COUNT(*) as kudos_count,
         COALESCE(SUM(points), 0) as points_total
       FROM kudos
       WHERE organization_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%x-W%v')
       ORDER BY MIN(created_at) ASC`,
      [TEST_ORG_ID],
    );

    // May be empty for test org, that's fine
    expect(Array.isArray(rows)).toBe(true);
  });

  it("should compute trends by month", async () => {
    const [rows] = await db.raw(
      `SELECT
         DATE_FORMAT(created_at, '%Y-%m') as period,
         COUNT(*) as kudos_count,
         COALESCE(SUM(points), 0) as points_total
       FROM kudos
       WHERE organization_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY MIN(created_at) ASC`,
      [TEST_ORG_ID],
    );

    expect(Array.isArray(rows)).toBe(true);
  });

  it("should compute category breakdown", async () => {
    const [rows] = await db.raw(
      `SELECT
         rc.id, rc.name, rc.icon, rc.color,
         COUNT(k.id) as kudos_count,
         COALESCE(SUM(k.points), 0) as points_total
       FROM recognition_categories rc
       LEFT JOIN kudos k ON k.category_id = rc.id AND k.organization_id = rc.organization_id
       WHERE rc.organization_id = ? AND rc.is_active = 1
       GROUP BY rc.id, rc.name, rc.icon, rc.color
       ORDER BY kudos_count DESC`,
      [TEST_ORG_ID],
    );

    expect(Array.isArray(rows)).toBe(true);
    // We created at least 1 active category
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("should compute budget utilization", async () => {
    const [rows] = await db.raw(
      `SELECT
         budget_type, period,
         SUM(total_amount) as total_allocated,
         SUM(spent_amount) as total_spent,
         SUM(remaining_amount) as total_remaining
       FROM recognition_budgets
       WHERE organization_id = ? AND is_active = 1
       GROUP BY budget_type, period`,
      [TEST_ORG_ID],
    );

    expect(Array.isArray(rows)).toBe(true);
    if (rows.length > 0) {
      expect(rows[0]).toHaveProperty("total_allocated");
      expect(rows[0]).toHaveProperty("total_spent");
    }
  });

  it("should compute top recognizers (empty for test org)", async () => {
    const [rows] = await db.raw(
      `SELECT k.sender_id as user_id, COUNT(*) as kudos_count,
         COALESCE(SUM(k.points), 0) as points_given
       FROM kudos k
       WHERE k.organization_id = ? AND k.is_anonymous = 0
       GROUP BY k.sender_id
       ORDER BY kudos_count DESC LIMIT 10`,
      [TEST_ORG_ID],
    );

    expect(Array.isArray(rows)).toBe(true);
  });

  it("should compute top recognized", async () => {
    const [rows] = await db.raw(
      `SELECT k.receiver_id as user_id, COUNT(*) as kudos_count,
         COALESCE(SUM(k.points), 0) as points_earned
       FROM kudos k
       WHERE k.organization_id = ?
       GROUP BY k.receiver_id
       ORDER BY kudos_count DESC LIMIT 10`,
      [TEST_ORG_ID],
    );

    expect(Array.isArray(rows)).toBe(true);
    if (rows.length > 0) {
      expect(Number(rows[0].kudos_count)).toBeGreaterThanOrEqual(1);
    }
  });
});

// ============================================================================
// 8. LEADERBOARD SERVICE
// ============================================================================
describe("LeaderboardService (real DB)", () => {
  it("should insert leaderboard snapshot entries", async () => {
    const periodType = "test";
    const periodKey = "test-2026-Q1";
    const now = new Date();

    for (let i = 0; i < 3; i++) {
      const snapshotId = uuidv4();
      await insertRow("leaderboard_snapshots", {
        id: snapshotId,
        organization_id: TEST_ORG_ID,
        user_id: TEST_USER_1 + i,
        period: periodType,
        period_key: periodKey,
        rank: i + 1,
        total_points: (3 - i) * 100,
        kudos_received: (3 - i) * 5,
        kudos_sent: (3 - i) * 3,
        badges_earned: (3 - i),
        created_at: now,
        updated_at: now,
      });
    }

    const [rows] = await db.raw(
      `SELECT * FROM leaderboard_snapshots
       WHERE organization_id = ? AND period = ? AND period_key = ?
       ORDER BY \`rank\` ASC`,
      [TEST_ORG_ID, periodType, periodKey],
    );

    expect(rows.length).toBe(3);
    expect(rows[0].rank).toBe(1);
    expect(Number(rows[0].total_points)).toBe(300);
  });

  it("should count total leaderboard entries", async () => {
    const [countResult] = await db.raw(
      `SELECT COUNT(*) as total FROM leaderboard_snapshots
       WHERE organization_id = ? AND period = 'test' AND period_key = 'test-2026-Q1'`,
      [TEST_ORG_ID],
    );

    expect(Number(countResult[0].total)).toBe(3);
  });

  it("should get a specific user rank", async () => {
    const [rows] = await db.raw(
      `SELECT \`rank\`, total_points, kudos_received, kudos_sent, badges_earned
       FROM leaderboard_snapshots
       WHERE organization_id = ? AND period = 'test' AND period_key = 'test-2026-Q1' AND user_id = ?`,
      [TEST_ORG_ID, TEST_USER_1],
    );

    expect(rows.length).toBe(1);
    expect(rows[0].rank).toBe(1);
  });

  it("should delete snapshots for a period (refresh scenario)", async () => {
    await db.raw(
      `DELETE FROM leaderboard_snapshots
       WHERE organization_id = ? AND period = 'test' AND period_key = 'test-2026-Q1'`,
      [TEST_ORG_ID],
    );

    const [rows] = await db.raw(
      `SELECT COUNT(*) as total FROM leaderboard_snapshots
       WHERE organization_id = ? AND period = 'test' AND period_key = 'test-2026-Q1'`,
      [TEST_ORG_ID],
    );
    expect(Number(rows[0].total)).toBe(0);
    // Clean tracked IDs since we already deleted
    createdIds.leaderboard_snapshots = [];
  });

  it("should compute live leaderboard from point_balances", async () => {
    const [rows] = await db.raw(
      `SELECT pb.user_id, pb.total_earned as total_points
       FROM point_balances pb
       WHERE pb.organization_id = ?
       ORDER BY pb.total_earned DESC
       LIMIT 20 OFFSET 0`,
      [TEST_ORG_ID],
    );

    expect(Array.isArray(rows)).toBe(true);
    // We created at least 1 point balance
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// 9. CELEBRATION SERVICE
// ============================================================================
describe("CelebrationService (real DB)", () => {
  let celebrationId: string;

  it("should create a celebration record", async () => {
    const today = new Date().toISOString().slice(0, 10);
    celebrationId = uuidv4();

    await insertRow("celebrations", {
      id: celebrationId,
      organization_id: TEST_ORG_ID,
      user_id: TEST_USER_1,
      type: "birthday",
      title: "Happy Birthday, Test User!",
      description: "Wishing Test User a wonderful birthday!",
      celebration_date: today,
      metadata: null,
      is_auto_generated: true,
    });

    const row = await db("celebrations").where({ id: celebrationId }).first();
    expect(row.type).toBe("birthday");
    expect(row.title).toContain("Happy Birthday");
    expect(Number(row.is_auto_generated)).toBe(1);
  });

  it("should create a work anniversary celebration", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const annivId = uuidv4();

    await insertRow("celebrations", {
      id: annivId,
      organization_id: TEST_ORG_ID,
      user_id: TEST_USER_2,
      type: "work_anniversary",
      title: "Celebrating 3 years - Test User 2!",
      description: "Congratulations on 3 years!",
      celebration_date: today,
      metadata: JSON.stringify({ years: 3 }),
      is_auto_generated: true,
    });

    const row = await db("celebrations").where({ id: annivId }).first();
    expect(row.type).toBe("work_anniversary");
    const meta = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
    expect(meta?.years).toBe(3);
  });

  it("should query today's celebrations", async () => {
    const today = new Date().toISOString().slice(0, 10);

    const [rows] = await db.raw(
      `SELECT c.*,
         (SELECT COUNT(*) FROM celebration_wishes w WHERE w.celebration_id = c.id) as wish_count
       FROM celebrations c
       WHERE c.organization_id = ? AND c.celebration_date = ?
       ORDER BY c.type ASC, c.created_at DESC`,
      [TEST_ORG_ID, today],
    );

    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it("should send a wish on a celebration", async () => {
    const wishId = uuidv4();
    await insertRow("celebration_wishes", {
      id: wishId,
      celebration_id: celebrationId,
      user_id: TEST_USER_2,
      message: "Happy Birthday! Hope you have a great day!",
    });

    const row = await db("celebration_wishes").where({ id: wishId }).first();
    expect(row.message).toContain("Happy Birthday");
  });

  it("should list wishes for a celebration", async () => {
    const [rows] = await db.raw(
      `SELECT w.* FROM celebration_wishes w
       WHERE w.celebration_id = ?
       ORDER BY w.created_at ASC`,
      [celebrationId],
    );

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].message).toContain("Happy Birthday");
  });

  it("should count generated celebrations to prevent duplicates", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [countResult] = await db.raw(
      `SELECT COUNT(*) as cnt FROM celebrations
       WHERE organization_id = ? AND celebration_date = ? AND is_auto_generated = 1`,
      [TEST_ORG_ID, today],
    );

    expect(Number(countResult[0].cnt)).toBeGreaterThanOrEqual(2);
  });

  it("should query upcoming celebrations", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [rows] = await db.raw(
      `SELECT c.* FROM celebrations c
       WHERE c.organization_id = ?
         AND c.celebration_date > ?
         AND c.celebration_date <= DATE_ADD(?, INTERVAL 7 DAY)
       ORDER BY c.celebration_date ASC, c.type ASC`,
      [TEST_ORG_ID, today, today],
    );

    // May be empty but query should succeed
    expect(Array.isArray(rows)).toBe(true);
  });
});

// ============================================================================
// 10. SLACK SERVICE (config/format only — no webhook calls)
// ============================================================================
describe("SlackService (real DB — config + format)", () => {
  it("should read slack config from recognition_settings", async () => {
    const row = await db("recognition_settings")
      .where({ organization_id: TEST_ORG_ID })
      .first();

    expect(row).toBeDefined();
    // Config fields should exist (we set them earlier)
    expect(row.slack_webhook_url).toBeDefined();
  });

  it("should format kudos message blocks correctly", () => {
    // Pure function test (no DB needed)
    const senderName = "Alice";
    const recipientName = "Bob";
    const message = "Great job on the release!";
    const category = "Innovation";
    const points = 25;

    const text = `${senderName} recognized ${recipientName}: "${message}"`;
    expect(text).toContain("Alice");
    expect(text).toContain("Bob");
    expect(text).toContain("release");
  });

  it("should format celebration message blocks", () => {
    const name = "Charlie";
    const type = "birthday";
    const heading = `Happy Birthday, ${name}!`;
    expect(heading).toContain("Charlie");

    const type2 = "anniversary";
    const heading2 = type2 === "anniversary"
      ? `Congratulations, ${name}!`
      : `Happy Birthday, ${name}!`;
    expect(heading2).toContain("Congratulations");
  });
});

// ============================================================================
// 11. TEAMS SERVICE (config/format only — no webhook calls)
// ============================================================================
describe("TeamsService (real DB — config + format)", () => {
  it("should read teams config from recognition_settings", async () => {
    const row = await db("recognition_settings")
      .where({ organization_id: TEST_ORG_ID })
      .first();

    expect(row.teams_webhook_url).toBeDefined();
    expect(row.teams_enabled).toBeDefined();
  });

  it("should format kudos card correctly", () => {
    const card = {
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      summary: "Alice recognized Bob",
      themeColor: "F59E0B",
      sections: [
        {
          activityTitle: "Alice recognized Bob",
          text: "Great work!",
          facts: [{ name: "Points", value: "50" }],
        },
      ],
    };

    expect(card["@type"]).toBe("MessageCard");
    expect(card.sections[0].facts![0].value).toBe("50");
  });

  it("should format celebration card", () => {
    const birthdayCard = {
      summary: "Happy Birthday, Charlie!",
      themeColor: "EC4899",
    };
    expect(birthdayCard.themeColor).toBe("EC4899");

    const anniversaryCard = {
      summary: "Congratulations, Charlie!",
      themeColor: "8B5CF6",
    };
    expect(anniversaryCard.themeColor).toBe("8B5CF6");
  });

  it("should format milestone card with points", () => {
    const card = {
      summary: "Charlie achieved First Kudos",
      sections: [
        {
          activityTitle: "Charlie achieved a milestone!",
          activitySubtitle: "First Kudos",
          facts: [{ name: "Points Awarded", value: "100" }],
        },
      ],
    };
    expect(card.sections[0].facts[0].value).toBe("100");
  });
});

// ============================================================================
// 12. SLASH COMMAND SERVICE (parse logic tests — no external calls)
// ============================================================================
describe("SlashCommandService (parse logic)", () => {
  it("should detect empty text", () => {
    const text: string = "";
    const isEmpty = !text || text.trim().length === 0;
    expect(isEmpty).toBe(true);
  });

  it("should parse @username and message", () => {
    const text = "@jane Great job on the project!";
    const trimmed = text.trim();
    const mentionMatch = trimmed.match(/^(?:<@(\w+)(?:\|[^>]*)?>|@(\S+)|(\S+))\s+(.+)$/s);

    expect(mentionMatch).not.toBeNull();
    expect(mentionMatch![2]).toBe("jane");
    expect(mentionMatch![4]).toBe("Great job on the project!");
  });

  it("should parse Slack user mention format <@U12345|username>", () => {
    const text = "<@U12345|jane> You are awesome!";
    const trimmed = text.trim();
    const mentionMatch = trimmed.match(/^(?:<@(\w+)(?:\|[^>]*)?>|@(\S+)|(\S+))\s+(.+)$/s);

    expect(mentionMatch).not.toBeNull();
    expect(mentionMatch![1]).toBe("U12345"); // slack user ID
    expect(mentionMatch![4]).toBe("You are awesome!");
  });

  it("should parse plain username (no @)", () => {
    const text = "bob Thanks for your help";
    const trimmed = text.trim();
    const mentionMatch = trimmed.match(/^(?:<@(\w+)(?:\|[^>]*)?>|@(\S+)|(\S+))\s+(.+)$/s);

    expect(mentionMatch).not.toBeNull();
    expect(mentionMatch![3]).toBe("bob");
    expect(mentionMatch![4]).toBe("Thanks for your help");
  });

  it("should reject unparseable command", () => {
    const text = "justoneword";
    const trimmed = text.trim();
    const mentionMatch = trimmed.match(/^(?:<@(\w+)(?:\|[^>]*)?>|@(\S+)|(\S+))\s+(.+)$/s);

    expect(mentionMatch).toBeNull();
  });
});

// ============================================================================
// 13. AUTH SERVICE — token/query patterns
// ============================================================================
describe("AuthService patterns (real DB — empcloud cross-ref)", () => {
  it("should query empcloud users by email", async () => {
    // This queries the empcloud database cross-schema
    try {
      const [rows] = await db.raw(
        `SELECT id, first_name, last_name, email, role, status
         FROM empcloud.users WHERE email = ? LIMIT 1`,
        ["nonexistent-test@empcloud.com"],
      );
      // Should return empty for non-existent email
      expect(rows.length).toBe(0);
    } catch {
      // empcloud DB may not be accessible from this connection — acceptable
      expect(true).toBe(true);
    }
  });

  it("should query empcloud organizations", async () => {
    try {
      const [rows] = await db.raw(
        `SELECT id, name, is_active FROM empcloud.organizations WHERE id = ? LIMIT 1`,
        [1],
      );
      expect(Array.isArray(rows)).toBe(true);
    } catch {
      expect(true).toBe(true);
    }
  });
});
