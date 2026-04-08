import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import knex, { Knex } from "knex";
import { v4 as uuidv4 } from "uuid";

let db: Knex;
let dbReady = false;
const TEST_ORG = 88812;
const TEST_TS = Date.now();
const cleanupIds: { table: string; id: string }[] = [];
function track(table: string, id: string) { cleanupIds.push({ table, id }); }

beforeAll(async () => {
  try {
    db = knex({ client: "mysql2", connection: { host: "localhost", port: 3306, user: "empcloud", password: process.env.DB_PASSWORD || "", database: "emp_rewards" }, pool: { min: 1, max: 5 } });
    await db.raw("SELECT 1");
    dbReady = true;
  } catch {
    // DB not available — tests will be skipped
  }
});
beforeEach((ctx) => { if (!dbReady) ctx.skip(); });
afterEach(async () => { if (!dbReady) return; for (const item of [...cleanupIds].reverse()) { try { await db(item.table).where({ id: item.id }).del(); } catch {} } cleanupIds.length = 0; });
afterAll(async () => { if (dbReady) await db.destroy(); });

describe("Milestone Rules", () => {
  it("should create a milestone rule", async () => {
    const id = uuidv4();
    await db("milestone_rules").insert({ id, organization_id: TEST_ORG, name: `First Kudos-${TEST_TS}`, description: "Award for first kudos", trigger_type: "first_kudos", trigger_value: 1, reward_points: 25, is_active: true });
    track("milestone_rules", id);
    const r = await db("milestone_rules").where({ id }).first();
    expect(r.trigger_type).toBe("first_kudos");
    expect(r.reward_points).toBe(25);
  });
  it("should support work_anniversary trigger", async () => {
    const id = uuidv4();
    await db("milestone_rules").insert({ id, organization_id: TEST_ORG, name: `5yr-${TEST_TS}`, trigger_type: "work_anniversary", trigger_value: 5, reward_points: 500, is_active: true });
    track("milestone_rules", id);
    expect((await db("milestone_rules").where({ id }).first()).trigger_value).toBe(5);
  });
  it("should record milestone achievements", async () => {
    const ruleId = uuidv4();
    await db("milestone_rules").insert({ id: ruleId, organization_id: TEST_ORG, name: `Master-${TEST_TS}`, trigger_type: "kudos_count", trigger_value: 50, reward_points: 100, is_active: true });
    track("milestone_rules", ruleId);
    const achId = uuidv4();
    await db("milestone_achievements").insert({ id: achId, organization_id: TEST_ORG, user_id: 88820, milestone_rule_id: ruleId, points_awarded: 100 });
    track("milestone_achievements", achId);
    const a = await db("milestone_achievements").where({ id: achId }).first();
    expect(a.points_awarded).toBe(100);
  });
});

describe("Recognition Budget", () => {
  it("should create a department budget", async () => {
    const id = uuidv4();
    await db("recognition_budgets").insert({ id, organization_id: TEST_ORG, budget_type: "department", owner_id: 88821, department_id: 1, period: "monthly", total_amount: 10000, spent_amount: 0, remaining_amount: 10000, period_start: "2026-03-01", period_end: "2026-03-31", is_active: true });
    track("recognition_budgets", id);
    const b = await db("recognition_budgets").where({ id }).first();
    expect(b.budget_type).toBe("department");
    expect(b.total_amount).toBe(10000);
  });
  it("should track budget utilization", async () => {
    const id = uuidv4();
    await db("recognition_budgets").insert({ id, organization_id: TEST_ORG, budget_type: "individual", owner_id: 88822, period: "monthly", total_amount: 5000, spent_amount: 3000, remaining_amount: 2000, period_start: "2026-03-01", period_end: "2026-03-31", is_active: true });
    track("recognition_budgets", id);
    const b = await db("recognition_budgets").where({ id }).first();
    expect(Math.round((Number(b.spent_amount) / Number(b.total_amount)) * 100)).toBe(60);
  });
  it("should update budget on spend", async () => {
    const id = uuidv4();
    await db("recognition_budgets").insert({ id, organization_id: TEST_ORG, budget_type: "individual", owner_id: 88823, period: "monthly", total_amount: 8000, spent_amount: 0, remaining_amount: 8000, period_start: "2026-04-01", period_end: "2026-04-30", is_active: true });
    track("recognition_budgets", id);
    await db("recognition_budgets").where({ id }).update({ spent_amount: 2000, remaining_amount: 6000 });
    const updated = await db("recognition_budgets").where({ id }).first();
    expect(updated.remaining_amount).toBe(6000);
  });
});

