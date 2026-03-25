// ============================================================================
// TEAMS SERVICE
// Sends notifications to Microsoft Teams via incoming webhooks.
// ============================================================================

import { getDB } from "../../db/adapters";
import { logger } from "../../utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TeamsConfig {
  id: string;
  organization_id: number;
  teams_webhook_url: string | null;
  teams_enabled: boolean;
  teams_notify_kudos: boolean;
  teams_notify_celebrations: boolean;
  teams_notify_milestones: boolean;
}

interface TeamsMessageCard {
  "@type": string;
  "@context": string;
  summary: string;
  themeColor?: string;
  sections: TeamsSection[];
}

interface TeamsSection {
  activityTitle?: string;
  activitySubtitle?: string;
  activityImage?: string;
  text?: string;
  facts?: Array<{ name: string; value: string }>;
  markdown?: boolean;
}

// ---------------------------------------------------------------------------
// getTeamsConfig — returns Teams config for an org (from recognition_settings)
// ---------------------------------------------------------------------------
export async function getTeamsConfig(orgId: number): Promise<TeamsConfig | null> {
  const db = getDB();
  const row = await db.findOne<any>("recognition_settings", { organization_id: orgId });
  if (!row) return null;

  return {
    id: row.id,
    organization_id: row.organization_id,
    teams_webhook_url: row.teams_webhook_url || null,
    teams_enabled: Boolean(row.teams_enabled),
    teams_notify_kudos: Boolean(row.teams_notify_kudos),
    teams_notify_celebrations: Boolean(row.teams_notify_celebrations),
    teams_notify_milestones: Boolean(row.teams_notify_milestones),
  };
}

// ---------------------------------------------------------------------------
// updateTeamsConfig — persists Teams settings on the recognition_settings row
// ---------------------------------------------------------------------------
export async function updateTeamsConfig(
  orgId: number,
  data: {
    teams_webhook_url?: string | null;
    teams_enabled?: boolean;
    teams_notify_kudos?: boolean;
    teams_notify_celebrations?: boolean;
    teams_notify_milestones?: boolean;
  },
): Promise<TeamsConfig> {
  const db = getDB();

  // Ensure settings row exists
  let settings = await db.findOne<any>("recognition_settings", { organization_id: orgId });
  if (!settings) {
    const { getSettings } = await import("../settings/settings.service");
    settings = await getSettings(orgId);
  }

  await db.update("recognition_settings", settings.id, data as any);
  logger.info(`Teams config updated for org=${orgId}`);

  const updated = await getTeamsConfig(orgId);
  return updated!;
}

