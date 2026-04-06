// =============================================================================
// MOCK-BASED COVERAGE PUSH — EMP Rewards (71.3% → 90%+)
// Targets: challenge, nomination, redemption, budget, milestone, celebration,
//          settings, auth, slack, slash-command, teams, leaderboard, kudos,
//          analytics, reward, push services
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock DB adapter — intercepts all getDB() calls
// ---------------------------------------------------------------------------
const mockDB: any = {
  findById: vi.fn(),
  findOne: vi.fn(),
  findMany: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
  create: vi.fn().mockImplementation((_table: string, data: any) => ({
    id: data.id || "mock-id-001",
    ...data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })),
  update: vi.fn().mockImplementation((_table: string, _id: string, data: any) => ({
    id: _id,
    ...data,
    updated_at: new Date().toISOString(),
  })),
  delete: vi.fn().mockResolvedValue(true),
  count: vi.fn().mockResolvedValue(0),
  sum: vi.fn().mockResolvedValue(0),
  raw: vi.fn().mockResolvedValue([[]]),
  updateMany: vi.fn().mockResolvedValue(1),
  deleteMany: vi.fn().mockResolvedValue(1),
  createMany: vi.fn().mockResolvedValue([]),
};

vi.mock("../../db/adapters", () => ({
  getDB: vi.fn(() => mockDB),
  initDB: vi.fn().mockResolvedValue(mockDB),
  closeDB: vi.fn(),
  createDBAdapter: vi.fn(() => mockDB),
}));

// Mock empcloud DB for celebration, slack, teams services
const mockEmpCloudDB: any = Object.assign(
  vi.fn().mockReturnValue({
    where: vi.fn().mockReturnThis(),
    whereRaw: vi.fn().mockReturnThis(),
    whereNotNull: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    select: vi.fn().mockReturnThis(),
    raw: vi.fn().mockResolvedValue([[], []]),
  }),
  {
    raw: vi.fn().mockResolvedValue([[], []]),
  },
);

vi.mock("../../db/empcloud", () => ({
  getEmpCloudDB: vi.fn(() => mockEmpCloudDB),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  findOrgById: vi.fn(),
  createOrganization: vi.fn(),
  createUser: vi.fn(),
}));

// Mock points + badge services for milestone/challenge
vi.mock("../../services/points/points.service", () => ({
  earnPoints: vi.fn().mockResolvedValue({ id: "pt-1", amount: 100 }),
}));
vi.mock("../../services/badge/badge.service", () => ({
  awardBadge: vi.fn().mockResolvedValue({ id: "ub-1" }),
}));

// Note: kudos service is NOT mocked — we test it directly
// Slash-command tests only cover paths that don't reach kudos service

// Mock logger
vi.mock("../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock config for auth
vi.mock("../../config", () => ({
  config: {
    jwt: { secret: "test-secret-key-12345", accessExpiry: "1h", refreshExpiry: "7d" },
    db: { host: "localhost", port: 3306, user: "root", password: "", name: "test", poolMin: 1, poolMax: 5 },
  },
}));

// Mock uuid
vi.mock("uuid", () => ({ v4: vi.fn(() => "uuid-mock-001") }));

// Mock bcryptjs for auth service
const mockBcryptCompare = vi.fn().mockResolvedValue(true);
const mockBcryptHash = vi.fn().mockResolvedValue("$2a$12$hashed");
vi.mock("bcryptjs", () => ({
  default: { compare: (...args: any[]) => mockBcryptCompare(...args), hash: (...args: any[]) => mockBcryptHash(...args) },
  compare: (...args: any[]) => mockBcryptCompare(...args),
  hash: (...args: any[]) => mockBcryptHash(...args),
}));

// Mock jsonwebtoken for auth service
const mockJwtSign = vi.fn().mockReturnValue("mock-jwt-token");
const mockJwtVerify = vi.fn().mockReturnValue({ userId: 1, type: "refresh" });
const mockJwtDecode = vi.fn().mockReturnValue(null);
vi.mock("jsonwebtoken", () => ({
  default: { sign: (...args: any[]) => mockJwtSign(...args), verify: (...args: any[]) => mockJwtVerify(...args), decode: (...args: any[]) => mockJwtDecode(...args) },
  sign: (...args: any[]) => mockJwtSign(...args),
  verify: (...args: any[]) => mockJwtVerify(...args),
  decode: (...args: any[]) => mockJwtDecode(...args),
}));

// Mock fetch globally
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  text: vi.fn().mockResolvedValue("ok"),
  json: vi.fn().mockResolvedValue({}),
  status: 200,
});
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  // Reset call history without losing implementation
  mockDB.findById.mockReset().mockResolvedValue(null);
  mockDB.findOne.mockReset().mockResolvedValue(null);
  mockDB.findMany.mockReset().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
  mockDB.create.mockReset().mockImplementation((_table: string, data: any) => ({
    id: data.id || "mock-id-001",
    ...data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
  mockDB.update.mockReset().mockImplementation((_table: string, _id: string, data: any) => ({
    id: _id,
    ...data,
    updated_at: new Date().toISOString(),
  }));
  mockDB.delete.mockReset().mockResolvedValue(true);
  mockDB.count.mockReset().mockResolvedValue(0);
  mockDB.sum.mockReset().mockResolvedValue(0);
  mockDB.raw.mockReset().mockResolvedValue([[]]);
  mockDB.updateMany.mockReset().mockResolvedValue(1);
  mockDB.deleteMany.mockReset().mockResolvedValue(1);
  mockDB.createMany.mockReset().mockResolvedValue([]);
  mockFetch.mockReset().mockResolvedValue({
    ok: true,
    text: vi.fn().mockResolvedValue("ok"),
    json: vi.fn().mockResolvedValue({}),
    status: 200,
  });
});

// ===========================================================================
// 1) CHALLENGE SERVICE
// ===========================================================================
describe("Challenge Service (mock)", () => {
  let challengeService: typeof import("../../services/challenge/challenge.service");

  beforeEach(async () => {
    challengeService = await import("../../services/challenge/challenge.service");
  });

  // no resetModules — mocks must persist

  it("createChallenge — sets status=active when dates span today", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const future = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10);
    const result = await challengeService.createChallenge(1, {
      title: "Test Challenge",
      type: "individual",
      metric: "kudos_sent",
      target_value: 10,
      start_date: today,
      end_date: future,
      created_by: 100,
    });
    expect(mockDB.create).toHaveBeenCalledWith("challenges", expect.objectContaining({ status: "active" }));
    expect(result).toBeDefined();
  });

  it("createChallenge — sets status=upcoming when start_date is future", async () => {
    const future = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10);
    const farFuture = new Date(Date.now() + 86400000 * 60).toISOString().slice(0, 10);
    await challengeService.createChallenge(1, {
      title: "Future Challenge",
      type: "team",
      metric: "points_earned",
      target_value: 50,
      start_date: future,
      end_date: farFuture,
      created_by: 100,
    });
    expect(mockDB.create).toHaveBeenCalledWith("challenges", expect.objectContaining({ status: "upcoming" }));
  });

  it("listChallenges — filters by status and paginates", async () => {
    mockDB.findMany.mockResolvedValue({ data: [{ id: "c-1", title: "Test" }], total: 1, page: 1, limit: 20, totalPages: 1 });
    const result = await challengeService.listChallenges(1, { status: "active", page: 2, perPage: 10 });
    expect(result.data).toHaveLength(1);
    expect(mockDB.findMany).toHaveBeenCalledWith("challenges", expect.objectContaining({
      page: 2,
      limit: 10,
      filters: { organization_id: 1, status: "active" },
    }));
  });

  it("listChallenges — no status filter", async () => {
    await challengeService.listChallenges(1, {});
    expect(mockDB.findMany).toHaveBeenCalledWith("challenges", expect.objectContaining({
      filters: { organization_id: 1 },
    }));
  });

  it("getChallenge — returns challenge with participants", async () => {
    mockDB.findById.mockResolvedValue({ id: "c-1", organization_id: 1, title: "Test" });
    mockDB.raw.mockResolvedValue([[{ id: "p1", user_id: 10, current_value: 5 }]]);
    const result = await challengeService.getChallenge(1, "c-1");
    expect(result.challenge.title).toBe("Test");
    expect(result.participants).toHaveLength(1);
    expect(result.participantCount).toBe(1);
  });

  it("getChallenge — throws NotFoundError when not found", async () => {
    mockDB.findById.mockResolvedValue(null);
    await expect(challengeService.getChallenge(1, "nonexistent")).rejects.toThrow();
  });

  it("getChallenge — throws NotFoundError when wrong org", async () => {
    mockDB.findById.mockResolvedValue({ id: "c-1", organization_id: 999 });
    await expect(challengeService.getChallenge(1, "c-1")).rejects.toThrow();
  });

  it("getChallenge — handles null participants", async () => {
    mockDB.findById.mockResolvedValue({ id: "c-1", organization_id: 1 });
    mockDB.raw.mockResolvedValue([null]);
    const result = await challengeService.getChallenge(1, "c-1");
    expect(result.participants).toEqual([]);
    expect(result.participantCount).toBe(0);
  });

  it("joinChallenge — succeeds for active challenge", async () => {
    mockDB.findById.mockResolvedValue({ id: "c-1", organization_id: 1, status: "active" });
    mockDB.findOne.mockResolvedValue(null);
    const result = await challengeService.joinChallenge(1, "c-1", 10);
    expect(mockDB.create).toHaveBeenCalledWith("challenge_participants", expect.objectContaining({
      challenge_id: "c-1",
      user_id: 10,
      completed: false,
    }));
    expect(result).toBeDefined();
  });

  it("joinChallenge — succeeds for upcoming challenge", async () => {
    mockDB.findById.mockResolvedValue({ id: "c-1", organization_id: 1, status: "upcoming" });
    mockDB.findOne.mockResolvedValue(null);
    await challengeService.joinChallenge(1, "c-1", 10);
    expect(mockDB.create).toHaveBeenCalled();
  });

  it("joinChallenge — throws when challenge not found", async () => {
    mockDB.findById.mockResolvedValue(null);
    await expect(challengeService.joinChallenge(1, "c-1", 10)).rejects.toThrow();
  });

  it("joinChallenge — throws when challenge completed", async () => {
    mockDB.findById.mockResolvedValue({ id: "c-1", organization_id: 1, status: "completed" });
    await expect(challengeService.joinChallenge(1, "c-1", 10)).rejects.toThrow("no longer accepting");
  });

  it("joinChallenge — throws when already joined", async () => {
    mockDB.findById.mockResolvedValue({ id: "c-1", organization_id: 1, status: "active" });
    mockDB.findOne.mockResolvedValue({ id: "existing" });
    await expect(challengeService.joinChallenge(1, "c-1", 10)).rejects.toThrow("already joined");
  });

  it("updateProgress — processes all metric types", async () => {
    const challenge = {
      id: "c-1",
      organization_id: 1,
      metric: "kudos_sent",
      target_value: 5,
      start_date: "2025-01-01",
      end_date: "2025-12-31",
    };
    mockDB.findById.mockResolvedValue(challenge);
    mockDB.raw
      .mockResolvedValueOnce([[{ id: "p1", user_id: 10, completed: false, completed_at: null }]])
      .mockResolvedValueOnce([[{ count: 6 }]])
      .mockResolvedValue([[]]);

    await challengeService.updateProgress(1, "c-1");
    // Should update participant and recalculate ranks
    expect(mockDB.raw).toHaveBeenCalledTimes(4); // get participants + metric query + update + ranks
  });

  it("updateProgress — handles kudos_received metric", async () => {
    const challenge = { id: "c-1", organization_id: 1, metric: "kudos_received", target_value: 3, start_date: "2025-01-01", end_date: "2025-12-31" };
    mockDB.findById.mockResolvedValue(challenge);
    mockDB.raw
      .mockResolvedValueOnce([[{ id: "p1", user_id: 10, completed: false, completed_at: null }]])
      .mockResolvedValueOnce([[{ count: 2 }]])
      .mockResolvedValue([[]]);
    await challengeService.updateProgress(1, "c-1");
    expect(mockDB.raw).toHaveBeenCalled();
  });

  it("updateProgress — handles points_earned metric", async () => {
    const challenge = { id: "c-1", organization_id: 1, metric: "points_earned", target_value: 100, start_date: "2025-01-01", end_date: "2025-12-31" };
    mockDB.findById.mockResolvedValue(challenge);
    mockDB.raw
      .mockResolvedValueOnce([[{ id: "p1", user_id: 10, completed: false, completed_at: null }]])
      .mockResolvedValueOnce([[{ total: 150 }]])
      .mockResolvedValue([[]]);
    await challengeService.updateProgress(1, "c-1");
    expect(mockDB.raw).toHaveBeenCalled();
  });

  it("updateProgress — handles badges_earned metric", async () => {
    const challenge = { id: "c-1", organization_id: 1, metric: "badges_earned", target_value: 2, start_date: "2025-01-01", end_date: "2025-12-31" };
    mockDB.findById.mockResolvedValue(challenge);
    mockDB.raw
      .mockResolvedValueOnce([[{ id: "p1", user_id: 10, completed: false, completed_at: null }]])
      .mockResolvedValueOnce([[{ count: 3 }]])
      .mockResolvedValue([[]]);
    await challengeService.updateProgress(1, "c-1");
    expect(mockDB.raw).toHaveBeenCalled();
  });

  it("updateProgress — throws when challenge not found", async () => {
    mockDB.findById.mockResolvedValue(null);
    await expect(challengeService.updateProgress(1, "nonexistent")).rejects.toThrow();
  });

  it("updateProgress — exits early when no participants", async () => {
    mockDB.findById.mockResolvedValue({ id: "c-1", organization_id: 1 });
    mockDB.raw.mockResolvedValueOnce([[]]);
    await challengeService.updateProgress(1, "c-1");
    // Should not call rank update
    expect(mockDB.raw).toHaveBeenCalledTimes(1);
  });

  it("updateProgress — handles null participants array", async () => {
    mockDB.findById.mockResolvedValue({ id: "c-1", organization_id: 1 });
    mockDB.raw.mockResolvedValueOnce([null]);
    await challengeService.updateProgress(1, "c-1");
    expect(mockDB.raw).toHaveBeenCalledTimes(1);
  });

  it("completeChallenge — awards points and badges to winners", async () => {
    // First call: findById for completeChallenge
    mockDB.findById
      .mockResolvedValueOnce({ id: "c-1", organization_id: 1, status: "active", metric: "kudos_sent", target_value: 5, start_date: "2025-01-01", end_date: "2025-12-31", reward_points: 100, reward_badge_id: "badge-1", title: "Test" })
      // Second call: findById for updateProgress
      .mockResolvedValueOnce({ id: "c-1", organization_id: 1, metric: "kudos_sent", target_value: 5, start_date: "2025-01-01", end_date: "2025-12-31", reward_points: 100, reward_badge_id: "badge-1", title: "Test" });

    mockDB.raw
      .mockResolvedValueOnce([[]]) // updateProgress: get participants (empty)
      .mockResolvedValueOnce([[{ user_id: 10, completed: true }]]); // completed participants

    await challengeService.completeChallenge(1, "c-1");
    expect(mockDB.update).toHaveBeenCalledWith("challenges", "c-1", expect.objectContaining({ status: "completed" }));
  });

  it("completeChallenge — throws when already completed", async () => {
    mockDB.findById.mockResolvedValue({ id: "c-1", organization_id: 1, status: "completed" });
    await expect(challengeService.completeChallenge(1, "c-1")).rejects.toThrow("already been completed");
  });

  it("completeChallenge — throws when not found", async () => {
    mockDB.findById.mockResolvedValue(null);
    await expect(challengeService.completeChallenge(1, "c-1")).rejects.toThrow();
  });

  it("completeChallenge — handles no completed participants", async () => {
    mockDB.findById
      .mockResolvedValueOnce({ id: "c-1", organization_id: 1, status: "active", metric: "kudos_sent", target_value: 5, start_date: "2025-01-01", end_date: "2025-12-31", reward_points: 0, reward_badge_id: null, title: "Test" })
      .mockResolvedValueOnce({ id: "c-1", organization_id: 1, metric: "kudos_sent", target_value: 5, start_date: "2025-01-01", end_date: "2025-12-31" });
    mockDB.raw
      .mockResolvedValueOnce([[]]) // updateProgress participants
      .mockResolvedValueOnce([null]); // completed participants = null
    await challengeService.completeChallenge(1, "c-1");
    expect(mockDB.update).toHaveBeenCalledWith("challenges", "c-1", { status: "completed" });
  });

  it("getChallengeLeaderboard — returns sorted participants", async () => {
    mockDB.findById.mockResolvedValue({ id: "c-1", organization_id: 1 });
    mockDB.raw.mockResolvedValue([[{ id: "p1", current_value: 10 }, { id: "p2", current_value: 5 }]]);
    const result = await challengeService.getChallengeLeaderboard(1, "c-1");
    expect(result).toHaveLength(2);
  });

  it("getChallengeLeaderboard — throws when challenge not found", async () => {
    mockDB.findById.mockResolvedValue(null);
    await expect(challengeService.getChallengeLeaderboard(1, "c-1")).rejects.toThrow();
  });

  it("getChallengeLeaderboard — handles null rows", async () => {
    mockDB.findById.mockResolvedValue({ id: "c-1", organization_id: 1 });
    mockDB.raw.mockResolvedValue([null]);
    const result = await challengeService.getChallengeLeaderboard(1, "c-1");
    expect(result).toEqual([]);
  });
});

