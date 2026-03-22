// ============================================================================
// BADGE SERVICE
// Manages badge definitions, awarding badges, and auto-badge evaluation.
// ============================================================================

import { v4 as uuidv4 } from "uuid";
import { getDB } from "../../db/adapters";
import { BadgeCriteriaType, PointTransactionType } from "@emp-rewards/shared";
import type { BadgeDefinition, UserBadge } from "@emp-rewards/shared";
import type { QueryResult } from "../../db/adapters/interface";
import { AppError, NotFoundError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import * as pointsService from "../points/points.service";

// ---------------------------------------------------------------------------
// createBadge
// ---------------------------------------------------------------------------
export async function createBadge(
  orgId: number,
  data: {
    name: string;
    description?: string | null;
    icon_url?: string | null;
    criteria_type: string;
    criteria_value?: number | null;
    points_awarded?: number;
    is_active?: boolean;
  },
): Promise<BadgeDefinition> {
  const db = getDB();
  const badge = await db.create<BadgeDefinition>("badge_definitions", {
    id: uuidv4(),
    organization_id: orgId,
    name: data.name,
    description: data.description || null,
    icon_url: data.icon_url || null,
    criteria_type: data.criteria_type,
    criteria_value: data.criteria_value ?? null,
    points_awarded: data.points_awarded ?? 0,
    is_active: data.is_active !== false,
  } as any);

  logger.info(`Badge created: id=${badge.id} org=${orgId} name=${data.name}`);
  return badge;
}

// ---------------------------------------------------------------------------
// listBadges
// ---------------------------------------------------------------------------
export async function listBadges(orgId: number): Promise<BadgeDefinition[]> {
  const db = getDB();
  const result = await db.findMany<BadgeDefinition>("badge_definitions", {
    limit: 100,
    sort: { field: "created_at", order: "asc" },
    filters: { organization_id: orgId, is_active: true },
  });
  return result.data;
}

// ---------------------------------------------------------------------------
// getBadge
// ---------------------------------------------------------------------------
export async function getBadge(orgId: number, id: string): Promise<BadgeDefinition> {
  const db = getDB();
  const badge = await db.findById<BadgeDefinition>("badge_definitions", id);

  if (!badge || badge.organization_id !== orgId) {
    throw new NotFoundError("Badge", id);
  }

  return badge;
}

// ---------------------------------------------------------------------------
// updateBadge
// ---------------------------------------------------------------------------
export async function updateBadge(
  orgId: number,
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    icon_url: string | null;
    criteria_type: string;
    criteria_value: number | null;
    points_awarded: number;
    is_active: boolean;
  }>,
): Promise<BadgeDefinition> {
  const db = getDB();
  const badge = await db.findById<BadgeDefinition>("badge_definitions", id);

  if (!badge || badge.organization_id !== orgId) {
    throw new NotFoundError("Badge", id);
  }

  const updated = await db.update<BadgeDefinition>("badge_definitions", id, data as any);
  logger.info(`Badge updated: id=${id} org=${orgId}`);
  return updated;
}

// ---------------------------------------------------------------------------
// deleteBadge — soft delete (set is_active = false)
// ---------------------------------------------------------------------------
export async function deleteBadge(orgId: number, id: string): Promise<void> {
  const db = getDB();
  const badge = await db.findById<BadgeDefinition>("badge_definitions", id);

  if (!badge || badge.organization_id !== orgId) {
    throw new NotFoundError("Badge", id);
  }

  await db.update("badge_definitions", id, { is_active: false });
  logger.info(`Badge soft-deleted: id=${id} org=${orgId}`);
}

