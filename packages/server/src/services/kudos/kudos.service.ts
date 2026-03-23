// ============================================================================
// KUDOS SERVICE
// Manages sending/listing/deleting kudos, reactions, and comments.
// ============================================================================

import { v4 as uuidv4 } from "uuid";
import { getDB } from "../../db/adapters";
import { KudosVisibility, PointTransactionType } from "@emp-rewards/shared";
import type { Kudos, KudosReaction, KudosComment, RecognitionSettings } from "@emp-rewards/shared";
import type { QueryResult } from "../../db/adapters/interface";
import { AppError, NotFoundError, ForbiddenError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import * as pointsService from "../points/points.service";
import * as slackService from "../slack/slack.service";
import * as milestoneService from "../milestone/milestone.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getSettings(orgId: number): Promise<RecognitionSettings | null> {
  const db = getDB();
  return db.findOne<RecognitionSettings>("recognition_settings", { organization_id: orgId });
}

// ---------------------------------------------------------------------------
// sendKudos
// ---------------------------------------------------------------------------
export async function sendKudos(
  orgId: number,
  senderId: number,
  data: {
    receiver_id: number;
    category_id?: string | null;
    message: string;
    points?: number;
    visibility?: string;
    feedback_type?: string;
    is_anonymous?: boolean;
  },
): Promise<Kudos> {
  const db = getDB();

  // Fetch org settings
  const settings = await getSettings(orgId);
  const pointsPerKudos = settings?.points_per_kudos ?? 10;

  // Determine actual points to award
  let pointsToAward = data.points ?? pointsPerKudos;

  // Apply category multiplier if category provided
  if (data.category_id) {
    const category = await db.findById<any>("recognition_categories", data.category_id);
    if (category && category.organization_id === orgId) {
      pointsToAward = Math.round(pointsToAward * Number(category.points_multiplier || 1));
    }
  }

  // Self-kudos check
  if (senderId === data.receiver_id && !(settings?.allow_self_kudos)) {
    throw new AppError(400, "SELF_KUDOS_NOT_ALLOWED", "You cannot send kudos to yourself");
  }

  // Check daily limit
  if (settings?.max_kudos_per_day) {
    const today = new Date().toISOString().slice(0, 10);
    const [rows] = await db.raw<any>(
      `SELECT COUNT(*) as count FROM kudos
       WHERE organization_id = ? AND sender_id = ? AND DATE(created_at) = ?`,
      [orgId, senderId, today],
    );
    const count = Number(rows[0]?.count || 0);
    if (count >= settings.max_kudos_per_day) {
      throw new AppError(429, "DAILY_LIMIT_REACHED", "You have reached your daily kudos limit");
    }
  }

  // Create the kudos record
  const kudos = await db.create<Kudos>("kudos", {
    id: uuidv4(),
    organization_id: orgId,
    sender_id: senderId,
    receiver_id: data.receiver_id,
    category_id: data.category_id || null,
    message: data.message,
    points: pointsToAward,
    visibility: data.visibility || KudosVisibility.PUBLIC,
    feedback_type: data.feedback_type || "kudos",
    is_anonymous: data.is_anonymous || false,
  } as any);

  // Credit points to recipient
  if (pointsToAward > 0) {
    await pointsService.earnPoints(
      orgId,
      data.receiver_id,
      pointsToAward,
      PointTransactionType.KUDOS_RECEIVED,
      "kudos",
      kudos.id,
      `Kudos received from ${data.is_anonymous ? "anonymous" : "a colleague"}`,
    );
  }

  // Credit small bonus to sender (10% of points awarded)
  const senderBonus = Math.max(1, Math.floor(pointsToAward * 0.1));
  if (senderBonus > 0 && senderId !== data.receiver_id) {
    await pointsService.earnPoints(
      orgId,
      senderId,
      senderBonus,
      PointTransactionType.KUDOS_SENT,
      "kudos",
      kudos.id,
      "Bonus for sending kudos",
    );
  }

  logger.info(`Kudos sent: id=${kudos.id} sender=${senderId} receiver=${data.receiver_id} org=${orgId}`);

  // Send Slack notification (non-blocking — errors are caught silently)
  slackService.sendKudosNotification(orgId, kudos.id).catch(() => {});

  // Check milestones for both sender and receiver (non-blocking)
  milestoneService.checkMilestones(orgId, data.receiver_id).catch(() => {});
  if (senderId !== data.receiver_id) {
    milestoneService.checkMilestones(orgId, senderId).catch(() => {});
  }

  return kudos;
}

