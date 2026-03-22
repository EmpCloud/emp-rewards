// ============================================================================
// SLACK SLASH COMMAND SERVICE
// Handles incoming /kudos slash commands from Slack.
// ============================================================================

import { getDB } from "../../db/adapters";
import { logger } from "../../utils/logger";
import * as kudosService from "../kudos/kudos.service";
import * as slackService from "./slack.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlackSlashPayload {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
}

interface SlashCommandResult {
  response_type: "ephemeral" | "in_channel";
  text: string;
}

// ---------------------------------------------------------------------------
// handleSlashCommand
// Parses: /kudos @user Great job on the project!
// ---------------------------------------------------------------------------
export async function handleSlashCommand(
  orgId: number,
  payload: SlackSlashPayload,
): Promise<SlashCommandResult> {
  const { text, user_name } = payload;

  if (!text || text.trim().length === 0) {
    return {
      response_type: "ephemeral",
      text: "Usage: `/kudos @user Your recognition message`\nExample: `/kudos @jane Great job on the project!`",
    };
  }

  // Parse: first token is the @mention, rest is the message
  const trimmed = text.trim();

  // Handle Slack user mention formats: <@U12345|username> or @username or just username
  const mentionMatch = trimmed.match(/^(?:<@(\w+)(?:\|[^>]*)?>|@(\S+)|(\S+))\s+(.+)$/s);
  if (!mentionMatch) {
    return {
      response_type: "ephemeral",
      text: "Could not parse your command. Usage: `/kudos @user Your message`",
    };
  }

  const slackUserId = mentionMatch[1]; // from <@U12345|name>
  const mentionName = mentionMatch[2] || mentionMatch[3]; // from @name or plain name
  const message = mentionMatch[4]?.trim();

  if (!message) {
    return {
      response_type: "ephemeral",
      text: "Please include a message. Usage: `/kudos @user Your message`",
    };
  }

  try {
    // Look up the sender by Slack username or email
    const sender = await resolveUserBySlack(orgId, payload.user_id, user_name);
    if (!sender) {
      return {
        response_type: "ephemeral",
        text: "Could not find your EMP Rewards account. Make sure your Slack email matches your EMP Rewards email.",
      };
    }

    // Look up the recipient
    const recipient = await resolveUserBySlack(orgId, slackUserId || null, mentionName || null);
    if (!recipient) {
      return {
        response_type: "ephemeral",
        text: `Could not find a matching EMP Rewards user for "${mentionName || slackUserId}". Make sure their Slack email matches their EMP Rewards email.`,
      };
    }

    // Create the kudos
    const kudos = await kudosService.sendKudos(orgId, sender.id, {
      receiver_id: recipient.id,
      message,
      feedback_type: "kudos",
    });

    // Send Slack notification (non-blocking)
    slackService.sendKudosNotification(orgId, kudos.id).catch(() => {});

    return {
      response_type: "in_channel",
      text: `:tada: *${user_name}* just sent kudos to *${recipient.name}*!\n> ${message}\n:star: +${kudos.points} points`,
    };
  } catch (err: any) {
    logger.warn(`Slash command error: ${err.message}`);

    if (err.code === "SELF_KUDOS_NOT_ALLOWED") {
      return { response_type: "ephemeral", text: "You cannot send kudos to yourself." };
    }
    if (err.code === "DAILY_LIMIT_REACHED") {
      return { response_type: "ephemeral", text: "You have reached your daily kudos limit. Try again tomorrow!" };
    }

    return {
      response_type: "ephemeral",
      text: "Something went wrong while sending kudos. Please try again later.",
    };
  }
}

// ---------------------------------------------------------------------------
// resolveUserBySlack — find empcloud user by Slack user ID or username
// We match by email since Slack user IDs aren't stored. Falls back to name match.
// ---------------------------------------------------------------------------
async function resolveUserBySlack(
  orgId: number,
  slackUserId: string | null,
  slackUsername: string | null,
): Promise<{ id: number; name: string } | null> {
  try {
    const { getEmpCloudDB } = await import("../../db/empcloud");
    const empDb = getEmpCloudDB();

    // Try matching by email-like username (Slack usernames often match email prefixes)
    if (slackUsername) {
      // Strip leading @ if present
      const cleanName = slackUsername.replace(/^@/, "");

      // Try exact email match first
      const [emailRows] = await empDb.raw(
        `SELECT id, first_name, last_name FROM users
         WHERE organization_id = ? AND (email = ? OR email LIKE ?)
         LIMIT 1`,
        [orgId, cleanName, `${cleanName}@%`],
      );

      if (emailRows && emailRows[0]) {
        return {
          id: emailRows[0].id,
          name: `${emailRows[0].first_name} ${emailRows[0].last_name}`.trim(),
        };
      }

      // Try name match as fallback
      const [nameRows] = await empDb.raw(
        `SELECT id, first_name, last_name FROM users
         WHERE organization_id = ? AND (
           LOWER(CONCAT(first_name, '.', last_name)) = LOWER(?)
           OR LOWER(first_name) = LOWER(?)
         )
         LIMIT 1`,
        [orgId, cleanName, cleanName],
      );

      if (nameRows && nameRows[0]) {
        return {
          id: nameRows[0].id,
          name: `${nameRows[0].first_name} ${nameRows[0].last_name}`.trim(),
        };
      }
    }

    return null;
  } catch (err: any) {
    logger.warn(`Failed to resolve Slack user: ${err.message}`);
    return null;
  }
}
