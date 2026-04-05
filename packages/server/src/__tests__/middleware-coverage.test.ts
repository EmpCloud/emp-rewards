// =============================================================================
// EMP REWARDS — Middleware, Error, Rate Limit, Errors, Response Unit Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../config", () => ({
  config: { jwt: { secret: "rewards-test-secret" } },
}));
vi.mock("@emp-rewards/shared", () => ({ default: {} }));

import { authenticate, authorize, AuthPayload } from "../api/middleware/auth.middleware";
import { errorHandler } from "../api/middleware/error.middleware";
import { rateLimit } from "../api/middleware/rate-limit.middleware";
import { AppError, NotFoundError, ValidationError, UnauthorizedError, ForbiddenError, ConflictError } from "../utils/errors";
import { sendSuccess, sendError, sendPaginated } from "../utils/response";

function mockReq(overrides: any = {}): any {
  return { headers: {}, params: {}, query: {}, body: {}, ip: "127.0.0.1", ...overrides };
}
function mockRes(): any {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
}

// =============================================================================
// Auth Middleware
// =============================================================================
describe("Rewards Auth Middleware", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("authenticate()", () => {
    it("rejects missing auth", () => {
      const next = vi.fn();
      authenticate(mockReq(), mockRes(), next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it("internal service bypass", () => {
      const orig = process.env.INTERNAL_SERVICE_SECRET;
      process.env.INTERNAL_SERVICE_SECRET = "rew-sec";
      const req = mockReq({
        headers: { "x-internal-service": "empcloud-dashboard", "x-internal-secret": "rew-sec" },
        query: { organization_id: "9" },
      });
      const next = vi.fn();
      authenticate(req, mockRes(), next);
      expect(next).toHaveBeenCalledWith();
      expect(req.user.empcloudOrgId).toBe(9);
      expect(req.user.rewardsProfileId).toBeNull();
      process.env.INTERNAL_SERVICE_SECRET = orig;
    });

    it("authenticates valid JWT", () => {
      const payload: AuthPayload = {
        empcloudUserId: 10, empcloudOrgId: 2, rewardsProfileId: "r-1",
        role: "employee", email: "e@t.com", firstName: "E", lastName: "M", orgName: "T",
      };
      const token = jwt.sign(payload, "rewards-test-secret");
      const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
      const next = vi.fn();
      authenticate(req, mockRes(), next);
      expect(next).toHaveBeenCalledWith();
      expect(req.user.empcloudUserId).toBe(10);
    });

    it("rejects expired token", () => {
      const token = jwt.sign({ sub: "1" }, "rewards-test-secret", { expiresIn: "-1s" });
      const next = vi.fn();
      authenticate(mockReq({ headers: { authorization: `Bearer ${token}` } }), mockRes(), next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: "TOKEN_EXPIRED" }));
    });

    it("rejects invalid token", () => {
      const next = vi.fn();
      authenticate(mockReq({ headers: { authorization: "Bearer garbage" } }), mockRes(), next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: "INVALID_TOKEN" }));
    });
  });

  describe("authorize()", () => {
    it("rejects unauthenticated", () => {
      const next = vi.fn();
      authorize("hr_admin")(mockReq(), mockRes(), next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it("rejects wrong role", () => {
      const next = vi.fn();
      authorize("org_admin")(mockReq({ user: { role: "employee" } }), mockRes(), next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });

    it("allows matching role", () => {
      const next = vi.fn();
      authorize("employee")(mockReq({ user: { role: "employee" } }), mockRes(), next);
      expect(next).toHaveBeenCalledWith();
    });

    it("allows any auth when no roles", () => {
      const next = vi.fn();
      authorize()(mockReq({ user: { role: "employee" } }), mockRes(), next);
      expect(next).toHaveBeenCalledWith();
    });
  });
});

// =============================================================================
// Error Handler
// =============================================================================
describe("Rewards Error Handler", () => {
  it("handles AppError", () => {
    const res = mockRes();
    errorHandler(new AppError(422, "V", "bad"), mockReq(), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(422);
  });

  it("handles ZodError as 400", () => {
    const err = new ZodError([{ code: "invalid_type", expected: "string", received: "number", path: ["x"], message: "bad" }]);
    const res = mockRes();
    errorHandler(err, mockReq(), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("handles unknown error as 500", () => {
    const res = mockRes();
    errorHandler(new Error("boom"), mockReq(), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// =============================================================================
// Rate Limit
// =============================================================================
describe("Rewards Rate Limit", () => {
  it("skips when disabled", () => {
    const orig = process.env.RATE_LIMIT_DISABLED;
    process.env.RATE_LIMIT_DISABLED = "true";
    const next = vi.fn();
    rateLimit({ windowMs: 1000, max: 1 })(mockReq({ ip: "rew-skip" }), mockRes(), next);
    expect(next).toHaveBeenCalled();
    process.env.RATE_LIMIT_DISABLED = orig;
  });

  it("blocks over limit", () => {
    const orig = process.env.RATE_LIMIT_DISABLED;
    delete process.env.RATE_LIMIT_DISABLED;
    const limiter = rateLimit({ windowMs: 60000, max: 1 });
    const ip = `rew-block-${Date.now()}`;
    limiter(mockReq({ ip }), mockRes(), vi.fn());
    const res = mockRes();
    limiter(mockReq({ ip }), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(429);
    process.env.RATE_LIMIT_DISABLED = orig;
  });
});

// =============================================================================
// Error Classes
// =============================================================================
describe("Rewards Error Classes", () => {
  it("AppError", () => {
    const e = new AppError(400, "X", "m", { f: ["r"] });
    expect(e.statusCode).toBe(400);
    expect(e.details).toEqual({ f: ["r"] });
  });
  it("NotFoundError", () => { expect(new NotFoundError("Badge").message).toContain("Badge"); });
  it("NotFoundError with id", () => { expect(new NotFoundError("Badge", "b1").message).toContain("b1"); });
  it("ValidationError", () => { expect(new ValidationError("bad").statusCode).toBe(400); });
  it("UnauthorizedError", () => { expect(new UnauthorizedError().statusCode).toBe(401); });
  it("ForbiddenError", () => { expect(new ForbiddenError().statusCode).toBe(403); });
  it("ConflictError", () => { expect(new ConflictError("dup").statusCode).toBe(409); });
});

// =============================================================================
// Response Helpers
// =============================================================================
describe("Rewards Response Helpers", () => {
  it("sendSuccess", () => {
    const res = mockRes();
    sendSuccess(res, { ok: true });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it("sendError", () => {
    const res = mockRes();
    sendError(res, 403, "FORBIDDEN", "no");
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("sendPaginated", () => {
    const res = mockRes();
    sendPaginated(res, [1], 10, 1, 5);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ totalPages: 2 }),
    }));
  });
});