// ---------------------------------------------------------------------------
// listKudos — paginated, filter by visibility
// ---------------------------------------------------------------------------
export async function listKudos(
  orgId: number,
  params: { page?: number; perPage?: number; visibility?: string },
): Promise<QueryResult<Kudos>> {
  const db = getDB();
  const filters: Record<string, any> = { organization_id: orgId };
  if (params.visibility) {
    filters.visibility = params.visibility;
  }

  return db.findMany<Kudos>("kudos", {
    page: params.page || 1,
    limit: params.perPage || 20,
    sort: { field: "created_at", order: "desc" },
    filters,
  });
}

// ---------------------------------------------------------------------------
// getKudos — single kudos with reactions + comments
// ---------------------------------------------------------------------------
export async function getKudos(
  orgId: number,
  id: string,
): Promise<{ kudos: Kudos; reactions: KudosReaction[]; comments: KudosComment[] }> {
  const db = getDB();
  const kudos = await db.findById<Kudos>("kudos", id);

  if (!kudos || kudos.organization_id !== orgId) {
    throw new NotFoundError("Kudos", id);
  }

  const [reactionsResult] = await db.raw<any>(
    `SELECT * FROM kudos_reactions WHERE kudos_id = ? ORDER BY created_at ASC`,
    [id],
  );

  const [commentsResult] = await db.raw<any>(
    `SELECT * FROM kudos_comments WHERE kudos_id = ? ORDER BY created_at ASC`,
    [id],
  );

  return {
    kudos,
    reactions: reactionsResult || [],
    comments: commentsResult || [],
  };
}

// ---------------------------------------------------------------------------
// deleteKudos — only sender can delete
// ---------------------------------------------------------------------------
export async function deleteKudos(orgId: number, id: string, userId: number): Promise<void> {
  const db = getDB();
  const kudos = await db.findById<Kudos>("kudos", id);

  if (!kudos || kudos.organization_id !== orgId) {
    throw new NotFoundError("Kudos", id);
  }

  if (kudos.sender_id !== userId) {
    throw new ForbiddenError("Only the sender can delete their kudos");
  }

  await db.delete("kudos", id);
  logger.info(`Kudos deleted: id=${id} by user=${userId}`);
}