describe("Redemption Lifecycle", () => {
  it("should create a reward catalog item", async () => {
    const id = uuidv4();
    await db("reward_catalog").insert({ id, organization_id: TEST_ORG, name: `Amazon GC-${TEST_TS}`, description: "500 INR voucher", category: "gift_card", points_cost: 500, monetary_value: 50000, quantity_available: 50, is_active: true });
    track("reward_catalog", id);
    const r = await db("reward_catalog").where({ id }).first();
    expect(r.category).toBe("gift_card");
    expect(r.points_cost).toBe(500);
  });
  it("should redeem: pending -> approved -> fulfilled", async () => {
    const rewardId = uuidv4();
    await db("reward_catalog").insert({ id: rewardId, organization_id: TEST_ORG, name: `Mug-${TEST_TS}`, category: "merchandise", points_cost: 200, quantity_available: 10, is_active: true });
    track("reward_catalog", rewardId);
    const balId = uuidv4();
    await db("point_balances").insert({ id: balId, organization_id: TEST_ORG, user_id: 88830, current_balance: 1000, total_earned: 1000, total_redeemed: 0, });
    track("point_balances", balId);
    const redId = uuidv4();
    await db("reward_redemptions").insert({ id: redId, organization_id: TEST_ORG, user_id: 88830, reward_id: rewardId, points_spent: 200, status: "pending" });
    track("reward_redemptions", redId);
    await db("point_balances").where({ id: balId }).update({ current_balance: 800, total_redeemed: 200 });
    await db("reward_redemptions").where({ id: redId }).update({ status: "approved", reviewed_by: 88999 });
    await db("reward_redemptions").where({ id: redId }).update({ status: "fulfilled", fulfilled_at: new Date() });
    const red = await db("reward_redemptions").where({ id: redId }).first();
    expect(red.status).toBe("fulfilled");
    expect(red.fulfilled_at).toBeTruthy();
  });
  it("should reject and refund points", async () => {
    const rewardId = uuidv4();
    await db("reward_catalog").insert({ id: rewardId, organization_id: TEST_ORG, name: `Tshirt-${TEST_TS}`, category: "merchandise", points_cost: 150, quantity_available: 5, is_active: true });
    track("reward_catalog", rewardId);
    const balId = uuidv4();
    await db("point_balances").insert({ id: balId, organization_id: TEST_ORG, user_id: 88831, current_balance: 350, total_earned: 500, total_redeemed: 150, });
    track("point_balances", balId);
    const redId = uuidv4();
    await db("reward_redemptions").insert({ id: redId, organization_id: TEST_ORG, user_id: 88831, reward_id: rewardId, points_spent: 150, status: "pending" });
    track("reward_redemptions", redId);
    await db("reward_redemptions").where({ id: redId }).update({ status: "rejected", reviewed_by: 88999, review_note: "Out of stock" });
    await db("point_balances").where({ id: balId }).update({ current_balance: 500, total_redeemed: 0 });
    expect((await db("point_balances").where({ id: balId }).first()).current_balance).toBe(500);
    expect((await db("reward_redemptions").where({ id: redId }).first()).status).toBe("rejected");
  });
  it("should cancel redemption", async () => {
    const rewardId = uuidv4();
    await db("reward_catalog").insert({ id: rewardId, organization_id: TEST_ORG, name: `Hoodie-${TEST_TS}`, category: "merchandise", points_cost: 300, quantity_available: 3, is_active: true });
    track("reward_catalog", rewardId);
    const redId = uuidv4();
    await db("reward_redemptions").insert({ id: redId, organization_id: TEST_ORG, user_id: 88832, reward_id: rewardId, points_spent: 300, status: "pending" });
    track("reward_redemptions", redId);
    await db("reward_redemptions").where({ id: redId }).update({ status: "cancelled" });
    expect((await db("reward_redemptions").where({ id: redId }).first()).status).toBe("cancelled");
  });
});

