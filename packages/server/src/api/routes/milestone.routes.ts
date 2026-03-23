// ============================================================================
// MILESTONE ROUTES
// CRUD for rules, GET /my-achievements, POST /check/:userId (admin)
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import * as milestoneService from "../../services/milestone/milestone.service";
import { sendSuccess } from "../../utils/response";
import { z } from "zod";

const router = Router();

// All milestone routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------
const createRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  trigger_type: z.enum([
    "work_anniversary",
    "kudos_count",
    "points_total",
    "badges_count",
    "referral_hired",
    "first_kudos",
  ]),
  trigger_value: z.number().int().min(0),
  reward_points: z.number().int().min(0).optional().default(0),
  reward_badge_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

const updateRuleSchema = createRuleSchema.partial();

// ---------------------------------------------------------------------------
// GET / — List all milestone rules (alias for /rules)
// ---------------------------------------------------------------------------
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const rules = await milestoneService.listRules(orgId);
    return sendSuccess(res, rules);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /rules — List all milestone rules
// ---------------------------------------------------------------------------
router.get("/rules", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const rules = await milestoneService.listRules(orgId);
    return sendSuccess(res, rules);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /rules — Create rule (admin only)
// ---------------------------------------------------------------------------
router.post(
  "/rules",
  authorize("hr_admin", "org_admin", "super_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const data = createRuleSchema.parse(req.body);
      const rule = await milestoneService.createRule(orgId, data);
      return sendSuccess(res, rule, 201);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /rules/:id — Update rule (admin only)
// ---------------------------------------------------------------------------
router.put(
  "/rules/:id",
  authorize("hr_admin", "org_admin", "super_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const data = updateRuleSchema.parse(req.body);
      const rule = await milestoneService.updateRule(orgId, req.params.id, data);
      return sendSuccess(res, rule);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /rules/:id — Delete rule (admin only)
// ---------------------------------------------------------------------------
router.delete(
  "/rules/:id",
  authorize("hr_admin", "org_admin", "super_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      await milestoneService.deleteRule(orgId, req.params.id);
      return sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /my-achievements — Current user's milestone achievements
// ---------------------------------------------------------------------------
router.get("/my-achievements", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const userId = req.user!.empcloudUserId;
    const achievements = await milestoneService.getUserAchievements(orgId, userId);
    return sendSuccess(res, achievements);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /check/:userId — Manually trigger milestone check (admin)
// ---------------------------------------------------------------------------
router.post(
  "/check/:userId",
  authorize("hr_admin", "org_admin", "super_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const userId = parseInt(req.params.userId);
      const awarded = await milestoneService.checkMilestones(orgId, userId);
      return sendSuccess(res, { awarded });
    } catch (err) {
      next(err);
    }
  },
);

export { router as milestoneRoutes };
