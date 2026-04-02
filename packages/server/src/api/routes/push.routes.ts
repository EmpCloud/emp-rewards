// ============================================================================
// PUSH NOTIFICATION ROUTES
// POST /push/subscribe    — Register push subscription
// POST /push/unsubscribe  — Remove subscription
// POST /push/test         — Test push to self
// GET  /push/vapid-key    — Get VAPID public key (for client-side subscription)
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.middleware";
import * as pushService from "../../services/push/push.service";
import { sendSuccess } from "../../utils/response";
import { ValidationError, AppError } from "../../utils/errors";

const router = Router();

// All push routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const subscribeSchema = z.object({
  endpoint: z.string().url("Must be a valid URL"),
  keys: z.object({
    p256dh: z.string().min(1, "p256dh key is required"),
    auth: z.string().min(1, "auth key is required"),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url("Must be a valid URL"),
});

// ---------------------------------------------------------------------------
// GET /vapid-key — get the VAPID public key for client-side subscription
// ---------------------------------------------------------------------------
router.get("/vapid-key", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const publicKey = pushService.getVapidPublicKey();
    if (!publicKey) {
      throw new AppError(503, "VAPID_NOT_CONFIGURED", "Push notifications are not yet set up for this organization. Please contact your administrator to configure VAPID keys.");
    }
    sendSuccess(res, { publicKey });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /subscribe — register a push subscription
// ---------------------------------------------------------------------------
router.post("/subscribe", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      const details: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        details[key] = details[key] || [];
        details[key].push(issue.message);
      }
      throw new ValidationError("Invalid subscription data", details);
    }

    const orgId = req.user!.empcloudOrgId;
    const userId = req.user!.empcloudUserId;

    const subscription = await pushService.subscribe(orgId, userId, parsed.data);
    sendSuccess(res, subscription, 201);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /unsubscribe — remove a push subscription
// ---------------------------------------------------------------------------
router.post("/unsubscribe", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = unsubscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("A valid endpoint URL is required");
    }

    const userId = req.user!.empcloudUserId;
    await pushService.unsubscribe(userId, parsed.data.endpoint);
    sendSuccess(res, { message: "Subscription removed" });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /test — test push notification to self
// ---------------------------------------------------------------------------
router.post("/test", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.empcloudUserId;
    const result = await pushService.testPush(userId);

    if (result.total === 0) {
      throw new AppError(400, "NO_SUBSCRIPTION", "No push subscriptions found. Please enable browser notifications first, then try again.");
    }

    sendSuccess(res, {
      message: `Test notification sent to ${result.sent} of ${result.total} device(s).`,
      sent: result.sent,
      total: result.total,
    });
  } catch (err) {
    next(err);
  }
});

export { router as pushRoutes };
