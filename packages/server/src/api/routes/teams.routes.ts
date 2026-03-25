// ============================================================================
// TEAMS ROUTES
// GET  /teams           — Get Teams config (webhook URL, enabled)
// PUT  /teams           — Update Teams config (admin only)
// POST /teams/test      — Test webhook (admin only)
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.middleware";
import * as teamsService from "../../services/teams/teams.service";
import { sendSuccess } from "../../utils/response";
import { ValidationError, AppError } from "../../utils/errors";

const router = Router();

// All Teams routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const updateTeamsConfigSchema = z.object({
  teams_webhook_url: z.string().url("Must be a valid URL").nullable().optional(),
  teams_enabled: z.boolean().optional(),
  teams_notify_kudos: z.boolean().optional(),
  teams_notify_celebrations: z.boolean().optional(),
  teams_notify_milestones: z.boolean().optional(),
});

const testWebhookSchema = z.object({
  webhook_url: z.string().url("Must be a valid URL"),
});

// ---------------------------------------------------------------------------
// GET / — get Teams config
// ---------------------------------------------------------------------------
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const config = await teamsService.getTeamsConfig(orgId);

    // Mask the webhook URL for non-admins
    if (config && config.teams_webhook_url) {
      const isAdmin = ["org_admin", "hr_admin"].includes(req.user!.role);
      if (!isAdmin) {
        config.teams_webhook_url = config.teams_webhook_url.replace(
          /\/IncomingWebhook\/[a-f0-9]+\/[a-f0-9-]+$/i,
          "/IncomingWebhook/****/****",
        );
      }
    }

    sendSuccess(res, config || {
      teams_webhook_url: null,
      teams_enabled: false,
      teams_notify_kudos: true,
      teams_notify_celebrations: true,
      teams_notify_milestones: true,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT / — update Teams config (admin only)
// ---------------------------------------------------------------------------
router.put(
  "/",
  authorize("org_admin", "hr_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateTeamsConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        const details: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path.join(".");
          details[key] = details[key] || [];
          details[key].push(issue.message);
        }
        throw new ValidationError("Invalid input", details);
      }

      const orgId = req.user!.empcloudOrgId;
      const config = await teamsService.updateTeamsConfig(orgId, parsed.data);
      sendSuccess(res, config);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /test — test webhook connection (admin only)
// ---------------------------------------------------------------------------
router.post(
  "/test",
  authorize("org_admin", "hr_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = testWebhookSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("A valid webhook URL is required");
      }

      const success = await teamsService.testTeamsWebhook(parsed.data.webhook_url);
      if (success) {
        sendSuccess(res, { connected: true, message: "Test message sent to Teams successfully!" });
      } else {
        throw new AppError(400, "WEBHOOK_FAILED", "Failed to send test message. Please check the webhook URL.");
      }
    } catch (err) {
      next(err);
    }
  },
);

export { router as teamsRoutes };