// ---------------------------------------------------------------------------
// awardBadge — award to user + credit points
// ---------------------------------------------------------------------------
export async function awardBadge(
  orgId: number,
  userId: number,
  badgeId: string,
  awardedBy: number,
  note: string | null,
): Promise<UserBadge> {
  const db = getDB();

  // Verify badge exists and is active
  const badge = await db.findById<BadgeDefinition>("badge_definitions", badgeId);
  if (!badge || badge.organization_id !== orgId || !badge.is_active) {
    throw new NotFoundError("Badge", badgeId);
  }

  // Check if user already has this badge
  const existing = await db.findOne<UserBadge>("user_badges", {
    organization_id: orgId,
    user_id: userId,
    badge_id: badgeId,
  });
  if (existing) {
    throw new AppError(409, "BADGE_ALREADY_AWARDED", "User already has this badge");
  }

  // Create user badge record
  const userBadge = await db.create<UserBadge>("user_badges", {
    id: uuidv4(),
    organization_id: orgId,
    user_id: userId,
    badge_id: badgeId,
    awarded_by: awardedBy,
    awarded_reason: note,
  } as any);

  // Credit points if badge has points_awarded
  if (badge.points_awarded > 0) {
    await pointsService.earnPoints(
      orgId,
      userId,
      badge.points_awarded,
      PointTransactionType.ACHIEVEMENT,
      "badge",
      badgeId,
      `Badge earned: ${badge.name}`,
    );
  }

  logger.info(`Badge awarded: badge=${badgeId} user=${userId} org=${orgId} by=${awardedBy}`);
  return userBadge;
}

// ---------------------------------------------------------------------------
// getUserBadges
// ---------------------------------------------------------------------------
export async function getUserBadges(orgId: number, userId: number): Promise<UserBadge[]> {
  const db = getDB();
  const result = await db.findMany<UserBadge>("user_badges", {
    limit: 100,
    sort: { field: "created_at", order: "desc" },
    filters: { organization_id: orgId, user_id: userId },
  });
  return result.data;
}

// ---------------------------------------------------------------------------
// evaluateAutoBadges — check all auto-criteria badges, award if qualified
// ---------------------------------------------------------------------------
export async function evaluateAutoBadges(orgId: number, userId: number): Promise<UserBadge[]> {
  const db = getDB();
  const awarded: UserBadge[] = [];

  // Get all active auto-criteria badges for the org
  const [badges] = await db.raw<any>(
    `SELECT * FROM badge_definitions
     WHERE organization_id = ? AND is_active = 1 AND criteria_type != ?`,
    [orgId, BadgeCriteriaType.MANUAL],
  );

  if (!badges || badges.length === 0) return awarded;

  // Get user's existing badges
  const [existingBadges] = await db.raw<any>(
    `SELECT badge_id FROM user_badges WHERE organization_id = ? AND user_id = ?`,
    [orgId, userId],
  );
  const existingBadgeIds = new Set((existingBadges || []).map((b: any) => b.badge_id));

  for (const badge of badges) {
    if (existingBadgeIds.has(badge.id)) continue;

    let qualifies = false;
    const criteriaValue = badge.criteria_value || 0;

    switch (badge.criteria_type) {
      case BadgeCriteriaType.AUTO_KUDOS_COUNT: {
        const [rows] = await db.raw<any>(
          `SELECT COUNT(*) as count FROM kudos
           WHERE organization_id = ? AND receiver_id = ?`,
          [orgId, userId],
        );
        qualifies = Number(rows[0]?.count || 0) >= criteriaValue;
        break;
      }

      case BadgeCriteriaType.AUTO_POINTS: {
        const balance = await db.findOne<any>("point_balances", {
          organization_id: orgId,
          user_id: userId,
        });
        qualifies = Number(balance?.total_earned || 0) >= criteriaValue;
        break;
      }

      case BadgeCriteriaType.AUTO_KUDOS_STREAK: {
        // Count consecutive days with at least one kudos sent
        const [rows] = await db.raw<any>(
          `SELECT DISTINCT DATE(created_at) as kudos_date FROM kudos
           WHERE organization_id = ? AND sender_id = ?
           ORDER BY kudos_date DESC LIMIT ?`,
          [orgId, userId, criteriaValue + 5],
        );
        if (rows && rows.length >= criteriaValue) {
          let streak = 1;
          for (let i = 1; i < rows.length; i++) {
            const prev = new Date(rows[i - 1].kudos_date);
            const curr = new Date(rows[i].kudos_date);
            const diffDays = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
            if (Math.round(diffDays) === 1) {
              streak++;
              if (streak >= criteriaValue) break;
            } else {
              break;
            }
          }
          qualifies = streak >= criteriaValue;
        }
        break;
      }

      case BadgeCriteriaType.AUTO_TENURE: {
        // Tenure check would need user's join date from empcloud
        // Skip for now — requires cross-DB join
        break;
      }
    }

    if (qualifies) {
      try {
        const userBadge = await awardBadge(orgId, userId, badge.id, 0, "Auto-awarded");
        awarded.push(userBadge);
      } catch {
        // Already awarded or other error — skip
      }
    }
  }

  return awarded;
}
