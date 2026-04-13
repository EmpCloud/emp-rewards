// ============================================================================
// CHALLENGE ROUTES
// GET /, POST / (admin), GET /:id, POST /:id/join, POST /:id/refresh-progress,
//     POST /:id/complete (admin), GET /:id/leaderboard
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import * as challengeService from "../../services/challenge/challenge.service";
import { sendSuccess, sendPaginated } from "../../utils/response";
import { z } from "zod";

const router = Router();

// All challenge routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------
const createChallengeSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  type: z.enum(["individual", "team", "department"]),
  metric: z.enum(["kudos_sent", "kudos_received", "points_earned", "badges_earned"]),
  target_value: z.number().int().positive(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reward_points: z.number().int().min(0).optional().default(0),
  reward_badge_id: z.string().uuid().optional().nullable(),
});

// ---------------------------------------------------------------------------
// GET / — List challenges (filter by status)
// ---------------------------------------------------------------------------
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 20;
    const result = await challengeService.listChallenges(orgId, { status, page, perPage });
    return sendPaginated(res, result.data, result.total, result.page, result.limit);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST / — Create challenge (admin only)
// ---------------------------------------------------------------------------
router.post(
  "/",
  authorize("hr_admin", "org_admin", "super_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const data = createChallengeSchema.parse(req.body);
      const challenge = await challengeService.createChallenge(orgId, {
        ...data,
        created_by: req.user!.empcloudUserId,
      });
      return sendSuccess(res, challenge, 201);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:id — Get challenge details with participants
// ---------------------------------------------------------------------------
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const result = await challengeService.getChallenge(orgId, req.params.id as string);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/join — Join a challenge
// ---------------------------------------------------------------------------
router.post("/:id/join", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const userId = req.user!.empcloudUserId;
    const participant = await challengeService.joinChallenge(orgId, req.params.id as string, userId);
    return sendSuccess(res, participant, 201);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/refresh-progress — Recalculate progress for all participants
// ---------------------------------------------------------------------------
router.post("/:id/refresh-progress", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    await challengeService.updateProgress(orgId, req.params.id as string);
    return sendSuccess(res, { refreshed: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/complete — Finalize challenge and award prizes (admin only)
// ---------------------------------------------------------------------------
router.post(
  "/:id/complete",
  authorize("hr_admin", "org_admin", "super_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      await challengeService.completeChallenge(orgId, req.params.id as string);
      return sendSuccess(res, { completed: true });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:id/leaderboard — Challenge leaderboard
// ---------------------------------------------------------------------------
router.get("/:id/leaderboard", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const leaderboard = await challengeService.getChallengeLeaderboard(orgId, req.params.id as string);
    return sendSuccess(res, leaderboard);
  } catch (err) {
    next(err);
  }
});

export { router as challengeRoutes };
