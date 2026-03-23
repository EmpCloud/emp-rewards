// ============================================================================
// MILESTONE SERVICE
// Manages automated milestone rules, achievement checking, and rewards.
// ============================================================================

import { v4 as uuidv4 } from "uuid";
import { getDB } from "../../db/adapters";
import { PointTransactionType } from "@emp-rewards/shared";
import { AppError, NotFoundError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import * as pointsService from "../points/points.service";
import * as badgeService from "../badge/badge.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface MilestoneRule {
  id: string;
  organization_id: number;
  name: string;
  description: string | null;
  trigger_type: "work_anniversary" | "kudos_count" | "points_total" | "badges_count" | "referral_hired" | "first_kudos";
  trigger_value: number;
  reward_points: number;
  reward_badge_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface MilestoneAchievement {
  id: string;
  organization_id: number;
  user_id: number;
  milestone_rule_id: string;
  achieved_at: string;
  points_awarded: number;
  // Joined fields
  rule_name?: string;
  rule_description?: string;
  trigger_type?: string;
  trigger_value?: number;
}

// ---------------------------------------------------------------------------
// createRule
// ---------------------------------------------------------------------------
export async function createRule(
  orgId: number,
  data: {
    name: string;
    description?: string | null;
    trigger_type: string;
    trigger_value: number;
    reward_points?: number;
    reward_badge_id?: string | null;
    is_active?: boolean;
  },
): Promise<MilestoneRule> {
  const db = getDB();

  const rule = await db.create<MilestoneRule>("milestone_rules", {
    id: uuidv4(),
    organization_id: orgId,
    name: data.name,
    description: data.description || null,
    trigger_type: data.trigger_type,
    trigger_value: data.trigger_value,
    reward_points: data.reward_points ?? 0,
    reward_badge_id: data.reward_badge_id || null,
    is_active: data.is_active !== false,
  } as any);

  logger.info(`Milestone rule created: id=${rule.id} org=${orgId} name=${data.name}`);
  return rule;
}

// ---------------------------------------------------------------------------
// listRules
// ---------------------------------------------------------------------------
export async function listRules(orgId: number): Promise<MilestoneRule[]> {
  const db = getDB();
  const result = await db.findMany<MilestoneRule>("milestone_rules", {
    limit: 100,
    sort: { field: "created_at", order: "asc" },
    filters: { organization_id: orgId },
  });
  return result.data;
}

// ---------------------------------------------------------------------------
// updateRule
// ---------------------------------------------------------------------------
export async function updateRule(
  orgId: number,
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    trigger_type: string;
    trigger_value: number;
    reward_points: number;
    reward_badge_id: string | null;
    is_active: boolean;
  }>,
): Promise<MilestoneRule> {
  const db = getDB();
  const rule = await db.findById<MilestoneRule>("milestone_rules", id);

  if (!rule || rule.organization_id !== orgId) {
    throw new NotFoundError("Milestone rule", id);
  }

  const updated = await db.update<MilestoneRule>("milestone_rules", id, data as any);
  logger.info(`Milestone rule updated: id=${id} org=${orgId}`);
  return updated;
}

// ---------------------------------------------------------------------------
// deleteRule
// ---------------------------------------------------------------------------
export async function deleteRule(orgId: number, id: string): Promise<void> {
  const db = getDB();
  const rule = await db.findById<MilestoneRule>("milestone_rules", id);

  if (!rule || rule.organization_id !== orgId) {
    throw new NotFoundError("Milestone rule", id);
  }

  await db.delete("milestone_rules", id);
  logger.info(`Milestone rule deleted: id=${id} org=${orgId}`);
}