// ===========================================================================
// 2) NOMINATION SERVICE
// ===========================================================================
describe("Nomination Service (mock)", () => {
  let nominationService: typeof import("../../services/nomination/nomination.service");

  beforeEach(async () => {
    nominationService = await import("../../services/nomination/nomination.service");
  });

  // no resetModules — mocks must persist

  it("createProgram — creates a nomination program", async () => {
    const result = await nominationService.createProgram(1, 100, {
      name: "Employee of Month",
      frequency: "monthly",
      start_date: "2025-01-01",
    });
    expect(mockDB.create).toHaveBeenCalledWith("nomination_programs", expect.objectContaining({
      organization_id: 1,
      name: "Employee of Month",
    }));
    expect(result).toBeDefined();
  });

  it("listPrograms — with filters", async () => {
    mockDB.findMany.mockResolvedValue({ data: [{ id: "p1" }], total: 1, page: 1, limit: 20, totalPages: 1 });
    const result = await nominationService.listPrograms(1, { is_active: true, page: 2, perPage: 5 });
    expect(result.data).toHaveLength(1);
    expect(result.totalPages).toBe(1);
  });

  it("listPrograms — without filters", async () => {
    mockDB.findMany.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
    const result = await nominationService.listPrograms(1);
    expect(result.data).toEqual([]);
  });

  it("getProgram — found", async () => {
    mockDB.findOne.mockResolvedValue({ id: "p1", name: "Test" });
    const result = await nominationService.getProgram(1, "p1");
    expect(result.name).toBe("Test");
  });

  it("getProgram — not found throws", async () => {
    mockDB.findOne.mockResolvedValue(null);
    await expect(nominationService.getProgram(1, "p1")).rejects.toThrow();
  });

  it("updateProgram — updates existing", async () => {
    mockDB.findOne.mockResolvedValue({ id: "p1" });
    mockDB.update.mockResolvedValue({ id: "p1", name: "Updated" });
    const result = await nominationService.updateProgram(1, "p1", { name: "Updated" });
    expect(result.name).toBe("Updated");
  });

  it("updateProgram — not found throws", async () => {
    mockDB.findOne.mockResolvedValue(null);
    await expect(nominationService.updateProgram(1, "p1", { name: "x" })).rejects.toThrow();
  });

  it("submitNomination — full workflow", async () => {
    mockDB.findOne
      .mockResolvedValueOnce({ id: "prog-1", nominations_per_user: 5 }) // program
      .mockResolvedValueOnce(null); // no duplicate
    mockDB.count.mockResolvedValue(0);
    const result = await nominationService.submitNomination(1, 10, {
      program_id: "prog-1",
      nominee_id: 20,
      reason: "Great work",
    });
    expect(mockDB.create).toHaveBeenCalledWith("nominations", expect.objectContaining({
      nominee_id: 20,
      reason: "Great work",
    }));
    expect(result).toBeDefined();
  });

  it("submitNomination — self-nomination throws", async () => {
    mockDB.findOne.mockResolvedValue({ id: "prog-1", nominations_per_user: 5 });
    await expect(nominationService.submitNomination(1, 10, {
      program_id: "prog-1",
      nominee_id: 10,
      reason: "Me",
    })).rejects.toThrow("cannot nominate yourself");
  });

  it("submitNomination — program not found", async () => {
    mockDB.findOne.mockResolvedValue(null);
    await expect(nominationService.submitNomination(1, 10, {
      program_id: "prog-1",
      nominee_id: 20,
      reason: "x",
    })).rejects.toThrow();
  });

  it("submitNomination — limit reached", async () => {
    mockDB.findOne
      .mockResolvedValueOnce({ id: "prog-1", nominations_per_user: 1 }) // program
      .mockResolvedValueOnce(null); // no duplicate
    mockDB.count.mockResolvedValue(1);
    await expect(nominationService.submitNomination(1, 10, {
      program_id: "prog-1",
      nominee_id: 20,
      reason: "x",
    })).rejects.toThrow("already used all");
  });

  it("submitNomination — duplicate nomination", async () => {
    mockDB.findOne
      .mockResolvedValueOnce({ id: "prog-1", nominations_per_user: 5, is_active: true }) // program
      .mockResolvedValueOnce({ id: "dup" }); // duplicate found
    mockDB.count.mockResolvedValueOnce(0);
    await expect(nominationService.submitNomination(1, 10, {
      program_id: "prog-1",
      nominee_id: 20,
      reason: "x",
    })).rejects.toThrow("already nominated");
  });

  it("listNominations — with all filters", async () => {
    mockDB.findMany.mockResolvedValue({ data: [{ id: "n1" }], total: 1, page: 1, limit: 10, totalPages: 1 });
    const result = await nominationService.listNominations(1, {
      programId: "p1",
      status: "submitted",
      sort: "created_at",
      order: "asc",
      page: 1,
      perPage: 10,
    });
    expect(result.data).toHaveLength(1);
  });

  it("listNominations — defaults", async () => {
    mockDB.findMany.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
    const result = await nominationService.listNominations(1);
    expect(result.data).toEqual([]);
  });

  it("reviewNomination — select with points award (existing balance)", async () => {
    mockDB.findOne
      .mockResolvedValueOnce({ id: "n1", organization_id: 1, status: "submitted", program_id: "p1", nominee_id: 20 }) // nomination
      .mockResolvedValueOnce({ id: "p1", organization_id: 1, points_awarded: 50 }) // program
      .mockResolvedValueOnce({ id: "b1", current_balance: 100, total_earned: 200, total_redeemed: 100 }); // balance
    mockDB.update.mockResolvedValueOnce({ id: "n1", status: "selected" });
    const result = await nominationService.reviewNomination(1, "n1", "selected", 5, "Great!");
    expect(result.status).toBe("selected");
    expect(mockDB.update).toHaveBeenCalled();
    expect(mockDB.create).toHaveBeenCalled(); // point transaction
  });

  it("reviewNomination — select with points award (no existing balance)", async () => {
    mockDB.findOne
      .mockResolvedValueOnce({ id: "n1", organization_id: 1, status: "under_review", program_id: "p1", nominee_id: 20 }) // nomination
      .mockResolvedValueOnce({ id: "p1", organization_id: 1, points_awarded: 30 }) // program
      .mockResolvedValueOnce(null); // no balance
    mockDB.update.mockResolvedValueOnce({ id: "n1", status: "selected" });
    await nominationService.reviewNomination(1, "n1", "selected", 5);
    expect(mockDB.create).toHaveBeenCalledTimes(2); // balance + transaction
  });

  it("reviewNomination — not_selected (no points)", async () => {
    mockDB.findOne.mockResolvedValueOnce({ id: "n1", status: "submitted", program_id: "p1", nominee_id: 20 });
    mockDB.update.mockResolvedValue({ id: "n1", status: "not_selected" });
    const result = await nominationService.reviewNomination(1, "n1", "not_selected", 5, "Not this time");
    expect(result.status).toBe("not_selected");
  });

  it("reviewNomination — throws when not found", async () => {
    mockDB.findOne.mockResolvedValue(null);
    await expect(nominationService.reviewNomination(1, "n1", "selected", 5)).rejects.toThrow();
  });

  it("reviewNomination — throws when wrong status", async () => {
    mockDB.findOne.mockResolvedValue({ id: "n1", status: "selected" });
    await expect(nominationService.reviewNomination(1, "n1", "selected", 5)).rejects.toThrow("Cannot review");
  });

  it("reviewNomination — select with zero points program", async () => {
    mockDB.findOne
      .mockResolvedValueOnce({ id: "n1", organization_id: 1, status: "submitted", program_id: "p1", nominee_id: 20 })
      .mockResolvedValueOnce({ id: "p1", organization_id: 1, points_awarded: 0 });
    mockDB.update.mockResolvedValueOnce({ id: "n1", status: "selected" });
    await nominationService.reviewNomination(1, "n1", "selected", 5);
    // No point transaction should be created
    expect(mockDB.create).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 3) REDEMPTION SERVICE
// ===========================================================================
describe("Redemption Service (mock)", () => {
  let redemptionService: typeof import("../../services/redemption/redemption.service");

  beforeEach(async () => {
    redemptionService = await import("../../services/redemption/redemption.service");
  });

  // no resetModules — mocks must persist

  it("listRedemptions — with all filters", async () => {
    mockDB.findMany.mockResolvedValue({ data: [{ id: "r1" }], total: 1, page: 1, limit: 10, totalPages: 1 });
    const result = await redemptionService.listRedemptions(1, {
      status: "pending",
      userId: 10,
      sort: "created_at",
      order: "asc",
      page: 1,
      perPage: 10,
    });
    expect(result.data).toHaveLength(1);
  });

  it("listRedemptions — defaults", async () => {
    mockDB.findMany.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
    const result = await redemptionService.listRedemptions(1);
    expect(result.data).toEqual([]);
  });

  it("getRedemption — found", async () => {
    mockDB.findOne.mockResolvedValueOnce({ id: "r1", organization_id: 1, status: "pending" });
    const result = await redemptionService.getRedemption(1, "r1");
    expect(result.id).toBe("r1");
  });

  it("getRedemption — not found throws", async () => {
    mockDB.findOne.mockResolvedValueOnce(null);
    await expect(redemptionService.getRedemption(1, "r1")).rejects.toThrow();
  });

  it("approveRedemption — success", async () => {
    mockDB.findOne.mockResolvedValueOnce({ id: "r1", organization_id: 1, status: "pending" });
    mockDB.update.mockResolvedValueOnce({ id: "r1", status: "approved" });
    const result = await redemptionService.approveRedemption(1, "r1", 5);
    expect(result.status).toBe("approved");
  });

  it("approveRedemption — wrong status throws", async () => {
    mockDB.findOne.mockResolvedValueOnce({ id: "r1", organization_id: 1, status: "fulfilled" });
    await expect(redemptionService.approveRedemption(1, "r1", 5)).rejects.toThrow();
  });

  it("rejectRedemption — refunds points", async () => {
    mockDB.findOne
      .mockResolvedValueOnce({ id: "r1", organization_id: 1, status: "pending", user_id: 10, points_spent: 50, reward_id: "rw1" }) // redemption
      .mockResolvedValueOnce({ id: "b1", current_balance: 100, total_redeemed: 80 }) // balance
      .mockResolvedValueOnce({ id: "rw1", organization_id: 1, quantity_available: 5 }); // reward catalog
    mockDB.update.mockResolvedValue({ id: "r1", status: "rejected" });
    const result = await redemptionService.rejectRedemption(1, "r1", 5, "Not eligible");
    expect(result.status).toBe("rejected");
    expect(mockDB.create).toHaveBeenCalled(); // refund transaction
  });

  it("rejectRedemption — refunds points with no existing balance", async () => {
    mockDB.findOne
      .mockResolvedValueOnce({ id: "r1", organization_id: 1, status: "pending", user_id: 10, points_spent: 50, reward_id: "rw1" })
      .mockResolvedValueOnce(null) // no balance
      .mockResolvedValueOnce(null); // reward not found
    mockDB.update.mockResolvedValue({ id: "r1", status: "rejected" });
    await redemptionService.rejectRedemption(1, "r1", 5);
    expect(mockDB.create).toHaveBeenCalled();
  });

  it("fulfillRedemption — success", async () => {
    mockDB.findOne.mockResolvedValueOnce({ id: "r1", organization_id: 1, status: "approved", review_note: "prev note" });
    mockDB.update.mockResolvedValueOnce({ id: "r1", status: "fulfilled" });
    const result = await redemptionService.fulfillRedemption(1, "r1", "Shipped!");
    expect(result.status).toBe("fulfilled");
  });

  it("fulfillRedemption — wrong status throws", async () => {
    mockDB.findOne.mockResolvedValueOnce({ id: "r1", organization_id: 1, status: "pending" });
    await expect(redemptionService.fulfillRedemption(1, "r1")).rejects.toThrow();
  });

  it("cancelRedemption — by owner", async () => {
    mockDB.findOne
      .mockResolvedValueOnce({ id: "r1", organization_id: 1, status: "pending", user_id: 10, points_spent: 30, reward_id: "rw1" })
      .mockResolvedValueOnce({ id: "b1", current_balance: 50, total_redeemed: 30 }) // balance
      .mockResolvedValueOnce(null); // reward not found
    mockDB.update.mockResolvedValue({ id: "r1", status: "cancelled" });
    const result = await redemptionService.cancelRedemption(1, "r1", 10);
    expect(result.status).toBe("cancelled");
  });

  it("cancelRedemption — wrong user throws", async () => {
    mockDB.findOne.mockResolvedValueOnce({ id: "r1", organization_id: 1, status: "pending", user_id: 10 });
    await expect(redemptionService.cancelRedemption(1, "r1", 20)).rejects.toThrow();
  });

  it("cancelRedemption — wrong status throws", async () => {
    mockDB.findOne.mockResolvedValueOnce({ id: "r1", organization_id: 1, status: "approved", user_id: 10 });
    await expect(redemptionService.cancelRedemption(1, "r1", 10)).rejects.toThrow();
  });

  it("getMyRedemptions — delegates to listRedemptions", async () => {
    mockDB.findMany.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
    const result = await redemptionService.getMyRedemptions(1, 10, { status: "pending" });
    expect(result.data).toEqual([]);
  });
});

// ===========================================================================
// 4) BUDGET SERVICE
// ===========================================================================
describe("Budget Service (mock)", () => {
  let budgetService: typeof import("../../services/budget/budget.service");

  beforeEach(async () => {
    budgetService = await import("../../services/budget/budget.service");
  });

  // no resetModules — mocks must persist

  it("createBudget — creates with defaults", async () => {
    const result = await budgetService.createBudget(1, {
      budget_type: "department",
      owner_id: 10,
      department_id: 5,
      period: "monthly",
      total_amount: 1000,
      period_start: "2025-01-01",
      period_end: "2025-01-31",
    });
    expect(mockDB.create).toHaveBeenCalledWith("recognition_budgets", expect.objectContaining({
      spent_amount: 0,
      remaining_amount: 1000,
      is_active: true,
    }));
    expect(result).toBeDefined();
  });

  it("listBudgets — with all filters", async () => {
    mockDB.findMany.mockResolvedValue({ data: [{ id: "b1" }], total: 1, page: 1, limit: 20, totalPages: 1 });
    const result = await budgetService.listBudgets(1, { budgetType: "department", isActive: true, page: 1, perPage: 10 });
    expect(result.data).toHaveLength(1);
  });

  it("listBudgets — isActive=false filter", async () => {
    await budgetService.listBudgets(1, { isActive: false });
    expect(mockDB.findMany).toHaveBeenCalledWith("recognition_budgets", expect.objectContaining({
      filters: expect.objectContaining({ is_active: 0 }),
    }));
  });

  it("getBudget — found", async () => {
    mockDB.findById.mockResolvedValue({ id: "b1", organization_id: 1, total_amount: 1000 });
    const result = await budgetService.getBudget(1, "b1");
    expect(result.total_amount).toBe(1000);
  });

  it("getBudget — not found throws", async () => {
    mockDB.findById.mockResolvedValue(null);
    await expect(budgetService.getBudget(1, "b1")).rejects.toThrow();
  });

  it("getBudget — wrong org throws", async () => {
    mockDB.findById.mockResolvedValue({ id: "b1", organization_id: 999 });
    await expect(budgetService.getBudget(1, "b1")).rejects.toThrow();
  });

  it("updateBudget — recalculates remaining_amount", async () => {
    mockDB.findById.mockResolvedValue({ id: "b1", organization_id: 1, total_amount: 1000, spent_amount: 200 });
    mockDB.update.mockResolvedValue({ id: "b1", total_amount: 1500, remaining_amount: 1300 });
    const result = await budgetService.updateBudget(1, "b1", { total_amount: 1500 });
    expect(mockDB.update).toHaveBeenCalledWith("recognition_budgets", "b1", expect.objectContaining({
      total_amount: 1500,
      remaining_amount: 1300,
    }));
    expect(result).toBeDefined();
  });

  it("updateBudget — partial fields", async () => {
    mockDB.findById.mockResolvedValue({ id: "b1", organization_id: 1, total_amount: 1000, spent_amount: 0 });
    mockDB.update.mockResolvedValue({ id: "b1" });
    await budgetService.updateBudget(1, "b1", { period_start: "2025-02-01", period_end: "2025-02-28", is_active: false });
    expect(mockDB.update).toHaveBeenCalledWith("recognition_budgets", "b1", expect.objectContaining({
      period_start: "2025-02-01",
      period_end: "2025-02-28",
      is_active: false,
    }));
  });

  it("getBudgetUsage — returns utilization data", async () => {
    mockDB.findById.mockResolvedValue({ id: "b1", organization_id: 1, total_amount: 1000, spent_amount: 300 });
    mockDB.raw.mockResolvedValue([[{ id: "t1", amount: 100 }, { id: "t2", amount: 200 }]]);
    const result = await budgetService.getBudgetUsage(1, "b1");
    expect(result.utilizationRate).toBe(30);
    expect(result.transactions).toHaveLength(2);
  });

  it("getBudgetUsage — zero total_amount", async () => {
    mockDB.findById.mockResolvedValue({ id: "b1", organization_id: 1, total_amount: 0, spent_amount: 0 });
    mockDB.raw.mockResolvedValue([[]]);
    const result = await budgetService.getBudgetUsage(1, "b1");
    expect(result.utilizationRate).toBe(0);
  });

  it("checkBudget — allowed when budget exists and sufficient", async () => {
    mockDB.raw.mockResolvedValue([[{ id: "b1", remaining_amount: 500 }]]);
    const result = await budgetService.checkBudget(1, "department", 5, 200);
    expect(result.allowed).toBe(true);
    expect(result.remainingBudget).toBe(300);
    expect(result.budgetId).toBe("b1");
  });

  it("checkBudget — not allowed when insufficient", async () => {
    mockDB.raw.mockResolvedValue([[{ id: "b1", remaining_amount: 50 }]]);
    const result = await budgetService.checkBudget(1, "department", 5, 200);
    expect(result.allowed).toBe(false);
    expect(result.remainingBudget).toBe(50);
  });

  it("checkBudget — allowed by default when no budget configured", async () => {
    mockDB.raw.mockResolvedValue([[]]);
    const result = await budgetService.checkBudget(1, "individual", 10, 100);
    expect(result.allowed).toBe(true);
    expect(result.remainingBudget).toBe(-1);
    expect(result.budgetId).toBeNull();
  });

  it("checkBudget — uses owner_id for individual type", async () => {
    mockDB.raw.mockResolvedValue([null]);
    const result = await budgetService.checkBudget(1, "individual", 10, 100);
    expect(result.allowed).toBe(true);
  });
});

// ===========================================================================
// 5) MILESTONE SERVICE
// ===========================================================================
describe("Milestone Service (mock)", () => {
  let milestoneService: typeof import("../../services/milestone/milestone.service");

  beforeEach(async () => {
    milestoneService = await import("../../services/milestone/milestone.service");
  });

  // no resetModules — mocks must persist

  it("createRule — with defaults", async () => {
    await milestoneService.createRule(1, {
      name: "10 Kudos",
      trigger_type: "kudos_count",
      trigger_value: 10,
    });
    expect(mockDB.create).toHaveBeenCalledWith("milestone_rules", expect.objectContaining({
      is_active: true,
      reward_points: 0,
    }));
  });

  it("createRule — with all fields", async () => {
    await milestoneService.createRule(1, {
      name: "Expert",
      description: "Earned 500 points",
      trigger_type: "points_total",
      trigger_value: 500,
      reward_points: 100,
      reward_badge_id: "badge-1",
      is_active: false,
    });
    expect(mockDB.create).toHaveBeenCalledWith("milestone_rules", expect.objectContaining({
      is_active: false,
      reward_points: 100,
    }));
  });

  it("listRules — returns data array", async () => {
    mockDB.findMany.mockResolvedValue({ data: [{ id: "r1" }], total: 1, page: 1, limit: 100, totalPages: 1 });
    const result = await milestoneService.listRules(1);
    expect(result).toHaveLength(1);
  });

  it("updateRule — success", async () => {
    mockDB.findById.mockResolvedValue({ id: "r1", organization_id: 1 });
    mockDB.update.mockResolvedValue({ id: "r1", name: "Updated" });
    const result = await milestoneService.updateRule(1, "r1", { name: "Updated" });
    expect(result.name).toBe("Updated");
  });

  it("updateRule — not found throws", async () => {
    mockDB.findById.mockResolvedValue(null);
    await expect(milestoneService.updateRule(1, "r1", { name: "x" })).rejects.toThrow();
  });

  it("deleteRule — success", async () => {
    mockDB.findById.mockResolvedValue({ id: "r1", organization_id: 1 });
    await milestoneService.deleteRule(1, "r1");
    expect(mockDB.delete).toHaveBeenCalledWith("milestone_rules", "r1");
  });

  it("deleteRule — not found throws", async () => {
    mockDB.findById.mockResolvedValue(null);
    await expect(milestoneService.deleteRule(1, "r1")).rejects.toThrow();
  });

  it("checkMilestones — kudos_count qualifies", async () => {
    mockDB.raw
      .mockResolvedValueOnce([[{ id: "r1", trigger_type: "kudos_count", trigger_value: 5, reward_points: 50, reward_badge_id: null, is_active: true, name: "5 Kudos" }]])
      .mockResolvedValueOnce([[]]) // existing achievements
      .mockResolvedValueOnce([[{ count: 10 }]]); // kudos count
    const result = await milestoneService.checkMilestones(1, 10);
    expect(result).toHaveLength(1);
  });

  it("checkMilestones — points_total qualifies", async () => {
    mockDB.raw
      .mockResolvedValueOnce([[{ id: "r1", trigger_type: "points_total", trigger_value: 100, reward_points: 0, reward_badge_id: "b1", is_active: true, name: "100 Points" }]])
      .mockResolvedValueOnce([[]]);
    mockDB.findOne.mockResolvedValueOnce({ total_earned: 150 });
    const result = await milestoneService.checkMilestones(1, 10);
    expect(result).toHaveLength(1);
  });

  it("checkMilestones — badges_count qualifies", async () => {
    mockDB.raw
      .mockResolvedValueOnce([[{ id: "r1", trigger_type: "badges_count", trigger_value: 3, reward_points: 25, reward_badge_id: null, is_active: true, name: "3 Badges" }]])
      .mockResolvedValueOnce([[]]) // existing achievements
      .mockResolvedValueOnce([[{ count: 5 }]]); // badge count
    const result = await milestoneService.checkMilestones(1, 10);
    expect(result).toHaveLength(1);
  });

  it("checkMilestones — first_kudos qualifies", async () => {
    mockDB.raw
      .mockResolvedValueOnce([[{ id: "r1", trigger_type: "first_kudos", trigger_value: 1, reward_points: 10, reward_badge_id: null, is_active: true, name: "First Kudos" }]])
      .mockResolvedValueOnce([[]]) // existing achievements
      .mockResolvedValueOnce([[{ count: 1 }]]); // kudos sent count
    const result = await milestoneService.checkMilestones(1, 10);
    expect(result).toHaveLength(1);
  });

  it("checkMilestones — work_anniversary qualifies", async () => {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    mockDB.raw
      .mockResolvedValueOnce([[{ id: "r1", trigger_type: "work_anniversary", trigger_value: 2, reward_points: 100, reward_badge_id: null, is_active: true, name: "2 Year" }]])
      .mockResolvedValueOnce([[]]) // existing achievements
      .mockResolvedValueOnce([[{ created_at: threeYearsAgo.toISOString() }]]); // user join date
    const result = await milestoneService.checkMilestones(1, 10);
    expect(result).toHaveLength(1);
  });

  it("checkMilestones — work_anniversary no user data", async () => {
    mockDB.raw
      .mockResolvedValueOnce([[{ id: "r1", trigger_type: "work_anniversary", trigger_value: 2, reward_points: 0, reward_badge_id: null, is_active: true, name: "2 Year" }]])
      .mockResolvedValueOnce([[]]) // existing achievements
      .mockResolvedValueOnce([null]); // no user found
    const result = await milestoneService.checkMilestones(1, 10);
    expect(result).toHaveLength(0);
  });

  it("checkMilestones — referral_hired (not implemented)", async () => {
    mockDB.raw
      .mockResolvedValueOnce([[{ id: "r1", trigger_type: "referral_hired", trigger_value: 1, reward_points: 0, reward_badge_id: null, is_active: true, name: "Referral" }]])
      .mockResolvedValueOnce([[]]); // existing achievements
    const result = await milestoneService.checkMilestones(1, 10);
    expect(result).toHaveLength(0);
  });

  it("checkMilestones — skips already achieved rules", async () => {
    mockDB.raw
      .mockResolvedValueOnce([[{ id: "r1", trigger_type: "kudos_count", trigger_value: 5, reward_points: 50, reward_badge_id: null, is_active: true, name: "5 Kudos" }]])
      .mockResolvedValueOnce([[{ milestone_rule_id: "r1" }]]); // already achieved
    const result = await milestoneService.checkMilestones(1, 10);
    expect(result).toHaveLength(0);
  });

  it("checkMilestones — no rules returns empty", async () => {
    mockDB.raw.mockResolvedValueOnce([[]]);
    const result = await milestoneService.checkMilestones(1, 10);
    expect(result).toHaveLength(0);
  });

  it("checkMilestones — null rules returns empty", async () => {
    mockDB.raw.mockResolvedValueOnce([null]);
    const result = await milestoneService.checkMilestones(1, 10);
    expect(result).toHaveLength(0);
  });

  it("checkMilestones — handles duplicate entry error gracefully", async () => {
    mockDB.raw
      .mockResolvedValueOnce([[{ id: "r1", trigger_type: "kudos_count", trigger_value: 1, reward_points: 0, reward_badge_id: null, is_active: true, name: "Test" }]])
      .mockResolvedValueOnce([[]]) // existing achievements
      .mockResolvedValueOnce([[{ count: 5 }]]); // kudos count
    mockDB.create.mockRejectedValueOnce({ code: "ER_DUP_ENTRY" });
    const result = await milestoneService.checkMilestones(1, 10);
    expect(result).toHaveLength(0);
  });

  it("getUserAchievements — returns joined data", async () => {
    mockDB.raw.mockResolvedValue([[{ id: "a1", rule_name: "Test" }]]);
    const result = await milestoneService.getUserAchievements(1, 10);
    expect(result).toHaveLength(1);
    expect(result[0].rule_name).toBe("Test");
  });

  it("getUserAchievements — handles null rows", async () => {
    mockDB.raw.mockResolvedValue([null]);
    const result = await milestoneService.getUserAchievements(1, 10);
    expect(result).toEqual([]);
  });
});

// ===========================================================================
// 6) SETTINGS SERVICE
// ===========================================================================
describe("Settings Service (mock)", () => {
  let settingsService: typeof import("../../services/settings/settings.service");

  beforeEach(async () => {
    settingsService = await import("../../services/settings/settings.service");
  });

  // no resetModules — mocks must persist

  it("getSettings — returns existing", async () => {
    mockDB.findOne.mockResolvedValueOnce({ id: "s1", organization_id: 1, points_per_kudos: 15 });
    const result = await settingsService.getSettings(1);
    expect(result.points_per_kudos).toBe(15);
  });

  it("getSettings — creates defaults when none exist", async () => {
    mockDB.findOne.mockResolvedValueOnce(null);
    await settingsService.getSettings(1);
    expect(mockDB.create).toHaveBeenCalledWith("recognition_settings", expect.objectContaining({
      points_per_kudos: 10,
      max_kudos_per_day: 5,
    }));
  });

  it("updateSettings — updates existing settings", async () => {
    mockDB.findOne.mockResolvedValue({ id: "s1", organization_id: 1 });
    mockDB.update.mockResolvedValue({ id: "s1", points_per_kudos: 20 });
    const result = await settingsService.updateSettings(1, { points_per_kudos: 20 });
    expect(mockDB.update).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("getCategories — active only", async () => {
    mockDB.findMany.mockResolvedValue({ data: [{ id: "c1", is_active: true }], total: 1, page: 1, limit: 100, totalPages: 1 });
    const result = await settingsService.getCategories(1);
    expect(result).toHaveLength(1);
  });

  it("getCategories — include inactive", async () => {
    mockDB.findMany.mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 });
    await settingsService.getCategories(1, { includeInactive: true });
    expect(mockDB.findMany).toHaveBeenCalledWith("recognition_categories", expect.objectContaining({
      filters: { organization_id: 1 },
    }));
  });

  it("createCategory — auto-increments sort_order", async () => {
    mockDB.findMany.mockResolvedValue({ data: [{ sort_order: 3 }, { sort_order: 5 }], total: 2, page: 1, limit: 100, totalPages: 1 });
    await settingsService.createCategory(1, { name: "Innovation" });
    expect(mockDB.create).toHaveBeenCalledWith("recognition_categories", expect.objectContaining({
      sort_order: 6,
      points_multiplier: 1,
    }));
  });

  it("createCategory — with explicit sort_order", async () => {
    mockDB.findMany.mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 });
    await settingsService.createCategory(1, { name: "Test", sort_order: 99 });
    expect(mockDB.create).toHaveBeenCalledWith("recognition_categories", expect.objectContaining({ sort_order: 99 }));
  });

  it("updateCategory — success", async () => {
    mockDB.findById.mockResolvedValue({ id: "c1", organization_id: 1 });
    mockDB.update.mockResolvedValue({ id: "c1", name: "Updated" });
    const result = await settingsService.updateCategory(1, "c1", { name: "Updated" });
    expect(result.name).toBe("Updated");
  });

  it("updateCategory — not found throws", async () => {
    mockDB.findById.mockResolvedValue(null);
    await expect(settingsService.updateCategory(1, "c1", { name: "x" })).rejects.toThrow();
  });

  it("deleteCategory — soft deletes", async () => {
    mockDB.findById.mockResolvedValue({ id: "c1", organization_id: 1 });
    await settingsService.deleteCategory(1, "c1");
    expect(mockDB.update).toHaveBeenCalledWith("recognition_categories", "c1", { is_active: false });
  });

  it("deleteCategory — not found throws", async () => {
    mockDB.findById.mockResolvedValue(null);
    await expect(settingsService.deleteCategory(1, "c1")).rejects.toThrow();
  });
});

// ===========================================================================
// 7) SLACK SERVICE — formatting functions
// ===========================================================================
describe("Slack Service (mock)", () => {
  let slackService: typeof import("../../services/slack/slack.service");

  beforeEach(async () => {
    slackService = await import("../../services/slack/slack.service");
  });

  // no resetModules — mocks must persist

  it("getSlackConfig — returns config from settings", async () => {
    mockDB.findOne.mockResolvedValueOnce({
      id: "s1",
      organization_id: 1,
      slack_webhook_url: "https://hooks.slack.com/test",
      slack_channel_name: "#kudos",
      slack_notifications_enabled: 1,
      slack_notify_kudos: 1,
      slack_notify_celebrations: 0,
    });
    const result = await slackService.getSlackConfig(1);
    expect(result).toBeDefined();
    expect(result!.slack_webhook_url).toBe("https://hooks.slack.com/test");
    expect(result!.slack_notifications_enabled).toBe(true);
    expect(result!.slack_notify_celebrations).toBe(false);
  });

  it("getSlackConfig — returns null when no settings", async () => {
    mockDB.findOne.mockResolvedValueOnce(null);
    const result = await slackService.getSlackConfig(1);
    expect(result).toBeNull();
  });

  it("updateSlackConfig — creates settings if none exist", async () => {
    mockDB.findOne.mockResolvedValueOnce(null) // first check
      .mockResolvedValueOnce({ id: "s1", organization_id: 1 }) // getSettings creates
      .mockResolvedValueOnce({ id: "s1", slack_webhook_url: "url" }); // getSlackConfig after
    mockDB.create.mockResolvedValue({ id: "s1" }); // create default settings
    await slackService.updateSlackConfig(1, { slack_webhook_url: "https://hooks.slack.com/new" });
    expect(mockDB.update).toHaveBeenCalled();
  });

  it("postToChannel — success", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue("ok") });
    const result = await slackService.postToChannel("https://hooks.slack.com/test", "Hello");
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith("https://hooks.slack.com/test", expect.objectContaining({
      method: "POST",
    }));
  });

  it("postToChannel — with blocks", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue("ok") });
    const result = await slackService.postToChannel("https://hooks.slack.com/test", "Hello", [
      { type: "section", text: { type: "mrkdwn", text: "test" } },
    ]);
    expect(result).toBe(true);
  });

  it("postToChannel — failure returns false", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400, text: vi.fn().mockResolvedValue("error") });
    const result = await slackService.postToChannel("https://hooks.slack.com/test", "Hello");
    expect(result).toBe(false);
  });

  it("postToChannel — network error returns false", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    const result = await slackService.postToChannel("https://hooks.slack.com/test", "Hello");
    expect(result).toBe(false);
  });

  it("formatKudosMessage — with category and points", () => {
    const result = slackService.formatKudosMessage("Alice", "Bob", "Great work!", "Innovation", 50);
    expect(result.text).toContain("Alice");
    expect(result.text).toContain("Bob");
    expect(result.blocks).toBeDefined();
    expect(result.blocks.length).toBeGreaterThan(2); // should have fields section
  });

  it("formatKudosMessage — no category, no points", () => {
    const result = slackService.formatKudosMessage("Alice", "Bob", "Good job", null, 0);
    expect(result.blocks.length).toBe(3); // header + message + context
  });

  it("formatCelebrationMessage — birthday", () => {
    const result = slackService.formatCelebrationMessage("Alice", "birthday", "Happy Birthday!");
    expect(result.text).toContain("Happy Birthday");
    expect(result.blocks).toHaveLength(3);
  });

  it("formatCelebrationMessage — anniversary", () => {
    const result = slackService.formatCelebrationMessage("Bob", "anniversary", "5 years!");
    expect(result.text).toContain("Congratulations");
  });

  it("sendKudosNotification — skips when not configured", async () => {
    mockDB.findOne.mockResolvedValue(null); // no slack config
    await slackService.sendKudosNotification(1, "k-1");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sendKudosNotification — skips when disabled", async () => {
    mockDB.findOne.mockResolvedValue({ slack_notifications_enabled: false, slack_notify_kudos: true, slack_webhook_url: "url" });
    await slackService.sendKudosNotification(1, "k-1");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sendCelebrationNotification — skips when not configured", async () => {
    mockDB.findOne.mockResolvedValue(null);
    await slackService.sendCelebrationNotification(1, "cel-1");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("testWebhook — sends test message", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue("ok") });
    const result = await slackService.testWebhook("https://hooks.slack.com/test");
    expect(result).toBe(true);
  });
});

