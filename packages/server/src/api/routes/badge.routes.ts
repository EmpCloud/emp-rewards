// ============================================================================
// BADGE ROUTES
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { sendSuccess } from "../../utils/response";
import { createBadgeSchema, awardBadgeSchema } from "@emp-rewards/shared";
import * as badgeService from "../../services/badge/badge.service";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET / — List all active badges
// ---------------------------------------------------------------------------
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const badges = await badgeService.listBadges(orgId);
    return sendSuccess(res, badges);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST / — Create badge (admin)
// ---------------------------------------------------------------------------
router.post(
  "/",
  authorize("super_admin", "org_admin", "hr_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const data = createBadgeSchema.parse(req.body);
      const badge = await badgeService.createBadge(orgId, data);
      return sendSuccess(res, badge, 201);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /my — Current user's earned badges
// ---------------------------------------------------------------------------
router.get("/my", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const userId = req.user!.empcloudUserId;
    const badges = await badgeService.getUserBadges(orgId, userId);
    return sendSuccess(res, badges);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /user/:userId — Get a specific user's badges
// ---------------------------------------------------------------------------
router.get("/user/:userId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const userId = parseInt(req.params.userId, 10);
    const badges = await badgeService.getUserBadges(orgId, userId);
    return sendSuccess(res, badges);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /:id — Get badge by ID
// ---------------------------------------------------------------------------
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const badge = await badgeService.getBadge(orgId, req.params.id);
    return sendSuccess(res, badge);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /:id — Update badge (admin)
// ---------------------------------------------------------------------------
router.put(
  "/:id",
  authorize("super_admin", "org_admin", "hr_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const data = createBadgeSchema.partial().parse(req.body);
      const badge = await badgeService.updateBadge(orgId, req.params.id, data);
      return sendSuccess(res, badge);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:id — Soft-delete badge (admin)
// ---------------------------------------------------------------------------
router.delete(
  "/:id",
  authorize("super_admin", "org_admin", "hr_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      await badgeService.deleteBadge(orgId, req.params.id);
      return sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /award — Award badge to user (admin)
// ---------------------------------------------------------------------------
router.post(
  "/award",
  authorize("super_admin", "org_admin", "hr_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const awardedBy = req.user!.empcloudUserId;
      const data = awardBadgeSchema.parse(req.body);
      const userBadge = await badgeService.awardBadge(
        orgId,
        data.user_id,
        data.badge_id,
        awardedBy,
        data.awarded_reason || null,
      );
      return sendSuccess(res, userBadge, 201);
    } catch (err) {
      next(err);
    }
  },
);

export { router as badgeRoutes };
