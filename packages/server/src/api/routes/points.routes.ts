// ============================================================================
// POINTS ROUTES
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { sendSuccess, sendPaginated } from "../../utils/response";
import { adjustPointsSchema, paginationSchema } from "@emp-rewards/shared";
import * as pointsService from "../../services/points/points.service";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /balance — Get current user's point balance
// ---------------------------------------------------------------------------
router.get("/balance", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const userId = req.user!.empcloudUserId;
    const balance = await pointsService.getBalance(orgId, userId);
    return sendSuccess(res, balance);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /transactions — Get current user's point transactions
// ---------------------------------------------------------------------------
router.get("/transactions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const userId = req.user!.empcloudUserId;
    const params = paginationSchema.parse(req.query);
    const result = await pointsService.getTransactions(orgId, userId, {
      page: params.page,
      perPage: params.perPage,
    });
    return sendPaginated(res, result.data, result.total, result.page, result.limit);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /adjust — Admin manual adjustment
// ---------------------------------------------------------------------------
router.post(
  "/adjust",
  authorize("super_admin", "org_admin", "hr_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const data = adjustPointsSchema.parse(req.body);
      const txn = await pointsService.adjustPoints(
        orgId,
        data.user_id,
        data.amount,
        data.description || null,
      );
      return sendSuccess(res, txn, 201);
    } catch (err) {
      next(err);
    }
  },
);

export { router as pointsRoutes };
