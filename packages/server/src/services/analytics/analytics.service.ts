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
    groupBy = "DATE_FORMAT(created_at, '%x-W%v')";
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
     LEFT JOIN empcloud.organization_departments d ON d.id = u.department_id AND d.organization_id = u.organization_id
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

// ---------------------------------------------------------------------------
// getManagerDashboard — recognition stats for a specific manager's team
// ---------------------------------------------------------------------------
export async function getManagerDashboard(orgId: number, managerId: number) {
  const db = getDB();

  // Get team members (users reporting to this manager)
  const [teamMembers] = await db.raw<any>(
    `SELECT id, first_name, last_name, email, designation
     FROM empcloud.users
     WHERE organization_id = ? AND reporting_to = ? AND status = 1`,
    [orgId, managerId],
  );

  const team = teamMembers || [];
  const teamSize = team.length;
  const teamUserIds = team.map((m: any) => m.id);

  if (teamSize === 0) {
    return {
      teamSize: 0,
      kudosGivenThisMonth: 0,
      teamKudosReceived: 0,
      engagementScore: 0,
      teamMembers: [],
      trends: [],
      orgAverageEngagement: 0,
    };
  }

  const placeholders = teamUserIds.map(() => "?").join(",");

  // Kudos given by the manager this month
  const [managerKudos] = await db.raw<any>(
    `SELECT COUNT(*) as count FROM kudos
     WHERE organization_id = ? AND sender_id = ?
       AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())`,
    [orgId, managerId],
  );
  const kudosGivenThisMonth = Number(managerKudos[0]?.count || 0);

  // Team kudos received this month
  const [teamReceived] = await db.raw<any>(
    `SELECT COUNT(*) as count FROM kudos
     WHERE organization_id = ? AND receiver_id IN (${placeholders})
       AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())`,
    [orgId, ...teamUserIds],
  );
  const teamKudosReceived = Number(teamReceived[0]?.count || 0);

  // Engagement score: kudos per employee per month (last 3 months average)
  const [engagementRows] = await db.raw<any>(
    `SELECT COUNT(*) as total_kudos FROM kudos
     WHERE organization_id = ?
       AND (sender_id IN (${placeholders}) OR receiver_id IN (${placeholders}))
       AND created_at >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)`,
    [orgId, ...teamUserIds, ...teamUserIds],
  );
  const totalKudos3m = Number(engagementRows[0]?.total_kudos || 0);
  const engagementScore = teamSize > 0 ? Math.round((totalKudos3m / teamSize / 3) * 10) / 10 : 0;

  // Individual team member stats
  const [memberStats] = await db.raw<any>(
    `SELECT
       u.id as user_id, u.first_name, u.last_name, u.designation,
       COALESCE(ks.sent, 0) as kudos_sent,
       COALESCE(kr.received, 0) as kudos_received
     FROM empcloud.users u
     LEFT JOIN (
       SELECT sender_id, COUNT(*) as sent FROM kudos
       WHERE organization_id = ? AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())
       GROUP BY sender_id
     ) ks ON ks.sender_id = u.id
     LEFT JOIN (
       SELECT receiver_id, COUNT(*) as received FROM kudos
       WHERE organization_id = ? AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())
       GROUP BY receiver_id
     ) kr ON kr.receiver_id = u.id
     WHERE u.organization_id = ? AND u.reporting_to = ? AND u.status = 1
     ORDER BY kudos_received DESC`,
    [orgId, orgId, orgId, managerId],
  );

  // Team engagement trend (last 6 months)
  const [trendRows] = await db.raw<any>(
    `SELECT
       DATE_FORMAT(k.created_at, '%Y-%m') as period,
       COUNT(*) as kudos_count
     FROM kudos k
     WHERE k.organization_id = ?
       AND (k.sender_id IN (${placeholders}) OR k.receiver_id IN (${placeholders}))
       AND k.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
     GROUP BY DATE_FORMAT(k.created_at, '%Y-%m')
     ORDER BY period ASC`,
    [orgId, ...teamUserIds, ...teamUserIds],
  );

  // Org-wide average engagement for comparison
  const [orgEngagement] = await db.raw<any>(
    `SELECT
       COUNT(DISTINCT k.id) as total_kudos,
       COUNT(DISTINCT u.id) as total_employees
     FROM empcloud.users u
     LEFT JOIN kudos k ON (k.sender_id = u.id OR k.receiver_id = u.id)
       AND k.organization_id = ? AND k.created_at >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
     WHERE u.organization_id = ? AND u.status = 1`,
    [orgId, orgId],
  );
  const orgTotalKudos = Number(orgEngagement[0]?.total_kudos || 0);
  const orgTotalEmployees = Number(orgEngagement[0]?.total_employees || 1);
  const orgAverageEngagement = Math.round((orgTotalKudos / orgTotalEmployees / 3) * 10) / 10;

  return {
    teamSize,
    kudosGivenThisMonth,
    teamKudosReceived,
    engagementScore,
    teamMembers: memberStats || [],
    trends: trendRows || [],
    orgAverageEngagement,
  };
}

// ---------------------------------------------------------------------------
// getManagerComparison — all managers ranked by team engagement score
// ---------------------------------------------------------------------------
export async function getManagerComparison(orgId: number) {
  const db = getDB();

  // Get all managers (users who have direct reports)
  const [managers] = await db.raw<any>(
    `SELECT DISTINCT
       m.id as manager_id,
       m.first_name,
       m.last_name,
       m.designation,
       COUNT(DISTINCT e.id) as team_size,
       COALESCE(k_data.team_kudos, 0) as team_kudos_3m
     FROM empcloud.users m
     JOIN empcloud.users e ON e.reporting_to = m.id AND e.organization_id = ? AND e.status = 1
     LEFT JOIN (
       SELECT
         u.reporting_to as mgr_id,
         COUNT(DISTINCT k.id) as team_kudos
       FROM empcloud.users u
       JOIN kudos k ON (k.sender_id = u.id OR k.receiver_id = u.id)
         AND k.organization_id = ? AND k.created_at >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
       WHERE u.organization_id = ? AND u.status = 1
       GROUP BY u.reporting_to
     ) k_data ON k_data.mgr_id = m.id
     WHERE m.organization_id = ? AND m.status = 1
     GROUP BY m.id, m.first_name, m.last_name, m.designation, k_data.team_kudos
     ORDER BY team_kudos_3m DESC`,
    [orgId, orgId, orgId, orgId],
  );

  return (managers || []).map((m: any, idx: number) => ({
    ...m,
    engagementScore: Number(m.team_size) > 0
      ? Math.round((Number(m.team_kudos_3m) / Number(m.team_size) / 3) * 10) / 10
      : 0,
    rank: idx + 1,
  }));
}