// ---------------------------------------------------------------------------
// checkMilestones — evaluate all rules against user's current stats
// ---------------------------------------------------------------------------
export async function checkMilestones(
  orgId: number,
  userId: number,
): Promise<MilestoneAchievement[]> {
  const db = getDB();
  const awarded: MilestoneAchievement[] = [];

  // Get active rules for the org
  const [rules] = await db.raw<any>(
    `SELECT * FROM milestone_rules WHERE organization_id = ? AND is_active = 1`,
    [orgId],
  );

  if (!rules || rules.length === 0) return awarded;

  // Get user's existing achievements
  const [existing] = await db.raw<any>(
    `SELECT milestone_rule_id FROM milestone_achievements
     WHERE organization_id = ? AND user_id = ?`,
    [orgId, userId],
  );
  const achievedRuleIds = new Set((existing || []).map((a: any) => a.milestone_rule_id));

  for (const rule of rules) {
    if (achievedRuleIds.has(rule.id)) continue;

    let qualifies = false;

    switch (rule.trigger_type) {
      case "kudos_count": {
        const [rows] = await db.raw<any>(
          `SELECT COUNT(*) as count FROM kudos
           WHERE organization_id = ? AND receiver_id = ?`,
          [orgId, userId],
        );
        qualifies = Number(rows[0]?.count || 0) >= rule.trigger_value;
        break;
      }

      case "points_total": {
        const balance = await db.findOne<any>("point_balances", {
          organization_id: orgId,
          user_id: userId,
        });
        qualifies = Number(balance?.total_earned || 0) >= rule.trigger_value;
        break;
      }

      case "badges_count": {
        const [rows] = await db.raw<any>(
          `SELECT COUNT(*) as count FROM user_badges
           WHERE organization_id = ? AND user_id = ?`,
          [orgId, userId],
        );
        qualifies = Number(rows[0]?.count || 0) >= rule.trigger_value;
        break;
      }

      case "first_kudos": {
        // Trigger if user has sent at least 1 kudos (trigger_value is typically 1)
        const [rows] = await db.raw<any>(
          `SELECT COUNT(*) as count FROM kudos
           WHERE organization_id = ? AND sender_id = ?`,
          [orgId, userId],
        );
        qualifies = Number(rows[0]?.count || 0) >= (rule.trigger_value || 1);
        break;
      }

      case "work_anniversary": {
        // Check user's join date from empcloud.users
        const [rows] = await db.raw<any>(
          `SELECT created_at FROM empcloud.users WHERE id = ? AND organization_id = ?`,
          [userId, orgId],
        );
        if (rows && rows[0]) {
          const joinDate = new Date(rows[0].created_at);
          const now = new Date();
          const yearsWorked = Math.floor(
            (now.getTime() - joinDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
          );
          qualifies = yearsWorked >= rule.trigger_value;
        }
        break;
      }

      case "referral_hired": {
        // Referral tracking not available in rewards DB — skip
        break;
      }
    }

    if (qualifies) {
      try {
        const achievement = await db.create<MilestoneAchievement>("milestone_achievements", {
          id: uuidv4(),
          organization_id: orgId,
          user_id: userId,
          milestone_rule_id: rule.id,
          points_awarded: rule.reward_points,
        } as any);

        // Award points
        if (rule.reward_points > 0) {
          await pointsService.earnPoints(
            orgId,
            userId,
            rule.reward_points,
            PointTransactionType.MILESTONE,
            "milestone",
            rule.id,
            `Milestone achieved: ${rule.name}`,
          );
        }

        // Award badge
        if (rule.reward_badge_id) {
          try {
            await badgeService.awardBadge(orgId, userId, rule.reward_badge_id, 0, `Milestone: ${rule.name}`);
          } catch {
            // Badge may already be awarded — skip
          }
        }

        awarded.push(achievement);
        logger.info(`Milestone achieved: rule=${rule.id} user=${userId} org=${orgId} name=${rule.name}`);

        // Notify EMP Cloud about the milestone achievement (non-blocking)
        const webhookUrl = process.env.EMPCLOUD_WEBHOOK_URL;
        if (webhookUrl) {
          fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "rewards.milestone_achieved",
              data: {
                employeeId: userId,
                milestoneName: rule.name,
                pointsAwarded: rule.reward_points,
              },
              source: "emp-rewards",
              timestamp: new Date().toISOString(),
            }),
          }).catch(() => {}); // fire-and-forget
        }
      } catch (err: any) {
        // Duplicate or other error — skip
        if (err.code !== "ER_DUP_ENTRY") {
          logger.warn(`Failed to award milestone: rule=${rule.id} user=${userId}: ${err.message}`);
        }
      }
    }
  }

  return awarded;
}

// ---------------------------------------------------------------------------
// getUserAchievements
// ---------------------------------------------------------------------------
export async function getUserAchievements(
  orgId: number,
  userId: number,
): Promise<MilestoneAchievement[]> {
  const db = getDB();

  const [rows] = await db.raw<any>(
    `SELECT ma.*, mr.name as rule_name, mr.description as rule_description,
            mr.trigger_type, mr.trigger_value
     FROM milestone_achievements ma
     JOIN milestone_rules mr ON mr.id = ma.milestone_rule_id
     WHERE ma.organization_id = ? AND ma.user_id = ?
     ORDER BY ma.achieved_at DESC`,
    [orgId, userId],
  );

  return rows || [];
}
