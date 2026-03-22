// ============================================================================
// REDEMPTION ROUTES
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import * as redemptionService from "../../services/redemption/redemption.service";
import { paginationSchema, idParamSchema, reviewRedemptionSchema } from "@emp-rewards/shared";
import { ValidationError } from "../../utils/errors";
import type { ApiResponse } from "@emp-rewards/shared";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /my — Current user's redemptions
// ---------------------------------------------------------------------------
router.get("/my", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const userId = req.user!.empcloudUserId;
    const pagination = paginationSchema.parse(req.query);
    const status = req.query.status as string | undefined;

    const result = await redemptionService.getMyRedemptions(orgId, userId, {
      page: pagination.page,
      perPage: pagination.perPage,
      status,
    });

    const response: ApiResponse<typeof result> = { success: true, data: result };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET / — Admin list of all redemptions
// ---------------------------------------------------------------------------
router.get(
  "/",
  authorize("org_admin", "hr_admin", "hr_manager", "super_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const pagination = paginationSchema.parse(req.query);
      const status = req.query.status as string | undefined;
      const userId = req.query.userId ? Number(req.query.userId) : undefined;

      const result = await redemptionService.listRedemptions(orgId, {
        page: pagination.page,
        perPage: pagination.perPage,
        status,
        userId,
        sort: pagination.sort,
        order: pagination.order,
      });

      const response: ApiResponse<typeof result> = { success: true, data: result };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:id — Get single redemption
// ---------------------------------------------------------------------------
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const { id } = idParamSchema.parse(req.params);

    const redemption = await redemptionService.getRedemption(orgId, id);
    const response: ApiResponse<typeof redemption> = { success: true, data: redemption };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /:id/approve — Approve redemption (admin)
// ---------------------------------------------------------------------------
router.put(
  "/:id/approve",
  authorize("org_admin", "hr_admin", "hr_manager", "super_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const approvedBy = req.user!.empcloudUserId;
      const { id } = idParamSchema.parse(req.params);

      const redemption = await redemptionService.approveRedemption(orgId, id, approvedBy);
      const response: ApiResponse<typeof redemption> = { success: true, data: redemption };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /:id/reject — Reject redemption (admin)
// ---------------------------------------------------------------------------
router.put(
  "/:id/reject",
  authorize("org_admin", "hr_admin", "hr_manager", "super_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const rejectedBy = req.user!.empcloudUserId;
      const { id } = idParamSchema.parse(req.params);
      const reason = req.body.reason as string | undefined;

      const redemption = await redemptionService.rejectRedemption(
        orgId,
        id,
        rejectedBy,
        reason,
      );
      const response: ApiResponse<typeof redemption> = { success: true, data: redemption };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /:id/fulfill — Fulfill redemption (admin)
// ---------------------------------------------------------------------------
router.put(
  "/:id/fulfill",
  authorize("org_admin", "hr_admin", "hr_manager", "super_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const { id } = idParamSchema.parse(req.params);
      const notes = req.body.notes as string | undefined;

      const redemption = await redemptionService.fulfillRedemption(orgId, id, notes);
      const response: ApiResponse<typeof redemption> = { success: true, data: redemption };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /:id/cancel — Cancel own redemption
// ---------------------------------------------------------------------------
router.put(
  "/:id/cancel",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const userId = req.user!.empcloudUserId;
      const { id } = idParamSchema.parse(req.params);

      const redemption = await redemptionService.cancelRedemption(orgId, id, userId);
      const response: ApiResponse<typeof redemption> = { success: true, data: redemption };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

export { router as redemptionRoutes };
