// ============================================================================
// SLACK SERVICE
// Sends notifications to Slack via incoming webhooks.
// ============================================================================

import { getDB } from "../../db/adapters";
import { logger } from "../../utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlackConfig {
  id: string;
  organization_id: number;
  slack_webhook_url: string | null;
  slack_channel_name: string | null;
  slack_notifications_enabled: boolean;
  slack_notify_kudos: boolean;
  slack_notify_celebrations: boolean;
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: Array<{ type: string; text: string; emoji?: boolean }>;
  fields?: Array<{ type: string; text: string }>;
}

// ---------------------------------------------------------------------------
// getSlackConfig — returns Slack config for an org (from recognition_settings)
// ---------------------------------------------------------------------------
export async function getSlackConfig(orgId: number): Promise<SlackConfig | null> {
  const db = getDB();
  const row = await db.findOne<any>("recognition_settings", { organization_id: orgId });
  if (!row) return null;

  return {
    id: row.id,
    organization_id: row.organization_id,
    slack_webhook_url: row.slack_webhook_url || null,
    slack_channel_name: row.slack_channel_name || null,
    slack_notifications_enabled: Boolean(row.slack_notifications_enabled),
    slack_notify_kudos: Boolean(row.slack_notify_kudos),
    slack_notify_celebrations: Boolean(row.slack_notify_celebrations),
  };
}

// ---------------------------------------------------------------------------
// updateSlackConfig — persists Slack settings on the recognition_settings row
// ---------------------------------------------------------------------------
export async function updateSlackConfig(
  orgId: number,
  data: {
    slack_webhook_url?: string | null;
    slack_channel_name?: string | null;
    slack_notifications_enabled?: boolean;
    slack_notify_kudos?: boolean;
    slack_notify_celebrations?: boolean;
  },
): Promise<SlackConfig> {
  const db = getDB();

  // Ensure settings row exists
  let settings = await db.findOne<any>("recognition_settings", { organization_id: orgId });
  if (!settings) {
    // Import settings service to auto-create defaults
    const { getSettings } = await import("../settings/settings.service");
    settings = await getSettings(orgId);
  }

  await db.update("recognition_settings", settings.id, data as any);
  logger.info(`Slack config updated for org=${orgId}`);

  const updated = await getSlackConfig(orgId);
  return updated!;
}

// ---------------------------------------------------------------------------
// postToChannel — send a message to Slack via incoming webhook
// ---------------------------------------------------------------------------
export async function postToChannel(
  webhookUrl: string,
  text: string,
  blocks?: SlackBlock[],
): Promise<boolean> {
  try {
    const body: Record<string, any> = { text };
    if (blocks && blocks.length > 0) {
      body.blocks = blocks;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const responseText = await response.text();
      logger.warn(`Slack webhook returned ${response.status}: ${responseText}`);
      return false;
    }

    return true;
  } catch (err: any) {
    logger.error(`Slack webhook error: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// formatKudosMessage — rich Slack Block Kit message for a kudos
// ---------------------------------------------------------------------------
export function formatKudosMessage(
  senderName: string,
  recipientName: string,
  message: string,
  category: string | null,
  points: number,
): { text: string; blocks: SlackBlock[] } {
  const fallbackText = `${senderName} recognized ${recipientName}: "${message}"`;

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:tada: *${senderName}* recognized *${recipientName}*`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `> ${message}`,
      },
    },
  ];

  // Category + points row
  const fields: Array<{ type: string; text: string }> = [];
  if (category) {
    fields.push({ type: "mrkdwn", text: `:label: *Category:* ${category}` });
  }
  if (points > 0) {
    fields.push({ type: "mrkdwn", text: `:star: *Points:* +${points}` });
  }
  if (fields.length > 0) {
    blocks.push({ type: "section", fields });
  }

  blocks.push({
    type: "context",
    elements: [
      { type: "mrkdwn", text: "Sent via *EMP Rewards*" },
    ],
  });

  return { text: fallbackText, blocks };
}

// ---------------------------------------------------------------------------
// formatCelebrationMessage — birthday/anniversary Slack message
// ---------------------------------------------------------------------------
export function formatCelebrationMessage(
  name: string,
  type: "birthday" | "anniversary",
  details: string,
): { text: string; blocks: SlackBlock[] } {
  const emoji = type === "birthday" ? ":birthday:" : ":tada:";
  const heading = type === "birthday"
    ? `${emoji} Happy Birthday, *${name}*!`
    : `${emoji} Congratulations, *${name}*!`;

  const fallbackText = `${type === "birthday" ? "Happy Birthday" : "Congratulations"}, ${name}! ${details}`;

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: heading },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: details },
    },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: "Sent via *EMP Rewards*" },
      ],
    },
  ];

  return { text: fallbackText, blocks };
}

