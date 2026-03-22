// ============================================================================
// CHALLENGE SERVICE
// Manages team/individual challenges, participation, progress, and completion.
// ============================================================================

import { v4 as uuidv4 } from "uuid";
import { getDB } from "../../db/adapters";
import { PointTransactionType } from "@emp-rewards/shared";
import type { QueryResult } from "../../db/adapters/interface";
import { AppError, NotFoundError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import * as pointsService from "../points/points.service";
import * as badgeService from "../badge/badge.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Challenge {
  id: string;
  organization_id: number;
  title: string;
  description: string | null;
  type: "individual" | "team" | "department";
  metric: "kudos_sent" | "kudos_received" | "points_earned" | "badges_earned";
  target_value: number;
  start_date: string;
  end_date: string;
  reward_points: number;
  reward_badge_id: string | null;
  status: "upcoming" | "active" | "completed" | "cancelled";
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  user_id: number;
  current_value: number;
  rank: number | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  // Joined fields
  first_name?: string;
  last_name?: string;
  designation?: string;
}

// ---------------------------------------------------------------------------
// createChallenge
// ---------------------------------------------------------------------------
export async function createChallenge(
  orgId: number,
  data: {
    title: string;
    description?: string | null;
    type: string;
    metric: string;
    target_value: number;
    start_date: string;
    end_date: string;
    reward_points?: number;
    reward_badge_id?: string | null;
    created_by: number;
  },
): Promise<Challenge> {
  const db = getDB();

  // Determine initial status based on dates
  const now = new Date().toISOString().slice(0, 10);
  let status: Challenge["status"] = "upcoming";
  if (data.start_date <= now && data.end_date >= now) {
    status = "active";
  }

  const challenge = await db.create<Challenge>("challenges", {
    id: uuidv4(),
    organization_id: orgId,
    title: data.title,
    description: data.description || null,
    type: data.type,
    metric: data.metric,
    target_value: data.target_value,
    start_date: data.start_date,
    end_date: data.end_date,
    reward_points: data.reward_points ?? 0,
    reward_badge_id: data.reward_badge_id || null,
    status,
    created_by: data.created_by,
  } as any);

  logger.info(`Challenge created: id=${challenge.id} org=${orgId} title=${data.title}`);
  return challenge;
}

// ---------------------------------------------------------------------------
// listChallenges — filtered by status
// ---------------------------------------------------------------------------
export async function listChallenges(
  orgId: number,
  params: { status?: string; page?: number; perPage?: number },
): Promise<QueryResult<Challenge>> {
  const db = getDB();
  const filters: Record<string, any> = { organization_id: orgId };
  if (params.status) {
    filters.status = params.status;
  }

  return db.findMany<Challenge>("challenges", {
    page: params.page || 1,
    limit: params.perPage || 20,
    sort: { field: "start_date", order: "desc" },
    filters,
  });
}

// ---------------------------------------------------------------------------
// getChallenge — with participants and leaderboard
// ---------------------------------------------------------------------------
export async function getChallenge(
  orgId: number,
  id: string,
): Promise<{ challenge: Challenge; participants: ChallengeParticipant[]; participantCount: number }> {
  const db = getDB();
  const challenge = await db.findById<Challenge>("challenges", id);

  if (!challenge || challenge.organization_id !== orgId) {
    throw new NotFoundError("Challenge", id);
  }

  const [participants] = await db.raw<any>(
    `SELECT cp.*, u.first_name, u.last_name, u.designation
     FROM challenge_participants cp
     LEFT JOIN empcloud.users u ON u.id = cp.user_id
     WHERE cp.challenge_id = ?
     ORDER BY cp.current_value DESC, cp.completed_at ASC`,
    [id],
  );

  const participantCount = (participants || []).length;

  return {
    challenge,
    participants: participants || [],
    participantCount,
  };
}

// ---------------------------------------------------------------------------
// joinChallenge
// ---------------------------------------------------------------------------
export async function joinChallenge(
  orgId: number,
  challengeId: string,
  userId: number,
): Promise<ChallengeParticipant> {
  const db = getDB();

  // Verify challenge exists, belongs to org, and is active or upcoming
  const challenge = await db.findById<Challenge>("challenges", challengeId);
  if (!challenge || challenge.organization_id !== orgId) {
    throw new NotFoundError("Challenge", challengeId);
  }
  if (challenge.status !== "active" && challenge.status !== "upcoming") {
    throw new AppError(400, "CHALLENGE_NOT_JOINABLE", "This challenge is no longer accepting participants");
  }

  // Check if already joined
  const existing = await db.findOne<ChallengeParticipant>("challenge_participants", {
    challenge_id: challengeId,
    user_id: userId,
  });
  if (existing) {
    throw new AppError(409, "ALREADY_JOINED", "You have already joined this challenge");
  }

  const participant = await db.create<ChallengeParticipant>("challenge_participants", {
    id: uuidv4(),
    challenge_id: challengeId,
    user_id: userId,
    current_value: 0,
    rank: null,
    completed: false,
    completed_at: null,
  } as any);

  logger.info(`User joined challenge: challenge=${challengeId} user=${userId} org=${orgId}`);
  return participant;
}

