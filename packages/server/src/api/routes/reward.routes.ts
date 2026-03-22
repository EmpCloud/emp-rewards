// ============================================================================
// REWARD CATALOG ROUTES
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import * as rewardService from "../../services/reward/reward.service";
import {
  createRewardSchema,
  redeemRewardSchema,
  paginationSchema,
  idParamSchema,
} from "@emp-rewards/shared";
import { ValidationError } from "../../utils/errors";
import type { ApiResponse } from "@emp-rewards/shared";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET / — List reward catalog (all users)
// ---------------------------------------------------------------------------
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const pagination = paginationSchema.parse(req.query);
    const category = req.query.category as string | undefined;
    const is_active = req.query.is_active === "false" ? false : true;

    const result = await rewardService.listRewards(orgId, {
      page: pagination.page,
      perPage: pagination.perPage,
      category,
      is_active,
      sort: pagination.sort,
      order: pagination.order,
    });

    const response: ApiResponse<typeof result> = { success: true, data: result };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST / — Create reward (admin only)
// ---------------------------------------------------------------------------
router.post(
  "/",
  authorize("org_admin", "hr_admin", "super_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const parsed = createRewardSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Invalid reward data", {
          validation: parsed.error.errors.map((e) => e.message),
        });
      }

      const reward = await rewardService.createReward(orgId, parsed.data);
      const response: ApiResponse<typeof reward> = { success: true, data: reward };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:id — Get single reward
// ---------------------------------------------------------------------------
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const { id } = idParamSchema.parse(req.params);

    const reward = await rewardService.getReward(orgId, id);
    const response: ApiResponse<typeof reward> = { success: true, data: reward };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /:id — Update reward (admin only)
// ---------------------------------------------------------------------------
router.put(
  "/:id",
  authorize("org_admin", "hr_admin", "super_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const { id } = idParamSchema.parse(req.params);
      const parsed = createRewardSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Invalid reward data", {
          validation: parsed.error.errors.map((e) => e.message),
        });
      }

      const reward = await rewardService.updateReward(orgId, id, parsed.data);
      const response: ApiResponse<typeof reward> = { success: true, data: reward };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:id — Soft-delete reward (admin only)
// ---------------------------------------------------------------------------
router.delete(
  "/:id",
  authorize("org_admin", "hr_admin", "super_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const { id } = idParamSchema.parse(req.params);

      const reward = await rewardService.deleteReward(orgId, id);
      const response: ApiResponse<typeof reward> = { success: true, data: reward };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:id/redeem — Redeem a reward
// ---------------------------------------------------------------------------
router.post(
  "/:id/redeem",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const userId = req.user!.empcloudUserId;
      const { id } = idParamSchema.parse(req.params);

      const redemption = await rewardService.redeemReward(orgId, userId, id);
      const response: ApiResponse<typeof redemption> = {
        success: true,
        data: redemption,
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  },
);

export { router as rewardRoutes };
