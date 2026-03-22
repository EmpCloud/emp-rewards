// ============================================================================
// ANALYTICS SERVICE
// Recognition analytics: overview stats, trends, breakdowns, top users.
// ============================================================================

import { getDB } from "../../db/adapters";
import { logger } from "../../utils/logger";

// ---------------------------------------------------------------------------
// getOverview — high-level stats
// ---------------------------------------------------------------------------
export async function getOverview(orgId: number) {
  const db = getDB();

  const [kudosCount] = await db.raw<any>(
    `SELECT COUNT(*) as total FROM kudos WHERE organization_id = ?`,
    [orgId],
  );

  const [pointsDistributed] = await db.raw<any>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM point_transactions
     WHERE organization_id = ? AND amount > 0`,
    [orgId],
  );

  const [badgesAwarded] = await db.raw<any>(
    `SELECT COUNT(*) as total FROM user_badges WHERE organization_id = ?`,
    [orgId],
  );

  const [activePrograms] = await db.raw<any>(
    `SELECT COUNT(*) as total FROM nomination_programs
     WHERE organization_id = ? AND is_active = 1`,
    [orgId],
  );

  const [redemptions] = await db.raw<any>(
    `SELECT COUNT(*) as total FROM reward_redemptions WHERE organization_id = ?`,
    [orgId],
  );

  const [pointsRedeemed] = await db.raw<any>(
    `SELECT COALESCE(SUM(points_spent), 0) as total FROM reward_redemptions
     WHERE organization_id = ? AND status != 'cancelled'`,
    [orgId],
  );

  return {
    totalKudos: Number(kudosCount[0]?.total || 0),
    pointsDistributed: Number(pointsDistributed[0]?.total || 0),
    badgesAwarded: Number(badgesAwarded[0]?.total || 0),
    activePrograms: Number(activePrograms[0]?.total || 0),
    totalRedemptions: Number(redemptions[0]?.total || 0),
    pointsRedeemed: Number(pointsRedeemed[0]?.total || 0),
  };
}

// ---------------------------------------------------------------------------
// getTrends — kudos per week/month over time
// ---------------------------------------------------------------------------
export async function getTrends(orgId: number, params: { interval?: string; months?: number } = {}) {
  const db = getDB();
  const interval = params.interval || "week";
  const months = params.months || 6;

  let dateFormat: string;
  let groupBy: string;
  if (interval === "month") {
    dateFormat = "%Y-%m";
    groupBy = "DATE_FORMAT(created_at, '%Y-%m')";
  } else {
    dateFormat = "%x-W%v";
    groupBy = "YEARWEEK(created_at, 1)";
  }

  const [rows] = await db.raw<any>(
    `SELECT
       DATE_FORMAT(created_at, '${dateFormat}') as period,
       COUNT(*) as kudos_count,
       COALESCE(SUM(points), 0) as points_total
     FROM kudos
     WHERE organization_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
     GROUP BY ${groupBy}
     ORDER BY MIN(created_at) ASC`,
    [orgId, months],
  );

  return rows || [];
}

// ---------------------------------------------------------------------------
// getCategoryBreakdown — kudos by category
// ---------------------------------------------------------------------------
export async function getCategoryBreakdown(orgId: number) {
  const db = getDB();

  const [rows] = await db.raw<any>(
    `SELECT
       rc.id,
       rc.name,
       rc.icon,
       rc.color,
       COUNT(k.id) as kudos_count,
       COALESCE(SUM(k.points), 0) as points_total
     FROM recognition_categories rc
     LEFT JOIN kudos k ON k.category_id = rc.id AND k.organization_id = rc.organization_id
     WHERE rc.organization_id = ? AND rc.is_active = 1
     GROUP BY rc.id, rc.name, rc.icon, rc.color
     ORDER BY kudos_count DESC`,
    [orgId],
  );

  return rows || [];
}

// ---------------------------------------------------------------------------
// getDepartmentParticipation — participation rates per department
// ---------------------------------------------------------------------------
export async function getDepartmentParticipation(orgId: number) {
  const db = getDB();

  const [rows] = await db.raw<any>(
    `SELECT
       u.department_id,
       COALESCE(d.name, 'No Department') as department_name,
       COUNT(DISTINCT u.id) as total_employees,
       COUNT(DISTINCT k.sender_id) as active_senders,
       COUNT(DISTINCT k.receiver_id) as active_receivers,
       COUNT(k.id) as total_kudos
     FROM empcloud.users u
     LEFT JOIN empcloud.departments d ON d.id = u.department_id
     LEFT JOIN kudos k ON (k.sender_id = u.id OR k.receiver_id = u.id) AND k.organization_id = ?
     WHERE u.organization_id = ? AND u.status = 1
     GROUP BY u.department_id, d.name
     ORDER BY total_kudos DESC`,
    [orgId, orgId],
  );

  return (rows || []).map((row: any) => ({
    ...row,
    participationRate: row.total_employees > 0
      ? Math.round(((Number(row.active_senders) + Number(row.active_receivers)) / (Number(row.total_employees) * 2)) * 100)
      : 0,
  }));
}

// ---------------------------------------------------------------------------
// getTopRecognizers — top kudos senders
// ---------------------------------------------------------------------------
export async function getTopRecognizers(orgId: number, limit = 10) {
  const db = getDB();

  const [rows] = await db.raw<any>(
    `SELECT
       k.sender_id as user_id,
       u.first_name,
       u.last_name,
       u.email,
       u.designation,
       COUNT(*) as kudos_count,
       COALESCE(SUM(k.points), 0) as points_given
     FROM kudos k
     LEFT JOIN empcloud.users u ON u.id = k.sender_id
     WHERE k.organization_id = ? AND k.is_anonymous = 0
     GROUP BY k.sender_id, u.first_name, u.last_name, u.email, u.designation
     ORDER BY kudos_count DESC
     LIMIT ?`,
    [orgId, limit],
  );

  return rows || [];
}

// ---------------------------------------------------------------------------
// getTopRecognized — top kudos receivers
// ---------------------------------------------------------------------------
export async function getTopRecognized(orgId: number, limit = 10) {
  const db = getDB();

  const [rows] = await db.raw<any>(
    `SELECT
       k.receiver_id as user_id,
       u.first_name,
       u.last_name,
       u.email,
       u.designation,
       COUNT(*) as kudos_count,
       COALESCE(SUM(k.points), 0) as points_earned
     FROM kudos k
     LEFT JOIN empcloud.users u ON u.id = k.receiver_id
     WHERE k.organization_id = ?
     GROUP BY k.receiver_id, u.first_name, u.last_name, u.email, u.designation
     ORDER BY kudos_count DESC
     LIMIT ?`,
    [orgId, limit],
  );

  return rows || [];
}

// ---------------------------------------------------------------------------
// getBudgetUtilization — budget spend vs allocation
// ---------------------------------------------------------------------------
export async function getBudgetUtilization(orgId: number) {
  const db = getDB();

  const [rows] = await db.raw<any>(
    `SELECT
       budget_type,
       period,
       SUM(total_amount) as total_allocated,
       SUM(spent_amount) as total_spent,
       SUM(remaining_amount) as total_remaining
     FROM recognition_budgets
     WHERE organization_id = ? AND is_active = 1
     GROUP BY budget_type, period`,
    [orgId],
  );

  const totalAllocated = (rows || []).reduce((sum: number, r: any) => sum + Number(r.total_allocated), 0);
  const totalSpent = (rows || []).reduce((sum: number, r: any) => sum + Number(r.total_spent), 0);

  return {
    byType: rows || [],
    totalAllocated,
    totalSpent,
    totalRemaining: totalAllocated - totalSpent,
    utilizationRate: totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0,
  };
}