// ---------------------------------------------------------------------------
// updateProgress — recalculate all participants' progress from actual data
// ---------------------------------------------------------------------------
export async function updateProgress(orgId: number, challengeId: string): Promise<void> {
  const db = getDB();

  const challenge = await db.findById<Challenge>("challenges", challengeId);
  if (!challenge || challenge.organization_id !== orgId) {
    throw new NotFoundError("Challenge", challengeId);
  }

  // Get all participants
  const [participants] = await db.raw<any>(
    `SELECT * FROM challenge_participants WHERE challenge_id = ?`,
    [challengeId],
  );

  if (!participants || participants.length === 0) return;

  const startDate = challenge.start_date;
  const endDate = challenge.end_date;

  for (const p of participants) {
    let currentValue = 0;

    switch (challenge.metric) {
      case "kudos_sent": {
        const [rows] = await db.raw<any>(
          `SELECT COUNT(*) as count FROM kudos
           WHERE organization_id = ? AND sender_id = ?
             AND DATE(created_at) >= ? AND DATE(created_at) <= ?`,
          [orgId, p.user_id, startDate, endDate],
        );
        currentValue = Number(rows[0]?.count || 0);
        break;
      }
      case "kudos_received": {
        const [rows] = await db.raw<any>(
          `SELECT COUNT(*) as count FROM kudos
           WHERE organization_id = ? AND receiver_id = ?
             AND DATE(created_at) >= ? AND DATE(created_at) <= ?`,
          [orgId, p.user_id, startDate, endDate],
        );
        currentValue = Number(rows[0]?.count || 0);
        break;
      }
      case "points_earned": {
        const [rows] = await db.raw<any>(
          `SELECT COALESCE(SUM(amount), 0) as total FROM point_transactions
           WHERE organization_id = ? AND user_id = ? AND amount > 0
             AND DATE(created_at) >= ? AND DATE(created_at) <= ?`,
          [orgId, p.user_id, startDate, endDate],
        );
        currentValue = Number(rows[0]?.total || 0);
        break;
      }
      case "badges_earned": {
        const [rows] = await db.raw<any>(
          `SELECT COUNT(*) as count FROM user_badges
           WHERE organization_id = ? AND user_id = ?
             AND DATE(created_at) >= ? AND DATE(created_at) <= ?`,
          [orgId, p.user_id, startDate, endDate],
        );
        currentValue = Number(rows[0]?.count || 0);
        break;
      }
    }

    const completed = currentValue >= challenge.target_value;
    const completedAt = completed && !p.completed ? new Date().toISOString() : p.completed_at;

    await db.raw(
      `UPDATE challenge_participants
       SET current_value = ?, completed = ?, completed_at = ?
       WHERE id = ?`,
      [currentValue, completed ? 1 : 0, completedAt, p.id],
    );
  }

  // Recalculate ranks
  await db.raw(
    `SET @rank = 0;
     UPDATE challenge_participants cp
     SET cp.rank = (@rank := @rank + 1)
     WHERE cp.challenge_id = ?
     ORDER BY cp.current_value DESC, cp.completed_at ASC`,
    [challengeId],
  );

  logger.info(`Challenge progress updated: challenge=${challengeId} org=${orgId}`);
}

// ---------------------------------------------------------------------------
// completeChallenge — finalize, award points/badges to winners
// ---------------------------------------------------------------------------
export async function completeChallenge(orgId: number, challengeId: string): Promise<void> {
  const db = getDB();

  const challenge = await db.findById<Challenge>("challenges", challengeId);
  if (!challenge || challenge.organization_id !== orgId) {
    throw new NotFoundError("Challenge", challengeId);
  }
  if (challenge.status === "completed") {
    throw new AppError(400, "ALREADY_COMPLETED", "This challenge has already been completed");
  }

  // Refresh progress one last time
  await updateProgress(orgId, challengeId);

  // Get completed participants (those who met the target)
  const [completedParticipants] = await db.raw<any>(
    `SELECT * FROM challenge_participants
     WHERE challenge_id = ? AND completed = 1
     ORDER BY \`rank\` ASC`,
    [challengeId],
  );

  // Award points and badges to completed participants
  for (const p of completedParticipants || []) {
    if (challenge.reward_points > 0) {
      try {
        await pointsService.earnPoints(
          orgId,
          p.user_id,
          challenge.reward_points,
          PointTransactionType.ACHIEVEMENT,
          "challenge",
          challengeId,
          `Challenge completed: ${challenge.title}`,
        );
      } catch (err) {
        logger.warn(`Failed to award challenge points to user=${p.user_id}: ${err}`);
      }
    }

    if (challenge.reward_badge_id) {
      try {
        await badgeService.awardBadge(orgId, p.user_id, challenge.reward_badge_id, 0, `Challenge completed: ${challenge.title}`);
      } catch {
        // Badge may already be awarded — skip
      }
    }
  }

  // Mark challenge as completed
  await db.update("challenges", challengeId, { status: "completed" } as any);

  logger.info(`Challenge completed: challenge=${challengeId} org=${orgId} winners=${(completedParticipants || []).length}`);
}

// ---------------------------------------------------------------------------
// getChallengeLeaderboard
// ---------------------------------------------------------------------------
export async function getChallengeLeaderboard(
  orgId: number,
  challengeId: string,
): Promise<ChallengeParticipant[]> {
  const db = getDB();

  const challenge = await db.findById<Challenge>("challenges", challengeId);
  if (!challenge || challenge.organization_id !== orgId) {
    throw new NotFoundError("Challenge", challengeId);
  }

  const [rows] = await db.raw<any>(
    `SELECT cp.*, u.first_name, u.last_name, u.designation
     FROM challenge_participants cp
     LEFT JOIN empcloud.users u ON u.id = cp.user_id
     WHERE cp.challenge_id = ?
     ORDER BY cp.current_value DESC, cp.completed_at ASC`,
    [challengeId],
  );

  return rows || [];
}