// ===========================================================================
// 8) TEAMS SERVICE — formatting functions
// ===========================================================================
describe("Teams Service (mock)", () => {
  let teamsService: typeof import("../../services/teams/teams.service");

  beforeEach(async () => {
    teamsService = await import("../../services/teams/teams.service");
  });

  // no resetModules — mocks must persist

  it("getTeamsConfig — returns config", async () => {
    mockDB.findOne.mockResolvedValue({
      id: "s1",
      organization_id: 1,
      teams_webhook_url: "https://teams.webhook.url",
      teams_enabled: 1,
      teams_notify_kudos: 1,
      teams_notify_celebrations: 1,
      teams_notify_milestones: 0,
    });
    const result = await teamsService.getTeamsConfig(1);
    expect(result!.teams_enabled).toBe(true);
    expect(result!.teams_notify_milestones).toBe(false);
  });

  it("getTeamsConfig — returns null when no settings", async () => {
    mockDB.findOne.mockResolvedValue(null);
    const result = await teamsService.getTeamsConfig(1);
    expect(result).toBeNull();
  });

  it("updateTeamsConfig — updates settings", async () => {
    mockDB.findOne
      .mockResolvedValueOnce({ id: "s1" }) // settings found
      .mockResolvedValueOnce({ id: "s1", teams_webhook_url: "url", teams_enabled: true, teams_notify_kudos: true, teams_notify_celebrations: true, teams_notify_milestones: true }); // after update
    await teamsService.updateTeamsConfig(1, { teams_webhook_url: "https://new.url" });
    expect(mockDB.update).toHaveBeenCalled();
  });

  it("sendTeamsNotification — success", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue("") });
    const result = await teamsService.sendTeamsNotification("https://teams.url", {
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      summary: "Test",
      sections: [],
    });
    expect(result).toBe(true);
  });

  it("sendTeamsNotification — failure returns false", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: vi.fn().mockResolvedValue("err") });
    const result = await teamsService.sendTeamsNotification("https://teams.url", {
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      summary: "Test",
      sections: [],
    });
    expect(result).toBe(false);
  });

  it("sendTeamsNotification — network error returns false", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    const result = await teamsService.sendTeamsNotification("https://teams.url", {
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      summary: "Test",
      sections: [],
    });
    expect(result).toBe(false);
  });

  it("formatKudosCard — with category and points", () => {
    const result = teamsService.formatKudosCard("Alice", "Bob", "Great work", "Innovation", 50);
    expect(result["@type"]).toBe("MessageCard");
    expect(result.sections[0].facts).toHaveLength(2);
  });

  it("formatKudosCard — no category, no points", () => {
    const result = teamsService.formatKudosCard("Alice", "Bob", "Good job", null, 0);
    expect(result.sections[0].facts).toHaveLength(0);
  });

  it("formatCelebrationCard — birthday", () => {
    const result = teamsService.formatCelebrationCard("Alice", "birthday", "Happy Birthday!");
    expect(result.themeColor).toBe("EC4899");
  });

  it("formatCelebrationCard — anniversary", () => {
    const result = teamsService.formatCelebrationCard("Bob", "anniversary", "5 years!");
    expect(result.themeColor).toBe("8B5CF6");
  });

  it("formatMilestoneCard — with points", () => {
    const result = teamsService.formatMilestoneCard("Alice", "100 Kudos", "Reached 100 kudos!", 200);
    expect(result.themeColor).toBe("10B981");
    expect(result.sections[0].facts).toHaveLength(1);
  });

  it("formatMilestoneCard — no points, no description", () => {
    const result = teamsService.formatMilestoneCard("Bob", "First Kudos", null, 0);
    expect(result.sections[0].facts).toHaveLength(0);
    expect(result.sections[0].text).toBe("A new milestone has been reached!");
  });

  it("sendKudosToTeams — skips when not configured", async () => {
    mockDB.findOne.mockResolvedValue(null);
    await teamsService.sendKudosToTeams(1, "k-1");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sendKudosToTeams — skips when disabled", async () => {
    mockDB.findOne.mockResolvedValue({ teams_enabled: false, teams_notify_kudos: true, teams_webhook_url: "url" });
    await teamsService.sendKudosToTeams(1, "k-1");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sendCelebrationToTeams — skips when not configured", async () => {
    mockDB.findOne.mockResolvedValue(null);
    await teamsService.sendCelebrationToTeams(1, "cel-1");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sendMilestoneToTeams — skips when not configured", async () => {
    mockDB.findOne.mockResolvedValue(null);
    await teamsService.sendMilestoneToTeams(1, 10, "Test", null, 0);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 9) CELEBRATION SERVICE (mock — skips empcloud DB calls)
// ===========================================================================
describe("Celebration Service (mock)", () => {
  let celebrationService: typeof import("../../services/celebration/celebration.service");

  beforeEach(async () => {
    celebrationService = await import("../../services/celebration/celebration.service");
  });

  // no resetModules — mocks must persist

  it("createCelebration — with metadata", async () => {
    await celebrationService.createCelebration({
      organization_id: 1,
      user_id: 10,
      type: "birthday",
      title: "Happy Birthday!",
      celebration_date: "2025-01-01",
      metadata: { age: 30 },
    });
    expect(mockDB.create).toHaveBeenCalledWith("celebrations", expect.objectContaining({
      type: "birthday",
      metadata: JSON.stringify({ age: 30 }),
    }));
  });

  it("createCelebration — without metadata", async () => {
    await celebrationService.createCelebration({
      organization_id: 1,
      user_id: 10,
      type: "work_anniversary",
      title: "Congrats!",
      celebration_date: "2025-01-01",
    });
    expect(mockDB.create).toHaveBeenCalledWith("celebrations", expect.objectContaining({
      metadata: null,
    }));
  });

  it("getTodayCelebrations — returns celebrations", async () => {
    mockDB.raw.mockResolvedValue([[{ id: "c1", type: "birthday", wish_count: 3 }]]);
    const result = await celebrationService.getTodayCelebrations(1);
    expect(result).toHaveLength(1);
    expect(result[0].wish_count).toBe(3);
  });

  it("getTodayCelebrations — handles null rows", async () => {
    mockDB.raw.mockResolvedValue([null]);
    const result = await celebrationService.getTodayCelebrations(1);
    expect(result).toEqual([]);
  });

  it("getUpcomingCelebrations — returns celebrations", async () => {
    mockDB.raw.mockResolvedValue([[{ id: "c1" }]]);
    const result = await celebrationService.getUpcomingCelebrations(1, 14);
    expect(result).toHaveLength(1);
  });

  it("getCelebrationById — found", async () => {
    mockDB.raw.mockResolvedValue([[{ id: "c1", type: "birthday" }]]);
    const result = await celebrationService.getCelebrationById(1, "c1");
    expect(result.type).toBe("birthday");
  });

  it("getCelebrationById — not found throws", async () => {
    mockDB.raw.mockResolvedValue([[]]);
    await expect(celebrationService.getCelebrationById(1, "c1")).rejects.toThrow();
  });

  it("sendWish — creates wish", async () => {
    mockDB.raw.mockResolvedValue([[{ id: "c1" }]]); // getCelebrationById
    await celebrationService.sendWish(1, "c1", 10, "Happy Birthday!");
    expect(mockDB.create).toHaveBeenCalledWith("celebration_wishes", expect.objectContaining({
      celebration_id: "c1",
      message: "Happy Birthday!",
    }));
  });

  it("getWishes — returns wishes", async () => {
    mockDB.raw
      .mockResolvedValueOnce([[{ id: "c1" }]]) // getCelebrationById
      .mockResolvedValueOnce([[{ id: "w1", message: "Best wishes!" }]]); // wishes
    const result = await celebrationService.getWishes(1, "c1");
    expect(result).toHaveLength(1);
  });

  it("getWishes — handles null rows", async () => {
    mockDB.raw
      .mockResolvedValueOnce([[{ id: "c1" }]]) // getCelebrationById
      .mockResolvedValueOnce([null]); // wishes
    const result = await celebrationService.getWishes(1, "c1");
    expect(result).toEqual([]);
  });

  it("getCelebrationFeed — combines celebrations and kudos", async () => {
    mockDB.raw
      .mockResolvedValueOnce([[{ id: "c1", item_type: "birthday", created_at: "2025-01-01T10:00:00Z" }]])
      .mockResolvedValueOnce([[{ id: "k1", item_type: "kudos", created_at: "2025-01-01T11:00:00Z" }]]);
    const result = await celebrationService.getCelebrationFeed(1, { page: 1, perPage: 20 });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.totalPages).toBe(1);
  });

  it("getCelebrationFeed — empty", async () => {
    mockDB.raw.mockResolvedValue([[]]);
    const result = await celebrationService.getCelebrationFeed(1);
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("generateTodayCelebrations — skips when already generated", async () => {
    mockDB.count.mockResolvedValue(5);
    const result = await celebrationService.generateTodayCelebrations(1);
    expect(result.birthdays).toBe(0);
    expect(result.anniversaries).toBe(0);
  });
});

// ===========================================================================
// 10) LEADERBOARD SERVICE
// ===========================================================================
describe("Leaderboard Service (mock)", () => {
  let leaderboardService: typeof import("../../services/leaderboard/leaderboard.service");

  beforeEach(async () => {
    leaderboardService = await import("../../services/leaderboard/leaderboard.service");
  });

  // no resetModules — mocks must persist

  it("getLeaderboard — returns sorted users", async () => {
    mockDB.raw.mockResolvedValue([[
      { user_id: 10, total_earned: 500, current_balance: 300 },
      { user_id: 20, total_earned: 300, current_balance: 200 },
    ]]);
    const result = await leaderboardService.getLeaderboard(1, {});
    expect(result).toBeDefined();
  });

  it("getLeaderboard — with period filter", async () => {
    mockDB.raw.mockResolvedValue([[]]);
    const result = await leaderboardService.getLeaderboard(1, { period: "monthly" });
    expect(result).toBeDefined();
  });

  it("getLeaderboard — with department filter", async () => {
    mockDB.raw.mockResolvedValue([[]]);
    const result = await leaderboardService.getLeaderboard(1, { departmentId: 5 });
    expect(result).toBeDefined();
  });

  it("getDepartmentLeaderboard — returns department data", async () => {
    mockDB.raw.mockResolvedValue([[
      { department_id: 5, department_name: "Engineering", total_points: 1000 },
    ]]);
    const result = await leaderboardService.getDepartmentLeaderboard(1, {});
    expect(result).toBeDefined();
  });

  it("getMyRank — returns user rank", async () => {
    mockDB.raw.mockResolvedValue([[{ rank: 3, total_earned: 250 }]]);
    const result = await leaderboardService.getMyRank(1, 10, {});
    expect(result).toBeDefined();
  });

  it("refreshLeaderboard — updates leaderboard", async () => {
    mockDB.raw.mockResolvedValue([[]]);
    await leaderboardService.refreshLeaderboard(1);
    expect(mockDB.raw).toHaveBeenCalled();
  });
});

// ===========================================================================
// 11) ANALYTICS SERVICE
// ===========================================================================
describe("Analytics Service (mock)", () => {
  let analyticsService: typeof import("../../services/analytics/analytics.service");

  beforeEach(async () => {
    analyticsService = await import("../../services/analytics/analytics.service");
  });

  // no resetModules — mocks must persist

  it("getOverview — returns aggregated stats", async () => {
    mockDB.raw.mockResolvedValue([[{ count: 10 }]]);
    mockDB.count.mockResolvedValue(100);
    mockDB.sum.mockResolvedValue(5000);
    const result = await analyticsService.getOverview(1);
    expect(result).toBeDefined();
  });

  it("getTrends — returns trend data", async () => {
    mockDB.raw.mockResolvedValue([[
      { date: "2025-01-01", count: 5 },
      { date: "2025-01-02", count: 8 },
    ]]);
    const result = await analyticsService.getTrends(1, {});
    expect(result).toBeDefined();
  });

  it("getTopRecognizers — returns top senders", async () => {
    mockDB.raw.mockResolvedValue([[
      { user_id: 10, count: 20, first_name: "Alice" },
    ]]);
    const result = await analyticsService.getTopRecognizers(1);
    expect(result).toBeDefined();
  });

  it("getTopRecognized — returns top receivers", async () => {
    mockDB.raw.mockResolvedValue([[
      { user_id: 20, count: 15, first_name: "Bob" },
    ]]);
    const result = await analyticsService.getTopRecognized(1);
    expect(result).toBeDefined();
  });

  it("getCategoryBreakdown — returns category stats", async () => {
    mockDB.raw.mockResolvedValue([[
      { category_id: "c1", category_name: "Innovation", count: 10 },
    ]]);
    const result = await analyticsService.getCategoryBreakdown(1);
    expect(result).toBeDefined();
  });

  it("getDepartmentParticipation — returns department stats", async () => {
    mockDB.raw.mockResolvedValue([[
      { department_id: 5, department_name: "Engineering", count: 50 },
    ]]);
    const result = await analyticsService.getDepartmentParticipation(1);
    expect(result).toBeDefined();
  });

  it("getBudgetUtilization — returns budget stats", async () => {
    mockDB.raw.mockResolvedValue([[
      { id: "b1", total_amount: 1000, spent_amount: 300 },
    ]]);
    const result = await analyticsService.getBudgetUtilization(1);
    expect(result).toBeDefined();
  });

  it("getManagerDashboard — returns manager data", async () => {
    mockDB.raw.mockResolvedValue([[{ count: 5 }]]);
    const result = await analyticsService.getManagerDashboard(1, 10);
    expect(result).toBeDefined();
  });

  it("getManagerComparison — returns comparison data", async () => {
    mockDB.raw.mockResolvedValue([[{ manager_id: 10, count: 20 }]]);
    const result = await analyticsService.getManagerComparison(1);
    expect(result).toBeDefined();
  });
});

// ===========================================================================
// 12) SLASH COMMAND SERVICE
// ===========================================================================
describe("Slash Command Service (mock)", () => {
  let slashService: typeof import("../../services/slack/slash-command.service");

  beforeEach(async () => {
    slashService = await import("../../services/slack/slash-command.service");
  });

  // no resetModules — mocks must persist

  const basePayload = {
    token: "t",
    team_id: "T123",
    team_domain: "test",
    channel_id: "C123",
    channel_name: "general",
    user_id: "U123",
    user_name: "alice",
    command: "/kudos",
    text: "",
    response_url: "https://hooks.slack.com/response",
    trigger_id: "123",
  };

  it("handleSlashCommand — empty text returns usage", async () => {
    const result = await slashService.handleSlashCommand(1, { ...basePayload, text: "" });
    expect(result.response_type).toBe("ephemeral");
    expect(result.text).toContain("Usage");
  });

  it("handleSlashCommand — unparseable text returns error", async () => {
    const result = await slashService.handleSlashCommand(1, { ...basePayload, text: "nospace" });
    expect(result.response_type).toBe("ephemeral");
    expect(result.text).toContain("Could not parse");
  });

  it("handleSlashCommand — no message after mention", async () => {
    const result = await slashService.handleSlashCommand(1, { ...basePayload, text: "@bob " });
    expect(result.response_type).toBe("ephemeral");
  });
});

// ===========================================================================
// 13) KUDOS SERVICE — uncovered paths
// ===========================================================================
describe("Kudos Service (mock)", () => {
  let kudosService: typeof import("../../services/kudos/kudos.service");

  beforeEach(async () => {
    kudosService = await import("../../services/kudos/kudos.service");
  });

  // no resetModules — mocks must persist

  it("addReaction — adds reaction to kudos via raw INSERT", async () => {
    mockDB.findById.mockResolvedValueOnce({ id: "k1", organization_id: 1 }); // kudos
    await kudosService.addReaction(1, "k1", 10, "thumbsup");
    expect(mockDB.raw).toHaveBeenCalled(); // uses INSERT IGNORE
  });

  it("removeReaction — removes existing reaction via deleteMany", async () => {
    await kudosService.removeReaction(1, "k1", 10, "thumbsup");
    expect(mockDB.deleteMany).toHaveBeenCalledWith("kudos_reactions", expect.objectContaining({
      kudos_id: "k1",
      user_id: 10,
      reaction_type: "thumbsup",
    }));
  });

  it("addComment — adds comment to kudos", async () => {
    mockDB.findById.mockResolvedValueOnce({ id: "k1", organization_id: 1 }); // kudos
    await kudosService.addComment(1, "k1", 10, "Great job!");
    expect(mockDB.create).toHaveBeenCalled();
  });

  it("deleteComment — deletes own comment", async () => {
    mockDB.findById.mockResolvedValueOnce({ id: "cm1", user_id: 10 }); // comment
    await kudosService.deleteComment("cm1", 10);
    expect(mockDB.delete).toHaveBeenCalledWith("kudos_comments", "cm1");
  });

  it("deleteComment — not found throws", async () => {
    mockDB.findById.mockResolvedValueOnce(null);
    await expect(kudosService.deleteComment("cm1", 10)).rejects.toThrow();
  });

  it("deleteComment — wrong user throws", async () => {
    mockDB.findById.mockResolvedValueOnce({ id: "cm1", user_id: 20 });
    await expect(kudosService.deleteComment("cm1", 10)).rejects.toThrow();
  });

  it("deleteKudos — success", async () => {
    mockDB.findById.mockResolvedValueOnce({ id: "k1", organization_id: 1, sender_id: 10 });
    await kudosService.deleteKudos(1, "k1", 10);
    expect(mockDB.delete).toHaveBeenCalled();
  });

  it("deleteKudos — not found", async () => {
    mockDB.findById.mockResolvedValueOnce(null);
    await expect(kudosService.deleteKudos(1, "k1", 10)).rejects.toThrow();
  });

  it("getReceivedKudos — returns paginated results", async () => {
    mockDB.raw.mockResolvedValueOnce([[{ id: "k1" }]]).mockResolvedValueOnce([[{ total: 1 }]]);
    const result = await kudosService.getReceivedKudos(1, 10, {});
    expect(result).toBeDefined();
  });

  it("getSentKudos — returns paginated results", async () => {
    mockDB.raw.mockResolvedValueOnce([[{ id: "k1" }]]).mockResolvedValueOnce([[{ total: 1 }]]);
    const result = await kudosService.getSentKudos(1, 10, {});
    expect(result).toBeDefined();
  });

  it("getPublicFeed — returns paginated results", async () => {
    mockDB.raw.mockResolvedValueOnce([[{ id: "k1" }]]).mockResolvedValueOnce([[{ total: 1 }]]);
    const result = await kudosService.getPublicFeed(1, {});
    expect(result).toBeDefined();
  });
});

// ===========================================================================
// 14) REWARD SERVICE — uncovered paths
// ===========================================================================
describe("Reward Service (mock)", () => {
  let rewardService: typeof import("../../services/reward/reward.service");

  beforeEach(async () => {
    rewardService = await import("../../services/reward/reward.service");
  });

  // no resetModules — mocks must persist

  it("createReward — creates reward catalog item", async () => {
    await rewardService.createReward(1, {
      name: "Gift Card",
      description: "Amazon $50",
      points_cost: 500,
      category: "gift_cards",
    } as any);
    expect(mockDB.create).toHaveBeenCalledWith("reward_catalog", expect.objectContaining({
      name: "Gift Card",
    }));
  });

  it("listRewards — with filters", async () => {
    mockDB.findMany.mockResolvedValueOnce({ data: [{ id: "r1" }], total: 1, page: 1, limit: 20, totalPages: 1 });
    const result = await rewardService.listRewards(1, { category: "gift_cards" });
    expect(result).toBeDefined();
  });

  it("getReward — found", async () => {
    mockDB.findOne.mockResolvedValueOnce({ id: "r1", organization_id: 1, name: "Gift Card" });
    const result = await rewardService.getReward(1, "r1");
    expect(result.name).toBe("Gift Card");
  });

  it("getReward — not found", async () => {
    mockDB.findOne.mockResolvedValueOnce(null);
    await expect(rewardService.getReward(1, "r1")).rejects.toThrow();
  });

  it("updateReward — success", async () => {
    mockDB.findOne.mockResolvedValueOnce({ id: "r1", organization_id: 1 });
    mockDB.update.mockResolvedValueOnce({ id: "r1", name: "Updated" });
    const result = await rewardService.updateReward(1, "r1", { name: "Updated" } as any);
    expect(result.name).toBe("Updated");
  });

  it("deleteReward — success", async () => {
    mockDB.findOne.mockResolvedValueOnce({ id: "r1", organization_id: 1 });
    await rewardService.deleteReward(1, "r1");
    expect(mockDB.update).toHaveBeenCalled(); // soft delete
  });

  it("redeemReward — success", async () => {
    mockDB.findOne
      .mockResolvedValueOnce({ id: "r1", organization_id: 1, points_cost: 100, quantity_available: 5, is_active: true }) // reward
      .mockResolvedValueOnce({ id: "b1", current_balance: 500, total_redeemed: 100 }); // balance
    await rewardService.redeemReward(1, 10, "r1");
    expect(mockDB.create).toHaveBeenCalled();
  });

  it("redeemReward — insufficient points", async () => {
    mockDB.findOne
      .mockResolvedValueOnce({ id: "r1", organization_id: 1, points_cost: 1000, quantity_available: 5, is_active: true })
      .mockResolvedValueOnce({ id: "b1", current_balance: 50, total_redeemed: 0 });
    await expect(rewardService.redeemReward(1, 10, "r1")).rejects.toThrow();
  });

  it("redeemReward — out of stock", async () => {
    mockDB.findOne.mockResolvedValueOnce({ id: "r1", organization_id: 1, points_cost: 100, quantity_available: 0, is_active: true });
    await expect(rewardService.redeemReward(1, 10, "r1")).rejects.toThrow();
  });

  it("redeemReward — inactive reward", async () => {
    mockDB.findOne.mockResolvedValueOnce({ id: "r1", organization_id: 1, points_cost: 100, is_active: false });
    await expect(rewardService.redeemReward(1, 10, "r1")).rejects.toThrow();
  });

  it("redeemReward — reward not found", async () => {
    mockDB.findOne.mockResolvedValueOnce(null);
    await expect(rewardService.redeemReward(1, 10, "r1")).rejects.toThrow();
  });
});

// ===========================================================================
// 15) AUTH SERVICE
// ===========================================================================
describe("Auth Service (mock)", () => {
  let authService: typeof import("../../services/auth/auth.service");
  let empcloudMock: any;

  beforeEach(async () => {
    empcloudMock = await import("../../db/empcloud");
    authService = await import("../../services/auth/auth.service");
  });

  // no resetModules — mocks must persist

  it("login — success", async () => {
    mockBcryptCompare.mockResolvedValueOnce(true);
    (empcloudMock.findUserByEmail as any).mockResolvedValueOnce({
      id: 1, email: "test@test.com", password: "$2a$12$hash", organization_id: 1,
      role: "hr_admin", first_name: "Test", last_name: "User", status: 1,
    });
    (empcloudMock.findOrgById as any).mockResolvedValueOnce({ id: 1, name: "TestOrg", is_active: true });
    const result = await authService.login("test@test.com", "password123");
    expect(result.user.email).toBe("test@test.com");
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toBeDefined();
  });

  it("login — user not found", async () => {
    (empcloudMock.findUserByEmail as any).mockResolvedValueOnce(null);
    await expect(authService.login("bad@test.com", "pass")).rejects.toThrow("Invalid email");
  });

  it("login — no password set", async () => {
    (empcloudMock.findUserByEmail as any).mockResolvedValueOnce({
      id: 1, email: "test@test.com", password: null, organization_id: 1,
    });
    await expect(authService.login("test@test.com", "pass")).rejects.toThrow("Password not set");
  });

  it("login — wrong password", async () => {
    mockBcryptCompare.mockResolvedValueOnce(false);
    (empcloudMock.findUserByEmail as any).mockResolvedValueOnce({
      id: 1, email: "test@test.com", password: "$2a$12$hash", organization_id: 1,
    });
    await expect(authService.login("test@test.com", "wrong")).rejects.toThrow("Invalid email");
  });

  it("login — inactive org", async () => {
    mockBcryptCompare.mockResolvedValueOnce(true);
    (empcloudMock.findUserByEmail as any).mockResolvedValueOnce({
      id: 1, email: "test@test.com", password: "$2a$12$hash", organization_id: 1,
      role: "hr_admin", first_name: "Test", last_name: "User",
    });
    (empcloudMock.findOrgById as any).mockResolvedValueOnce({ id: 1, name: "TestOrg", is_active: false });
    await expect(authService.login("test@test.com", "pass")).rejects.toThrow("inactive");
  });

  it("login — org not found", async () => {
    mockBcryptCompare.mockResolvedValueOnce(true);
    (empcloudMock.findUserByEmail as any).mockResolvedValueOnce({
      id: 1, email: "test@test.com", password: "$2a$12$hash", organization_id: 1,
      role: "hr_admin", first_name: "Test", last_name: "User",
    });
    (empcloudMock.findOrgById as any).mockResolvedValueOnce(null);
    await expect(authService.login("test@test.com", "pass")).rejects.toThrow("inactive");
  });

  it("register — success", async () => {
    (empcloudMock.findUserByEmail as any).mockResolvedValueOnce(null);
    (empcloudMock.createOrganization as any).mockResolvedValueOnce({ id: 1, name: "NewOrg" });
    (empcloudMock.createUser as any).mockResolvedValueOnce({
      id: 1, email: "new@test.com", first_name: "New", last_name: "User",
      role: "hr_admin", organization_id: 1,
    });
    const result = await authService.register({
      orgName: "NewOrg", firstName: "New", lastName: "User",
      email: "new@test.com", password: "pass123",
    });
    expect(result.user.email).toBe("new@test.com");
    expect(result.tokens.accessToken).toBeDefined();
  });

  it("register — duplicate email", async () => {
    (empcloudMock.findUserByEmail as any).mockResolvedValueOnce({ id: 1, email: "dup@test.com" });
    await expect(authService.register({
      orgName: "Org", firstName: "A", lastName: "B",
      email: "dup@test.com", password: "pass",
    })).rejects.toThrow("already exists");
  });

  it("register — with country", async () => {
    (empcloudMock.findUserByEmail as any).mockResolvedValueOnce(null);
    (empcloudMock.createOrganization as any).mockResolvedValueOnce({ id: 2, name: "USOrg" });
    (empcloudMock.createUser as any).mockResolvedValueOnce({
      id: 2, email: "us@test.com", first_name: "US", last_name: "User",
      role: "hr_admin", organization_id: 2,
    });
    const result = await authService.register({
      orgName: "USOrg", firstName: "US", lastName: "User",
      email: "us@test.com", password: "pass", country: "US",
    });
    expect(result.user.orgName).toBe("USOrg");
  });

  it("ssoLogin — invalid token (decode returns null)", async () => {
    mockJwtDecode.mockReturnValueOnce(null);
    await expect(authService.ssoLogin("invalid-token")).rejects.toThrow("Invalid SSO");
  });

  it("ssoLogin — invalid token (decode returns string)", async () => {
    mockJwtDecode.mockReturnValueOnce("just-a-string");
    await expect(authService.ssoLogin("string-token")).rejects.toThrow("Invalid SSO");
  });

  it("ssoLogin — missing user id in token", async () => {
    mockJwtDecode.mockReturnValueOnce({ sub: undefined });
    await expect(authService.ssoLogin("token-no-sub")).rejects.toThrow("missing user");
  });

  it("ssoLogin — user not found", async () => {
    mockJwtDecode.mockReturnValueOnce({ sub: "999" });
    (empcloudMock.findUserById as any).mockResolvedValueOnce(null);
    await expect(authService.ssoLogin("token")).rejects.toThrow("not found");
  });

  it("ssoLogin — inactive user", async () => {
    mockJwtDecode.mockReturnValueOnce({ sub: "1" });
    (empcloudMock.findUserById as any).mockResolvedValueOnce({ id: 1, status: 0, organization_id: 1 });
    await expect(authService.ssoLogin("token")).rejects.toThrow("not found or inactive");
  });

  it("ssoLogin — success", async () => {
    mockJwtDecode.mockReturnValueOnce({ sub: "1" });
    (empcloudMock.findUserById as any).mockResolvedValueOnce({
      id: 1, email: "sso@test.com", first_name: "SSO", last_name: "User",
      role: "employee", organization_id: 1, status: 1,
    });
    (empcloudMock.findOrgById as any).mockResolvedValueOnce({ id: 1, name: "TestOrg", is_active: true });
    const result = await authService.ssoLogin("valid-token");
    expect(result.user.email).toBe("sso@test.com");
  });

  it("ssoLogin — inactive org", async () => {
    mockJwtDecode.mockReturnValueOnce({ sub: "1" });
    (empcloudMock.findUserById as any).mockResolvedValueOnce({
      id: 1, email: "sso@test.com", status: 1, organization_id: 1,
    });
    (empcloudMock.findOrgById as any).mockResolvedValueOnce({ id: 1, is_active: false });
    await expect(authService.ssoLogin("token")).rejects.toThrow("inactive");
  });

  it("refreshToken — success", async () => {
    mockJwtVerify.mockReturnValueOnce({ userId: 1, type: "refresh" });
    (empcloudMock.findUserById as any).mockResolvedValueOnce({
      id: 1, email: "test@test.com", first_name: "Test", last_name: "User",
      role: "hr_admin", organization_id: 1, status: 1,
    });
    (empcloudMock.findOrgById as any).mockResolvedValueOnce({ id: 1, name: "TestOrg", is_active: true });
    const result = await authService.refreshToken("valid-refresh-token");
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it("refreshToken — invalid token", async () => {
    mockJwtVerify.mockImplementationOnce(() => { throw new Error("invalid"); });
    await expect(authService.refreshToken("bad-token")).rejects.toThrow("Invalid or expired");
  });

  it("refreshToken — wrong token type", async () => {
    mockJwtVerify.mockReturnValueOnce({ userId: 1, type: "access" });
    await expect(authService.refreshToken("not-refresh")).rejects.toThrow("Invalid token type");
  });

  it("refreshToken — user not found", async () => {
    mockJwtVerify.mockReturnValueOnce({ userId: 999, type: "refresh" });
    (empcloudMock.findUserById as any).mockResolvedValueOnce(null);
    await expect(authService.refreshToken("token")).rejects.toThrow("not found");
  });

  it("refreshToken — inactive user", async () => {
    mockJwtVerify.mockReturnValueOnce({ userId: 1, type: "refresh" });
    (empcloudMock.findUserById as any).mockResolvedValueOnce({ id: 1, status: 0, organization_id: 1 });
    await expect(authService.refreshToken("token")).rejects.toThrow("not found");
  });

  it("refreshToken — inactive org", async () => {
    mockJwtVerify.mockReturnValueOnce({ userId: 1, type: "refresh" });
    (empcloudMock.findUserById as any).mockResolvedValueOnce({
      id: 1, email: "test@test.com", status: 1, organization_id: 1,
    });
    (empcloudMock.findOrgById as any).mockResolvedValueOnce({ id: 1, is_active: false });
    await expect(authService.refreshToken("token")).rejects.toThrow("inactive");
  });
});
