/**
 * EMP Rewards — Infrastructure coverage tests.
 * Error classes, response helpers.
 */
import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Error Classes
// ---------------------------------------------------------------------------
import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from "../utils/errors";

describe("Error classes", () => {
  describe("AppError", () => {
    it("sets all properties", () => {
      const err = new AppError(500, "SERVER", "Broke");
      expect(err).toBeInstanceOf(Error);
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe("SERVER");
      expect(err.message).toBe("Broke");
      expect(err.name).toBe("AppError");
    });

    it("stores details", () => {
      expect(new AppError(400, "X", "Y", { a: ["b"] }).details).toEqual({ a: ["b"] });
    });

    it("details undefined when omitted", () => {
      expect(new AppError(400, "X", "Y").details).toBeUndefined();
    });
  });

  describe("NotFoundError", () => {
    it("with id", () => {
      const err = new NotFoundError("Award", "7");
      expect(err.statusCode).toBe(404);
      expect(err.message).toContain("Award");
      expect(err.message).toContain("7");
    });

    it("without id", () => {
      expect(new NotFoundError("Nomination").message).toBe("Nomination not found");
    });
  });

  describe("ValidationError", () => {
    it("creates 400", () => {
      expect(new ValidationError("Bad").statusCode).toBe(400);
      expect(new ValidationError("Bad").code).toBe("VALIDATION_ERROR");
    });
  });

  describe("UnauthorizedError", () => {
    it("defaults to Unauthorized", () => {
      expect(new UnauthorizedError().statusCode).toBe(401);
      expect(new UnauthorizedError().message).toBe("Unauthorized");
    });
  });

  describe("ForbiddenError", () => {
    it("creates 403", () => {
      expect(new ForbiddenError().statusCode).toBe(403);
    });
  });

  describe("ConflictError", () => {
    it("creates 409", () => {
      expect(new ConflictError("Dup").statusCode).toBe(409);
    });
  });
});

// ---------------------------------------------------------------------------
// Response Helpers
// ---------------------------------------------------------------------------
import { sendSuccess, sendError, sendPaginated } from "../utils/response";

function mockRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
}

describe("Response helpers", () => {
  it("sendSuccess default 200", () => {
    const res = mockRes();
    sendSuccess(res, { points: 100 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { points: 100 } });
  });

  it("sendError sends error", () => {
    const res = mockRes();
    sendError(res, 403, "FORBIDDEN", "No access");
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: "FORBIDDEN", message: "No access" },
    });
  });

  it("sendPaginated with meta", () => {
    const res = mockRes();
    sendPaginated(res, [1], 50, 3, 10);
    const body = res.json.mock.calls[0][0];
    expect(body.data.totalPages).toBe(5);
  });
});