// ---------------------------------------------------------------------------
// addReaction — INSERT IGNORE for dedup
// ---------------------------------------------------------------------------
export async function addReaction(
  kudosId: string,
  userId: number,
  reaction: string,
): Promise<void> {
  const db = getDB();

  // Verify kudos exists
  const kudos = await db.findById<Kudos>("kudos", kudosId);
  if (!kudos) {
    throw new NotFoundError("Kudos", kudosId);
  }

  try {
    await db.raw(
      `INSERT IGNORE INTO kudos_reactions (id, kudos_id, user_id, reaction_type, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [uuidv4(), kudosId, userId, reaction],
    );
  } catch (err: any) {
    // Duplicate — silently ignore
    if (err.code !== "ER_DUP_ENTRY") throw err;
  }
}

// ---------------------------------------------------------------------------
// removeReaction
// ---------------------------------------------------------------------------
export async function removeReaction(
  kudosId: string,
  userId: number,
  reaction: string,
): Promise<void> {
  const db = getDB();
  await db.deleteMany("kudos_reactions", {
    kudos_id: kudosId,
    user_id: userId,
    reaction_type: reaction,
  });
}

// ---------------------------------------------------------------------------
// addComment
// ---------------------------------------------------------------------------
export async function addComment(
  kudosId: string,
  userId: number,
  message: string,
): Promise<KudosComment> {
  const db = getDB();

  // Verify kudos exists
  const kudos = await db.findById<Kudos>("kudos", kudosId);
  if (!kudos) {
    throw new NotFoundError("Kudos", kudosId);
  }

  const comment = await db.create<KudosComment>("kudos_comments", {
    id: uuidv4(),
    kudos_id: kudosId,
    user_id: userId,
    content: message,
  } as any);

  return comment;
}

// ---------------------------------------------------------------------------
// deleteComment
// ---------------------------------------------------------------------------
export async function deleteComment(commentId: string, userId: number): Promise<void> {
  const db = getDB();
  const comment = await db.findById<KudosComment>("kudos_comments", commentId);

  if (!comment) {
    throw new NotFoundError("Comment", commentId);
  }

  if (comment.user_id !== userId) {
    throw new ForbiddenError("Only the comment author can delete their comment");
  }

  await db.delete("kudos_comments", commentId);
}

// ---------------------------------------------------------------------------
// sendBirthdayKudos — auto-generated birthday kudos from "system"
// ---------------------------------------------------------------------------
export async function sendBirthdayKudos(
  orgId: number,
  employeeId: number,
  fromSystem: boolean = true,
): Promise<Kudos> {
  const db = getDB();

  const kudos = await db.create<Kudos>("kudos", {
    id: uuidv4(),
    organization_id: orgId,
    sender_id: fromSystem ? 0 : employeeId,
    receiver_id: employeeId,
    category_id: null,
    message: "Happy Birthday! Wishing you a fantastic day filled with joy and celebration!",
    points: 0,
    visibility: KudosVisibility.PUBLIC,
    feedback_type: "kudos",
    is_anonymous: false,
  } as any);

  logger.info(`Birthday kudos sent: id=${kudos.id} employee=${employeeId} org=${orgId}`);
  return kudos;
}

// ---------------------------------------------------------------------------
// sendAnniversaryKudos — "Congratulations on X years!"
// ---------------------------------------------------------------------------
export async function sendAnniversaryKudos(
  orgId: number,
  employeeId: number,
  years: number,
  fromSystem: boolean = true,
): Promise<Kudos> {
  const db = getDB();

  const kudos = await db.create<Kudos>("kudos", {
    id: uuidv4(),
    organization_id: orgId,
    sender_id: fromSystem ? 0 : employeeId,
    receiver_id: employeeId,
    category_id: null,
    message: `Congratulations on ${years} year${years !== 1 ? "s" : ""} with the organization! Thank you for your dedication and contributions.`,
    points: 0,
    visibility: KudosVisibility.PUBLIC,
    feedback_type: "kudos",
    is_anonymous: false,
  } as any);

  logger.info(`Anniversary kudos sent: id=${kudos.id} employee=${employeeId} years=${years} org=${orgId}`);
  return kudos;
}

// ---------------------------------------------------------------------------
// getReceivedKudos — kudos received by a specific user
// ---------------------------------------------------------------------------
export async function getReceivedKudos(
  orgId: number,
  userId: number,
  params: { page?: number; perPage?: number },
): Promise<QueryResult<Kudos>> {
  const db = getDB();
  return db.findMany<Kudos>("kudos", {
    page: params.page || 1,
    limit: params.perPage || 20,
    sort: { field: "created_at", order: "desc" },
    filters: {
      organization_id: orgId,
      receiver_id: userId,
    },
  });
}

// ---------------------------------------------------------------------------
// getSentKudos — kudos sent by a specific user
// ---------------------------------------------------------------------------
export async function getSentKudos(
  orgId: number,
  userId: number,
  params: { page?: number; perPage?: number },
): Promise<QueryResult<Kudos>> {
  const db = getDB();
  return db.findMany<Kudos>("kudos", {
    page: params.page || 1,
    limit: params.perPage || 20,
    sort: { field: "created_at", order: "desc" },
    filters: {
      organization_id: orgId,
      sender_id: userId,
    },
  });
}

// ---------------------------------------------------------------------------
// getPublicFeed — public kudos feed ordered by created_at desc
// ---------------------------------------------------------------------------
export async function getPublicFeed(
  orgId: number,
  params: { page?: number; perPage?: number },
): Promise<QueryResult<Kudos>> {
  const db = getDB();
  return db.findMany<Kudos>("kudos", {
    page: params.page || 1,
    limit: params.perPage || 20,
    sort: { field: "created_at", order: "desc" },
    filters: {
      organization_id: orgId,
      visibility: KudosVisibility.PUBLIC,
    },
  });
}
