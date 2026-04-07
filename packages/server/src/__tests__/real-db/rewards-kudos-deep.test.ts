import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import knex, { Knex } from "knex";
import { v4 as uuidv4 } from "uuid";

let db: Knex;
let dbReady = false;
const TEST_ORG = 88810;
const TEST_TS = Date.now();
const cleanupIds: { table: string; id: string }[] = [];
function track(table: string, id: string) { cleanupIds.push({ table, id }); }

beforeAll(async () => {
  try {
    db = knex({ client: "mysql2", connection: { host: "localhost", port: 3306, user: "empcloud", password: "EmpCloud2026", database: "emp_rewards" }, pool: { min: 1, max: 5 } });
    await db.raw("SELECT 1");
    dbReady = true;
  } catch {
    // DB not available — tests will be skipped
  }
});
beforeEach((ctx) => { if (!dbReady) ctx.skip(); });
afterEach(async () => { if (!dbReady) return; for (const item of [...cleanupIds].reverse()) { try { await db(item.table).where({ id: item.id }).del(); } catch {} } cleanupIds.length = 0; });
afterAll(async () => { if (dbReady) await db.destroy(); });

async function createCategory() {
  const id = uuidv4();
  await db("recognition_categories").insert({ id, organization_id: TEST_ORG, name: `Cat-${TEST_TS}-${id.slice(0,4)}`, description: "Test", icon: "star", color: "#FFD700", points_multiplier: 1.0, is_active: true });
  track("recognition_categories", id); return id;
}
async function createKudos(senderId: number, receiverId: number, categoryId: string | null, opts: any = {}) {
  const id = uuidv4();
  await db("kudos").insert({ id, organization_id: TEST_ORG, sender_id: senderId, receiver_id: receiverId, category_id: categoryId, message: opts.message || `Great work! ${TEST_TS}`, points: opts.points || 10, visibility: opts.visibility || "public", feedback_type: opts.feedbackType || "kudos", is_anonymous: opts.isAnonymous ? 1 : 0 });
  track("kudos", id); return id;
}

