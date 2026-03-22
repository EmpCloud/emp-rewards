// ============================================================================
// SLACK ROUTES
// POST /slack/webhook — incoming Slack slash commands
// POST /slack/test — test webhook connection
// GET  /slack/config — get Slack integration config
// PUT  /slack/config — update Slack config (admin only)
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.middleware";
import * as slackService from "../../services/slack/slack.service";
import * as slashCommandService from "../../services/slack/slash-command.service";
import { sendSuccess } from "../../utils/response";
import { ValidationError, AppError } from "../../utils/errors";
import { logger } from "../../utils/logger";

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const updateSlackConfigSchema = z.object({
  slack_webhook_url: z.string().url("Must be a valid URL").nullable().optional(),
  slack_channel_name: z.string().max(100).nullable().optional(),
  slack_notifications_enabled: z.boolean().optional(),
  slack_notify_kudos: z.boolean().optional(),
  slack_notify_celebrations: z.boolean().optional(),
});

const testWebhookSchema = z.object({
  webhook_url: z.string().url("Must be a valid URL"),
});

// ---------------------------------------------------------------------------
// POST /webhook — incoming Slack slash commands (no JWT auth — Slack posts here)
// ---------------------------------------------------------------------------
router.post("/webhook", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body as slashCommandService.SlackSlashPayload;

    if (!payload || !payload.command || !payload.team_id) {
      throw new AppError(400, "INVALID_PAYLOAD", "Invalid Slack slash command payload");
    }

    logger.info(`Slack slash command received: command=${payload.command} user=${payload.user_name} team=${payload.team_id}`);

    // Resolve the org from the Slack team — for now, we require org_id as a query param
    // In production, you'd map team_id -> org_id via a stored mapping
    const orgId = parseInt(req.query.org_id as string);
    if (!orgId || isNaN(orgId)) {
      return res.status(200).json({
        response_type: "ephemeral",
        text: "Slack integration is not properly configured. Please contact your admin.",
      });
    }

    const result = await slashCommandService.handleSlashCommand(orgId, payload);
    return res.status(200).json(result);
  } catch (err) {
    // Slack expects 200 responses — return error as ephemeral message
    logger.error("Slack webhook error:", err);
    return res.status(200).json({
      response_type: "ephemeral",
      text: "An error occurred processing your command. Please try again later.",
    });
  }
});

// ---------------------------------------------------------------------------
// All remaining routes require authentication
// ---------------------------------------------------------------------------
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /config — get Slack config
// ---------------------------------------------------------------------------
router.get("/config", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const config = await slackService.getSlackConfig(orgId);

    // Mask the webhook URL for non-admins
    if (config && config.slack_webhook_url) {
      const isAdmin = ["org_admin", "hr_admin"].includes(req.user!.role);
      if (!isAdmin) {
        config.slack_webhook_url = config.slack_webhook_url.replace(
          /\/T\w+\/B\w+\/\w+$/,
          "/T****/B****/****",
        );
      }
    }

    sendSuccess(res, config || {
      slack_webhook_url: null,
      slack_channel_name: null,
      slack_notifications_enabled: false,
      slack_notify_kudos: true,
      slack_notify_celebrations: true,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /config — update Slack config (admin only)
// ---------------------------------------------------------------------------
router.put(
  "/config",
  authorize("org_admin", "hr_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateSlackConfigSchema.safeParse(req.body);
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
      const config = await slackService.updateSlackConfig(orgId, parsed.data);
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

      const success = await slackService.testWebhook(parsed.data.webhook_url);
      if (success) {
        sendSuccess(res, { connected: true, message: "Test message sent successfully!" });
      } else {
        throw new AppError(400, "WEBHOOK_FAILED", "Failed to send test message. Please check the webhook URL.");
      }
    } catch (err) {
      next(err);
    }
  },
);

export { router as slackRoutes };