// ---------------------------------------------------------------------------
// sendKudosNotification — post kudos to Slack if configured
// ---------------------------------------------------------------------------
export async function sendKudosNotification(
  orgId: number,
  kudosId: string,
): Promise<void> {
  try {
    const slackConfig = await getSlackConfig(orgId);
    if (
      !slackConfig ||
      !slackConfig.slack_notifications_enabled ||
      !slackConfig.slack_notify_kudos ||
      !slackConfig.slack_webhook_url
    ) {
      return;
    }

    const db = getDB();
    const kudos = await db.findById<any>("kudos", kudosId);
    if (!kudos) return;

    // Resolve sender + receiver names from empcloud users table
    let senderName = "Someone";
    let receiverName = "a colleague";

    try {
      const { getEmpCloudDB } = await import("../../db/empcloud");
      const empDb = getEmpCloudDB();

      if (!kudos.is_anonymous) {
        const [senderRows] = await empDb.raw(
          `SELECT first_name, last_name FROM users WHERE id = ? LIMIT 1`,
          [kudos.sender_id],
        );
        if (senderRows && senderRows[0]) {
          senderName = `${senderRows[0].first_name} ${senderRows[0].last_name}`.trim();
        }
      } else {
        senderName = "Anonymous";
      }

      const [receiverRows] = await empDb.raw(
        `SELECT first_name, last_name FROM users WHERE id = ? LIMIT 1`,
        [kudos.receiver_id],
      );
      if (receiverRows && receiverRows[0]) {
        receiverName = `${receiverRows[0].first_name} ${receiverRows[0].last_name}`.trim();
      }
    } catch (err: any) {
      logger.warn(`Failed to resolve user names for Slack notification: ${err.message}`);
    }

    // Resolve category name
    let categoryName: string | null = null;
    if (kudos.category_id) {
      const category = await db.findById<any>("recognition_categories", kudos.category_id);
      if (category) {
        categoryName = category.name;
      }
    }

    const { text, blocks } = formatKudosMessage(
      senderName,
      receiverName,
      kudos.message,
      categoryName,
      kudos.points || 0,
    );

    await postToChannel(slackConfig.slack_webhook_url, text, blocks);
    logger.debug(`Slack kudos notification sent for kudos=${kudosId} org=${orgId}`);
  } catch (err: any) {
    // Non-blocking — never throw from notification
    logger.warn(`Failed to send Slack kudos notification: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// sendCelebrationNotification — post celebration to Slack
// ---------------------------------------------------------------------------
export async function sendCelebrationNotification(
  orgId: number,
  celebrationId: string,
): Promise<void> {
  try {
    const slackConfig = await getSlackConfig(orgId);
    if (
      !slackConfig ||
      !slackConfig.slack_notifications_enabled ||
      !slackConfig.slack_notify_celebrations ||
      !slackConfig.slack_webhook_url
    ) {
      return;
    }

    const db = getDB();
    const celebration = await db.findById<any>("celebrations", celebrationId);
    if (!celebration) return;

    // Resolve user name
    let userName = "A team member";
    try {
      const { getEmpCloudDB } = await import("../../db/empcloud");
      const empDb = getEmpCloudDB();
      const [rows] = await empDb.raw(
        `SELECT first_name, last_name FROM users WHERE id = ? LIMIT 1`,
        [celebration.user_id],
      );
      if (rows && rows[0]) {
        userName = `${rows[0].first_name} ${rows[0].last_name}`.trim();
      }
    } catch (err: any) {
      logger.warn(`Failed to resolve user name for celebration notification: ${err.message}`);
    }

    const celebrationType = celebration.type === "birthday" ? "birthday" : "anniversary";
    const details = celebration.details || (celebrationType === "birthday"
      ? "Wishing you a wonderful day!"
      : `Celebrating their work anniversary!`);

    const { text, blocks } = formatCelebrationMessage(userName, celebrationType, details);

    await postToChannel(slackConfig.slack_webhook_url, text, blocks);
    logger.debug(`Slack celebration notification sent for celebration=${celebrationId} org=${orgId}`);
  } catch (err: any) {
    logger.warn(`Failed to send Slack celebration notification: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// testWebhook — send a test message to verify webhook works
// ---------------------------------------------------------------------------
export async function testWebhook(webhookUrl: string): Promise<boolean> {
  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: ":white_check_mark: *EMP Rewards* Slack integration is working!",
      },
    },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: "This is a test message from EMP Rewards. You can safely ignore it." },
      ],
    },
  ];

  return postToChannel(webhookUrl, "EMP Rewards Slack integration test", blocks);
}