describe("Kudos - Give & List", () => {
  it("should create a kudos with category and points", async () => {
    const catId = await createCategory();
    const kudosId = await createKudos(88811, 88812, catId, { points: 15 });
    const k = await db("kudos").where({ id: kudosId }).first();
    expect(k.sender_id).toBe(88811);
    expect(k.receiver_id).toBe(88812);
    expect(k.points).toBe(15);
  });
  it("should list kudos for an organization", async () => {
    const catId = await createCategory();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) { ids.push(await createKudos(88811, 88812 + i, catId)); }
    const kudos = await db("kudos").where({ organization_id: TEST_ORG }).whereIn("id", ids);
    expect(kudos).toHaveLength(5);
  });
  it("should filter kudos by sender", async () => {
    const catId = await createCategory();
    await createKudos(88820, 88821, catId);
    await createKudos(88820, 88822, catId);
    await createKudos(88823, 88820, catId);
    const sent = await db("kudos").where({ organization_id: TEST_ORG, sender_id: 88820 });
    expect(sent.length).toBeGreaterThanOrEqual(2);
  });
  it("should filter kudos by receiver", async () => {
    const catId = await createCategory();
    await createKudos(88830, 88835, catId);
    await createKudos(88831, 88835, catId);
    const received = await db("kudos").where({ organization_id: TEST_ORG, receiver_id: 88835 });
    expect(received.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Kudos - Anonymous & Visibility", () => {
  it("should support anonymous kudos", async () => {
    const id = await createKudos(88840, 88841, null, { isAnonymous: true });
    const k = await db("kudos").where({ id }).first();
    expect(k.is_anonymous).toBe(1);
  });
  it("should support private visibility", async () => {
    const id = await createKudos(88842, 88843, null, { visibility: "private" });
    const k = await db("kudos").where({ id }).first();
    expect(k.visibility).toBe("private");
  });
  it("should support manager_only visibility", async () => {
    const id = await createKudos(88844, 88845, null, { visibility: "manager_only" });
    const k = await db("kudos").where({ id }).first();
    expect(k.visibility).toBe("manager_only");
  });
});

describe("Kudos - Reactions", () => {
  it("should add reaction to a kudos", async () => {
    const kudosId = await createKudos(88850, 88851, null);
    const reactionId = uuidv4();
    await db("kudos_reactions").insert({ id: reactionId, kudos_id: kudosId, user_id: 88852, reaction_type: "thumbsup" });
    track("kudos_reactions", reactionId);
    const r = await db("kudos_reactions").where({ id: reactionId }).first();
    expect(r.reaction_type).toBe("thumbsup");
  });
  it("should support multiple reaction types", async () => {
    const kudosId = await createKudos(88853, 88854, null);
    const reactions = ["thumbsup", "heart", "clap", "fire", "celebrate"];
    for (let i = 0; i < reactions.length; i++) {
      const rid = uuidv4();
      await db("kudos_reactions").insert({ id: rid, kudos_id: kudosId, user_id: 88860 + i, reaction_type: reactions[i] });
      track("kudos_reactions", rid);
    }
    const allReactions = await db("kudos_reactions").where({ kudos_id: kudosId });
    expect(allReactions).toHaveLength(5);
    expect(allReactions.map((r: any) => r.reaction_type)).toContain("fire");
  });
});

describe("Kudos - Comments", () => {
  it("should add comment to a kudos", async () => {
    const kudosId = await createKudos(88870, 88871, null);
    const commentId = uuidv4();
    await db("kudos_comments").insert({ id: commentId, kudos_id: kudosId, user_id: 88872, content: "Well deserved!" });
    track("kudos_comments", commentId);
    const c = await db("kudos_comments").where({ id: commentId }).first();
    expect(c.content).toBe("Well deserved!");
  });
  it("should list comments for a kudos", async () => {
    const kudosId = await createKudos(88873, 88874, null);
    for (let i = 0; i < 3; i++) {
      const cid = uuidv4();
      await db("kudos_comments").insert({ id: cid, kudos_id: kudosId, user_id: 88880 + i, content: `Comment ${i + 1}` });
      track("kudos_comments", cid);
    }
    const comments = await db("kudos_comments").where({ kudos_id: kudosId });
    expect(comments).toHaveLength(3);
  });
});

describe("Kudos - Points Tracking", () => {
  it("should track point balances after kudos", async () => {
    const balanceId = uuidv4();
    await db("point_balances").insert({ id: balanceId, organization_id: TEST_ORG, user_id: 88890, current_balance: 100, total_earned: 100, total_redeemed: 0, });
    track("point_balances", balanceId);
    const txId = uuidv4();
    await db("point_transactions").insert({ id: txId, organization_id: TEST_ORG, user_id: 88890, type: "kudos_received", amount: 10, balance_after: 110, reference_type: "kudos", description: "Kudos from peer" });
    track("point_transactions", txId);
    await db("point_balances").where({ id: balanceId }).update({ current_balance: 110, total_earned: 110 });
    const bal = await db("point_balances").where({ id: balanceId }).first();
    expect(bal.current_balance).toBe(110);
  });
});

describe("Recognition Settings", () => {
  it("should create and update recognition settings", async () => {
    const id = uuidv4();
    await db("recognition_settings").insert({ id, organization_id: TEST_ORG, points_per_kudos: 10, max_kudos_per_day: 5, allow_self_kudos: false, allow_anonymous_kudos: true, default_visibility: "public", points_currency_name: "Points" });
    track("recognition_settings", id);
    const s = await db("recognition_settings").where({ id }).first();
    expect(s.points_per_kudos).toBe(10);
    expect(s.allow_anonymous_kudos).toBe(1);
    await db("recognition_settings").where({ id }).update({ max_kudos_per_day: 10 });
    const updated = await db("recognition_settings").where({ id }).first();
    expect(updated.max_kudos_per_day).toBe(10);
  });
});