// ---------------------------------------------------------------------------
// sendTeamsNotification — send a MessageCard to Teams via incoming webhook
// ---------------------------------------------------------------------------
export async function sendTeamsNotification(
  webhookUrl: string,
  card: TeamsMessageCard,
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });

    if (!response.ok) {
      const responseText = await response.text();
      logger.warn(`Teams webhook returned ${response.status}: ${responseText}`);
      return false;
    }

    return true;
  } catch (err: any) {
    logger.error(`Teams webhook error: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// formatKudosCard — rich MessageCard for a kudos
// ---------------------------------------------------------------------------
export function formatKudosCard(
  senderName: string,
  recipientName: string,
  message: string,
  category: string | null,
  points: number,
): TeamsMessageCard {
  const facts: Array<{ name: string; value: string }> = [];
  if (points > 0) {
    facts.push({ name: "Points", value: String(points) });
  }
  if (category) {
    facts.push({ name: "Category", value: category });
  }

  return {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: `${senderName} recognized ${recipientName}`,
    themeColor: "F59E0B",
    sections: [
      {
        activityTitle: `\u{1F389} ${senderName} recognized ${recipientName}`,
        activitySubtitle: category ? `Category: ${category}` : "Kudos",
        text: message,
        facts,
        markdown: true,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// formatCelebrationCard — birthday/anniversary Teams card
// ---------------------------------------------------------------------------
export function formatCelebrationCard(
  name: string,
  type: "birthday" | "anniversary",
  details: string,
): TeamsMessageCard {
  const emoji = type === "birthday" ? "\u{1F382}" : "\u{1F389}";
  const heading = type === "birthday"
    ? `${emoji} Happy Birthday, ${name}!`
    : `${emoji} Congratulations, ${name}!`;

  return {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: heading,
    themeColor: type === "birthday" ? "EC4899" : "8B5CF6",
    sections: [
      {
        activityTitle: heading,
        activitySubtitle: "EMP Rewards",
        text: details,
        markdown: true,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// formatMilestoneCard — milestone achievement Teams card
// ---------------------------------------------------------------------------
export function formatMilestoneCard(
  userName: string,
  milestoneName: string,
  description: string | null,
  pointsAwarded: number,
): TeamsMessageCard {
  const facts: Array<{ name: string; value: string }> = [];
  if (pointsAwarded > 0) {
    facts.push({ name: "Points Awarded", value: String(pointsAwarded) });
  }

  return {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: `${userName} achieved ${milestoneName}`,
    themeColor: "10B981",
    sections: [
      {
        activityTitle: `\u{1F3C6} ${userName} achieved a milestone!`,
        activitySubtitle: milestoneName,
        text: description || "A new milestone has been reached!",
        facts,
        markdown: true,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// sendKudosToTeams — post kudos to Teams if configured
// ---------------------------------------------------------------------------
export async function sendKudosToTeams(
  orgId: number,
  kudosId: string,
): Promise<void> {
  try {
    const teamsConfig = await getTeamsConfig(orgId);
    if (
      !teamsConfig ||
      !teamsConfig.teams_enabled ||
      !teamsConfig.teams_notify_kudos ||
      !teamsConfig.teams_webhook_url
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
      logger.warn(`Failed to resolve user names for Teams notification: ${err.message}`);
    }

    // Resolve category name
    let categoryName: string | null = null;
    if (kudos.category_id) {
      const category = await db.findById<any>("recognition_categories", kudos.category_id);
      if (category) {
        categoryName = category.name;
      }
    }

    const card = formatKudosCard(
      senderName,
      receiverName,
      kudos.message,
      categoryName,
      kudos.points || 0,
    );

    await sendTeamsNotification(teamsConfig.teams_webhook_url, card);
    logger.debug(`Teams kudos notification sent for kudos=${kudosId} org=${orgId}`);
  } catch (err: any) {
    // Non-blocking — never throw from notification
    logger.warn(`Failed to send Teams kudos notification: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// sendCelebrationToTeams — post celebration to Teams
// ---------------------------------------------------------------------------
export async function sendCelebrationToTeams(
  orgId: number,
  celebrationId: string,
): Promise<void> {
  try {
    const teamsConfig = await getTeamsConfig(orgId);
    if (
      !teamsConfig ||
      !teamsConfig.teams_enabled ||
      !teamsConfig.teams_notify_celebrations ||
      !teamsConfig.teams_webhook_url
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
      logger.warn(`Failed to resolve user name for Teams celebration notification: ${err.message}`);
    }

    const celebrationType = celebration.type === "birthday" ? "birthday" : "anniversary";
    const details = celebration.details || (celebrationType === "birthday"
      ? "Wishing you a wonderful day!"
      : "Celebrating their work anniversary!");

    const card = formatCelebrationCard(userName, celebrationType, details);

    await sendTeamsNotification(teamsConfig.teams_webhook_url, card);
    logger.debug(`Teams celebration notification sent for celebration=${celebrationId} org=${orgId}`);
  } catch (err: any) {
    logger.warn(`Failed to send Teams celebration notification: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// sendMilestoneToTeams — post milestone achievement to Teams
// ---------------------------------------------------------------------------
export async function sendMilestoneToTeams(
  orgId: number,
  userId: number,
  milestoneRuleName: string,
  milestoneDescription: string | null,
  pointsAwarded: number,
): Promise<void> {
  try {
    const teamsConfig = await getTeamsConfig(orgId);
    if (
      !teamsConfig ||
      !teamsConfig.teams_enabled ||
      !teamsConfig.teams_notify_milestones ||
      !teamsConfig.teams_webhook_url
    ) {
      return;
    }

    // Resolve user name
    let userName = "A team member";
    try {
      const { getEmpCloudDB } = await import("../../db/empcloud");
      const empDb = getEmpCloudDB();
      const [rows] = await empDb.raw(
        `SELECT first_name, last_name FROM users WHERE id = ? LIMIT 1`,
        [userId],
      );
      if (rows && rows[0]) {
        userName = `${rows[0].first_name} ${rows[0].last_name}`.trim();
      }
    } catch (err: any) {
      logger.warn(`Failed to resolve user name for Teams milestone notification: ${err.message}`);
    }

    const card = formatMilestoneCard(userName, milestoneRuleName, milestoneDescription, pointsAwarded);

    await sendTeamsNotification(teamsConfig.teams_webhook_url, card);
    logger.debug(`Teams milestone notification sent for user=${userId} org=${orgId}`);
  } catch (err: any) {
    logger.warn(`Failed to send Teams milestone notification: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// testTeamsWebhook — send a test message to verify webhook works
// ---------------------------------------------------------------------------
export async function testTeamsWebhook(webhookUrl: string): Promise<boolean> {
  const card: TeamsMessageCard = {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: "EMP Rewards Teams integration test",
    themeColor: "F59E0B",
    sections: [
      {
        activityTitle: "\u2705 EMP Rewards Teams integration is working!",
        activitySubtitle: "Test Message",
        text: "This is a test message from EMP Rewards. You can safely ignore it.",
        markdown: true,
      },
    ],
  };

  return sendTeamsNotification(webhookUrl, card);
}
