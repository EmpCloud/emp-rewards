import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import knex, { Knex } from "knex";
import { v4 as uuidv4 } from "uuid";

let db: Knex;
const TEST_ORG = 88811;
const TEST_TS = Date.now();
const cleanupIds: { table: string; id: string }[] = [];
function track(table: string, id: string) { cleanupIds.push({ table, id }); }

beforeAll(async () => {
  db = knex({ client: "mysql2", connection: { host: "localhost", port: 3306, user: "empcloud", password: "EmpCloud2026", database: "emp_rewards" }, pool: { min: 1, max: 5 } });
  await db.raw("SELECT 1");
});
afterEach(async () => { for (const item of [...cleanupIds].reverse()) { try { await db(item.table).where({ id: item.id }).del(); } catch {} } cleanupIds.length = 0; });
afterAll(async () => { await db.destroy(); });

async function createChallenge(opts: any = {}) {
  const id = uuidv4();
  await db("challenges").insert({ id, organization_id: TEST_ORG, title: opts.title || `Challenge-${TEST_TS}-${id.slice(0,4)}`, description: "Test challenge", type: opts.type || "individual", metric: opts.metric || "kudos_sent", target_value: opts.targetValue || 10, start_date: opts.startDate || "2026-01-01", end_date: opts.endDate || "2026-12-31", reward_points: opts.rewardPoints || 50, status: opts.status || "active", created_by: 88811 });
  track("challenges", id); return id;
}
async function joinChallenge(challengeId: string, userId: number) {
  const id = uuidv4();
  await db("challenge_participants").insert({ id, challenge_id: challengeId, user_id: userId, current_value: 0, completed: 0 });
  track("challenge_participants", id); return id;
}

describe("Challenge - Create & List", () => {
  it("should create an individual challenge", async () => {
    const id = await createChallenge({ metric: "kudos_sent", targetValue: 20 });
    const c = await db("challenges").where({ id }).first();
    expect(c.type).toBe("individual");
    expect(c.metric).toBe("kudos_sent");
    expect(c.target_value).toBe(20);
  });
  it("should create a team challenge", async () => {
    const id = await createChallenge({ type: "team", metric: "points_earned", targetValue: 500 });
    const c = await db("challenges").where({ id }).first();
    expect(c.type).toBe("team");
  });
  it("should create a department challenge", async () => {
    const id = await createChallenge({ type: "department", metric: "badges_earned", targetValue: 5 });
    const c = await db("challenges").where({ id }).first();
    expect(c.type).toBe("department");
  });
  it("should list challenges by status", async () => {
    await createChallenge({ status: "active" });
    await createChallenge({ status: "upcoming" });
    await createChallenge({ status: "completed" });
    const active = await db("challenges").where({ organization_id: TEST_ORG, status: "active" });
    expect(active.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Challenge - Join & Participation", () => {
  it("should allow user to join a challenge", async () => {
    const chId = await createChallenge();
    const pId = await joinChallenge(chId, 88820);
    const p = await db("challenge_participants").where({ id: pId }).first();
    expect(p.challenge_id).toBe(chId);
    expect(p.user_id).toBe(88820);
    expect(p.completed).toBe(0);
  });
  it("should support multiple participants", async () => {
    const chId = await createChallenge();
    for (let i = 0; i < 5; i++) { await joinChallenge(chId, 88830 + i); }
    const participants = await db("challenge_participants").where({ challenge_id: chId });
    expect(participants).toHaveLength(5);
  });
});

describe("Challenge - Progress", () => {
  it("should update participant progress", async () => {
    const chId = await createChallenge({ targetValue: 10 });
    const pId = await joinChallenge(chId, 88840);
    await db("challenge_participants").where({ id: pId }).update({ current_value: 7 });
    const p = await db("challenge_participants").where({ id: pId }).first();
    expect(p.current_value).toBe(7);
  });
  it("should mark completed when target reached", async () => {
    const chId = await createChallenge({ targetValue: 5 });
    const pId = await joinChallenge(chId, 88841);
    await db("challenge_participants").where({ id: pId }).update({ current_value: 5, completed: 1, completed_at: new Date() });
    const p = await db("challenge_participants").where({ id: pId }).first();
    expect(p.completed).toBe(1);
    expect(p.completed_at).toBeTruthy();
  });
});

describe("Challenge - Leaderboard", () => {
  it("should rank participants by progress", async () => {
    const chId = await createChallenge({ targetValue: 100 });
    for (let i = 0; i < 4; i++) {
      const pId = await joinChallenge(chId, 88850 + i);
      await db("challenge_participants").where({ id: pId }).update({ current_value: [80, 50, 95, 30][i], rank: i + 1 });
    }
    const leaderboard = await db("challenge_participants").where({ challenge_id: chId }).orderBy("current_value", "desc");
    expect(leaderboard[0].current_value).toBe(95);
    expect(leaderboard[3].current_value).toBe(30);
  });
});

describe("Challenge - Complete & Cancel", () => {
  it("should complete a challenge", async () => {
    const chId = await createChallenge({ status: "active" });
    await db("challenges").where({ id: chId }).update({ status: "completed" });
    const c = await db("challenges").where({ id: chId }).first();
    expect(c.status).toBe("completed");
  });
  it("should cancel a challenge", async () => {
    const chId = await createChallenge({ status: "active" });
    await db("challenges").where({ id: chId }).update({ status: "cancelled" });
    const c = await db("challenges").where({ id: chId }).first();
    expect(c.status).toBe("cancelled");
  });
});

describe("Challenge - Metrics", () => {
  it("should support kudos_received metric", async () => {
    const id = await createChallenge({ metric: "kudos_received" });
    expect((await db("challenges").where({ id }).first()).metric).toBe("kudos_received");
  });
  it("should support points_earned metric", async () => {
    const id = await createChallenge({ metric: "points_earned" });
    expect((await db("challenges").where({ id }).first()).metric).toBe("points_earned");
  });
  it("should support badges_earned metric", async () => {
    const id = await createChallenge({ metric: "badges_earned" });
    expect((await db("challenges").where({ id }).first()).metric).toBe("badges_earned");
  });
});

describe("Leaderboard Snapshots", () => {
  it("should create leaderboard snapshot", async () => {
    const id = uuidv4();
    await db("leaderboard_snapshots").insert({ id, organization_id: TEST_ORG, period: "2026-03", period_key: "2026-03", user_id: 88870, total_points: 250, kudos_sent: 15, kudos_received: 20, badges_earned: 3, rank: 1 });
    track("leaderboard_snapshots", id);
    const snap = await db("leaderboard_snapshots").where({ id }).first();
    expect(snap.rank).toBe(1);
    expect(Number(snap.total_points)).toBe(250);
  });
});
