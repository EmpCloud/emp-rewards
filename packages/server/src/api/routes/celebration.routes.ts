// ============================================================================
// CELEBRATION ROUTES
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { sendSuccess } from "../../utils/response";
import { paginationSchema } from "@emp-rewards/shared";
import * as celebrationService from "../../services/celebration/celebration.service";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /today — today's birthdays + anniversaries
// ---------------------------------------------------------------------------
router.get("/today", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;

    // Auto-generate today's celebrations if not yet done
    await celebrationService.generateTodayCelebrations(orgId);

    const celebrations = await celebrationService.getTodayCelebrations(orgId);
    return sendSuccess(res, celebrations);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /upcoming — next 7 days of celebrations
// ---------------------------------------------------------------------------
router.get("/upcoming", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const days = Number(req.query.days) || 7;
    const celebrations = await celebrationService.getUpcomingCelebrations(orgId, days);
    return sendSuccess(res, celebrations);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /feed — unified celebration + kudos feed
// ---------------------------------------------------------------------------
router.get("/feed", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const params = paginationSchema.parse(req.query);

    // Auto-generate today's celebrations if not yet done
    await celebrationService.generateTodayCelebrations(orgId);

    const result = await celebrationService.getCelebrationFeed(orgId, {
      page: params.page,
      perPage: params.perPage,
    });
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /:id — single celebration with wishes
// ---------------------------------------------------------------------------
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const celebration = await celebrationService.getCelebrationById(orgId, req.params.id);
    const wishes = await celebrationService.getWishes(orgId, req.params.id);
    return sendSuccess(res, { celebration, wishes });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/wish — send a wish on a celebration
// ---------------------------------------------------------------------------
const sendWishSchema = z.object({
  message: z.string().min(1).max(500),
});

router.post("/:id/wish", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const userId = req.user!.empcloudUserId;
    const { message } = sendWishSchema.parse(req.body);
    const wish = await celebrationService.sendWish(orgId, req.params.id, userId, message);
    return sendSuccess(res, wish, 201);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /custom — create a custom celebration (HR only)
// ---------------------------------------------------------------------------
const createCustomCelebrationSchema = z.object({
  user_id: z.number().int().positive(),
  type: z.enum(["birthday", "work_anniversary", "new_joiner", "promotion", "custom"]),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  celebration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  metadata: z.record(z.any()).optional().nullable(),
});

router.post(
  "/custom",
  authorize("hr_admin", "hr_manager", "org_admin", "super_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const data = createCustomCelebrationSchema.parse(req.body);
      const celebration = await celebrationService.createCelebration({
        organization_id: orgId,
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        description: data.description || null,
        celebration_date: data.celebration_date,
        metadata: data.metadata || null,
        is_auto_generated: false,
      });
      return sendSuccess(res, celebration, 201);
    } catch (err) {
      next(err);
    }
  },
);

export { router as celebrationRoutes };