describe("Nomination Programs", () => {
  it("should create a nomination program", async () => {
    const id = uuidv4();
    await db("nomination_programs").insert({ id, organization_id: TEST_ORG, name: `EOM-${TEST_TS}`, description: "Monthly recognition", frequency: "monthly", nominations_per_user: 1, points_awarded: 100, start_date: "2026-01-01", is_active: true, created_by: 88840 });
    track("nomination_programs", id);
    const p = await db("nomination_programs").where({ id }).first();
    expect(p.frequency).toBe("monthly");
  });
  it("should submit and review a nomination", async () => {
    const progId = uuidv4();
    await db("nomination_programs").insert({ id: progId, organization_id: TEST_ORG, name: `Star-${TEST_TS}`, frequency: "quarterly", nominations_per_user: 2, points_awarded: 200, start_date: "2026-01-01", is_active: true, created_by: 88841 });
    track("nomination_programs", progId);
    const nomId = uuidv4();
    await db("nominations").insert({ id: nomId, organization_id: TEST_ORG, program_id: progId, nominator_id: 88842, nominee_id: 88843, reason: "Exceptional delivery", status: "submitted" });
    track("nominations", nomId);
    await db("nominations").where({ id: nomId }).update({ status: "approved", reviewed_by: 88999 });
    expect((await db("nominations").where({ id: nomId }).first()).status).toBe("approved");
  });
});

describe("Push Subscriptions", () => {
  it("should store push subscription", async () => {
    const id = uuidv4();
    await db("push_subscriptions").insert({ id, organization_id: TEST_ORG, user_id: 88850, endpoint: `https://push.test/${TEST_TS}`, keys_p256dh: "test-key", keys_auth: "test-auth" });
    track("push_subscriptions", id);
    expect((await db("push_subscriptions").where({ id }).first()).endpoint).toContain("push.test");
  });
});

describe("Celebrations", () => {
  it("should create a celebration with wishes", async () => {
    const celId = uuidv4();
    await db("celebrations").insert({ id: celId, organization_id: TEST_ORG, user_id: 88860, type: "birthday", title: `Birthday-${TEST_TS}`, celebration_date: "2026-04-04" });
    track("celebrations", celId);
    const wishId = uuidv4();
    await db("celebration_wishes").insert({ id: wishId, celebration_id: celId, user_id: 88861, message: "Happy Birthday!" });
    track("celebration_wishes", wishId);
    expect((await db("celebration_wishes").where({ celebration_id: celId })).length).toBe(1);
  });
});

describe("Notification Preferences", () => {
  it("should create and update notification preferences", async () => {
    const id = uuidv4();
    await db("notification_preferences").insert({ id, organization_id: TEST_ORG, user_id: 88870, email_on_kudos_received: true, email_on_badge_awarded: true, email_on_redemption_update: true, email_on_nomination: false, email_weekly_digest: true });
    track("notification_preferences", id);
    await db("notification_preferences").where({ id }).update({ email_on_nomination: true, email_weekly_digest: false });
    const prefs = await db("notification_preferences").where({ id }).first();
    expect(prefs.email_on_nomination).toBe(1);
    expect(prefs.email_weekly_digest).toBe(0);
  });
});

describe("Analytics Data Queries", () => {
  it("should count total kudos for an org", async () => {
    for (let i = 0; i < 3; i++) {
      const id = uuidv4();
      await db("kudos").insert({ id, organization_id: TEST_ORG, sender_id: 88880, receiver_id: 88881 + i, message: `Analytics ${i}`, points: 5, visibility: "public", feedback_type: "kudos", is_anonymous: 0 });
      track("kudos", id);
    }
    const [rows] = await db.raw("SELECT COUNT(*) as total FROM kudos WHERE organization_id = ?", [TEST_ORG]);
    expect(Number(rows[0].total)).toBeGreaterThanOrEqual(3);
  });
  it("should calculate points distributed", async () => {
    for (let i = 0; i < 3; i++) {
      const id = uuidv4();
      await db("point_transactions").insert({ id, organization_id: TEST_ORG, user_id: 88890 + i, type: "kudos_received", amount: 10 * (i + 1), balance_after: 50, reference_type: "kudos", description: `Analytics tx ${i}` });
      track("point_transactions", id);
    }
    const [rows] = await db.raw("SELECT COALESCE(SUM(amount), 0) as total FROM point_transactions WHERE organization_id = ? AND amount > 0", [TEST_ORG]);
    expect(Number(rows[0].total)).toBeGreaterThanOrEqual(60);
  });
});
