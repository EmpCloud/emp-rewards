// ============================================================================
// LEADERBOARD SERVICE
// Computes and retrieves leaderboard rankings from kudos/points data.
// ============================================================================

import { v4 as uuidv4 } from "uuid";
import { getDB } from "../../db/adapters";
import { getEmpCloudDB } from "../../db/empcloud";
import { logger } from "../../utils/logger";
import type { LeaderboardPeriod } from "@emp-rewards/shared";

interface LeaderboardRow {
  user_id: number;
  rank: number;
  total_points: number;
  kudos_received: number;
  kudos_sent: number;
  badges_earned: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  designation?: string;
  department_id?: number | null;
}

interface LeaderboardResult {
  entries: LeaderboardRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Issue #19 — period_key was being stored on snapshots and used to scope
// the leaderboard, but the kudos / badge count subqueries had no date
// filter. So a "weekly" leaderboard showed all-time kudos sent / received,
// which was wrong. Convert (periodType, periodKey) to a date range and
// pass an extra optional date predicate into each count subquery.
//
// All-time => returns null => no date filter => behaviour unchanged.
//
// Returned bounds are half-open: [start, end). Empty period_key (or "all")
// short-circuits to all-time.
// ---------------------------------------------------------------------------
function periodToDateRange(periodType: string, periodKey: string): { start: Date; end: Date } | null {
  if (!periodKey || periodKey === "all" || periodType === "all_time") return null;

  // weekly: "2026-W17"
  const weeklyMatch = /^(\d{4})-W(\d{2})$/.exec(periodKey);
  if (weeklyMatch) {
    const year = Number(weeklyMatch[1]);
    const week = Number(weeklyMatch[2]);
    // Approx: same algorithm as getCurrentPeriodKey in routes — Jan 1 + (week-1)*7 days,
    // walked back to that week's Sunday so the range is monday..sunday.
    const startOfYear = new Date(year, 0, 1);
    const start = new Date(startOfYear);
    start.setDate(startOfYear.getDate() + (week - 1) * 7 - startOfYear.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }

  // monthly: "2026-04"
  const monthlyMatch = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (monthlyMatch) {
    const year = Number(monthlyMatch[1]);
    const month = Number(monthlyMatch[2]); // 1..12
    return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
  }

  // quarterly: "2026-Q2"
  const quarterlyMatch = /^(\d{4})-Q([1-4])$/.exec(periodKey);
  if (quarterlyMatch) {
    const year = Number(quarterlyMatch[1]);
    const q = Number(quarterlyMatch[2]); // 1..4
    const startMonth = (q - 1) * 3;
    return { start: new Date(year, startMonth, 1), end: new Date(year, startMonth + 3, 1) };
  }

  // yearly: "2026"
  const yearlyMatch = /^(\d{4})$/.exec(periodKey);
  if (yearlyMatch) {
    const year = Number(yearlyMatch[1]);
    return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
  }

  return null; // unknown shape — treat as all-time so we don't accidentally hide everything
}

// Points source for the ranking. All-time uses the cumulative point_balances
// balance; a specific period sums positive point_transactions within the range,
// so the leaderboard actually changes when the period selector changes.
function buildPeriodPoints(range: { start: Date; end: Date } | null): {
  select: string;
  join: string;
  params: any[];
} {
  if (!range) {
    return { select: "pb.total_earned", join: "", params: [] };
  }
  return {
    select: "COALESCE(ptp.earned, 0)",
    join: `LEFT JOIN (
             SELECT user_id, SUM(amount) as earned
             FROM point_transactions
             WHERE amount > 0 AND created_at >= ? AND created_at < ?
             GROUP BY user_id
           ) ptp ON ptp.user_id = pb.user_id`,
    params: [range.start, range.end],
  };
}

// ---------------------------------------------------------------------------
// getLeaderboard — paginated leaderboard for a period
// ---------------------------------------------------------------------------
export async function getLeaderboard(
  orgId: number,
  periodType: string,
  periodKey: string,
  params: { page?: number; perPage?: number } = {},
): Promise<LeaderboardResult> {
  const db = getDB();
  const page = params.page || 1;
  const perPage = params.perPage || 20;
  const offset = (page - 1) * perPage;

  // Try to read from snapshots first
  const [snapshotRows] = await db.raw<any>(
    `SELECT ls.*, u.first_name, u.last_name, u.email, u.designation, u.department_id
     FROM leaderboard_snapshots ls
     LEFT JOIN empcloud.users u ON u.id = ls.user_id
     WHERE ls.organization_id = ? AND ls.period = ? AND ls.period_key = ?
     ORDER BY ls.rank ASC
     LIMIT ? OFFSET ?`,
    [orgId, periodType, periodKey, perPage, offset],
  );

  const [countResult] = await db.raw<any>(
    `SELECT COUNT(*) as total FROM leaderboard_snapshots
     WHERE organization_id = ? AND period = ? AND period_key = ?`,
    [orgId, periodType, periodKey],
  );
  const total = Number(countResult[0]?.total || 0);

  // If no snapshots, compute live from points
  if (total === 0) {
    return computeLiveLeaderboard(orgId, periodType, periodKey, page, perPage);
  }

  return {
    entries: snapshotRows || [],
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

// ---------------------------------------------------------------------------
// getDepartmentLeaderboard
// ---------------------------------------------------------------------------
export async function getDepartmentLeaderboard(
  orgId: number,
  departmentId: number,
  periodType: string,
  periodKey: string,
): Promise<LeaderboardRow[]> {
  const db = getDB();

  const [rows] = await db.raw<any>(
    `SELECT ls.*, u.first_name, u.last_name, u.email, u.designation, u.department_id
     FROM leaderboard_snapshots ls
     LEFT JOIN empcloud.users u ON u.id = ls.user_id
     WHERE ls.organization_id = ? AND ls.period = ? AND ls.period_key = ?
       AND u.department_id = ?
     ORDER BY ls.rank ASC
     LIMIT 50`,
    [orgId, periodType, periodKey, departmentId],
  );

  if (!rows || rows.length === 0) {
    // Compute live for department
    // #19 — apply the same period-aware date filter as the global path.
    const range = periodToDateRange(periodType, periodKey);
    const dateClause = range ? `AND created_at >= ? AND created_at < ?` : "";
    const dateParams: any[] = range ? [range.start, range.end] : [];
    const [liveRows] = await db.raw<any>(
      `SELECT
         pb.user_id,
         pb.total_earned as total_points,
         COALESCE(kr.cnt, 0) as kudos_received,
         COALESCE(ks.cnt, 0) as kudos_sent,
         COALESCE(be.cnt, 0) as badges_earned,
         u.first_name, u.last_name, u.email, u.designation, u.department_id
       FROM point_balances pb
       LEFT JOIN empcloud.users u ON u.id = pb.user_id
       LEFT JOIN (SELECT receiver_id, COUNT(*) as cnt FROM kudos WHERE organization_id = ? ${dateClause} GROUP BY receiver_id) kr ON kr.receiver_id = pb.user_id
       LEFT JOIN (SELECT sender_id, COUNT(*) as cnt FROM kudos WHERE organization_id = ? ${dateClause} GROUP BY sender_id) ks ON ks.sender_id = pb.user_id
       LEFT JOIN (SELECT user_id, COUNT(*) as cnt FROM user_badges WHERE organization_id = ? ${dateClause} GROUP BY user_id) be ON be.user_id = pb.user_id
       WHERE pb.organization_id = ? AND u.department_id = ? AND u.status = 1
       ORDER BY pb.total_earned DESC
       LIMIT 50`,
      [orgId, ...dateParams, orgId, ...dateParams, orgId, ...dateParams, orgId, departmentId],
    );

    return (liveRows || []).map((row: any, idx: number) => ({
      ...row,
      rank: idx + 1,
    }));
  }

  return rows;
}

// ---------------------------------------------------------------------------
// getMyRank — current user's rank in the leaderboard
// ---------------------------------------------------------------------------
export async function getMyRank(
  orgId: number,
  userId: number,
  periodType: string,
  periodKey: string,
): Promise<{ rank: number; total_points: number; kudos_received: number; kudos_sent: number; badges_earned: number; totalParticipants: number }> {
  const db = getDB();

  const [rows] = await db.raw<any>(
    `SELECT \`rank\`, total_points, kudos_received, kudos_sent, badges_earned
     FROM leaderboard_snapshots
     WHERE organization_id = ? AND period = ? AND period_key = ? AND user_id = ?`,
    [orgId, periodType, periodKey, userId],
  );

  const [countResult] = await db.raw<any>(
    `SELECT COUNT(*) as total FROM leaderboard_snapshots
     WHERE organization_id = ? AND period = ? AND period_key = ?`,
    [orgId, periodType, periodKey],
  );

  if (rows && rows.length > 0) {
    return {
      ...rows[0],
      totalParticipants: Number(countResult[0]?.total || 0),
    };
  }

  // Compute live rank — period-aware, matching computeLiveLeaderboard so the
  // "Your Rank" card lines up with the table for the selected period.
  const range = periodToDateRange(periodType, periodKey);
  const pts = buildPeriodPoints(range);
  const [pointRows] = await db.raw<any>(
    `SELECT pb.user_id, ${pts.select} as points
     FROM point_balances pb
     ${pts.join}
     WHERE pb.organization_id = ?
     ORDER BY points DESC`,
    [...pts.params, orgId],
  );

  const allUsers = pointRows || [];
  const myIdx = allUsers.findIndex((r: any) => Number(r.user_id) === Number(userId));

  return {
    rank: myIdx >= 0 ? myIdx + 1 : 0,
    total_points: myIdx >= 0 ? Number(allUsers[myIdx].points) : 0,
    kudos_received: 0,
    kudos_sent: 0,
    badges_earned: 0,
    totalParticipants: allUsers.length,
  };
}

// ---------------------------------------------------------------------------
// refreshLeaderboard — compute rankings and upsert into leaderboard_snapshots
// ---------------------------------------------------------------------------
export async function refreshLeaderboard(
  orgId: number,
  periodType: string,
  periodKey: string,
): Promise<void> {
  const db = getDB();

  // Compute rankings from points and kudos data
  // #19 — apply period-aware date filter so weekly / monthly / quarterly /
  // yearly snapshots persist counts that match the period selector.
  const range = periodToDateRange(periodType, periodKey);
  const dateClause = range ? `AND created_at >= ? AND created_at < ?` : "";
  const dateParams: any[] = range ? [range.start, range.end] : [];
  const [rows] = await db.raw<any>(
    `SELECT
       pb.user_id,
       pb.total_earned as total_points,
       COALESCE(kr.cnt, 0) as kudos_received,
       COALESCE(ks.cnt, 0) as kudos_sent,
       COALESCE(be.cnt, 0) as badges_earned
     FROM point_balances pb
     LEFT JOIN empcloud.users u ON u.id = pb.user_id
     LEFT JOIN (SELECT receiver_id, COUNT(*) as cnt FROM kudos WHERE organization_id = ? ${dateClause} GROUP BY receiver_id) kr ON kr.receiver_id = pb.user_id
     LEFT JOIN (SELECT sender_id, COUNT(*) as cnt FROM kudos WHERE organization_id = ? ${dateClause} GROUP BY sender_id) ks ON ks.sender_id = pb.user_id
     LEFT JOIN (SELECT user_id, COUNT(*) as cnt FROM user_badges WHERE organization_id = ? ${dateClause} GROUP BY user_id) be ON be.user_id = pb.user_id
     WHERE pb.organization_id = ? AND u.status = 1
     ORDER BY pb.total_earned DESC`,
    [orgId, ...dateParams, orgId, ...dateParams, orgId, ...dateParams, orgId],
  );

  if (!rows || rows.length === 0) {
    logger.info(`No leaderboard data to refresh for org=${orgId} period=${periodType}/${periodKey}`);
    return;
  }

  // Delete existing snapshots for this period
  await db.raw(
    `DELETE FROM leaderboard_snapshots WHERE organization_id = ? AND period = ? AND period_key = ?`,
    [orgId, periodType, periodKey],
  );

  // Insert new rankings
  const now = new Date();
  const records = rows.map((row: any, idx: number) => ({
    id: uuidv4(),
    organization_id: orgId,
    user_id: row.user_id,
    period: periodType,
    period_key: periodKey,
    rank: idx + 1,
    total_points: Number(row.total_points),
    kudos_received: Number(row.kudos_received),
    kudos_sent: Number(row.kudos_sent),
    badges_earned: Number(row.badges_earned),
    created_at: now,
    updated_at: now,
  }));

  // Batch insert
  for (let i = 0; i < records.length; i += 500) {
    const batch = records.slice(i, i + 500);
    const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const values = batch.flatMap((r: any) => [
      r.id, r.organization_id, r.user_id, r.period, r.period_key,
      r.rank, r.total_points, r.kudos_received, r.kudos_sent, r.badges_earned,
      r.created_at, r.updated_at,
    ]);
    await db.raw(
      `INSERT INTO leaderboard_snapshots
       (id, organization_id, user_id, period, period_key, \`rank\`, total_points, kudos_received, kudos_sent, badges_earned, created_at, updated_at)
       VALUES ${placeholders}`,
      values,
    );
  }

  logger.info(`Leaderboard refreshed: org=${orgId} period=${periodType}/${periodKey} entries=${records.length}`);
}

// ---------------------------------------------------------------------------
// Helper: compute live leaderboard without snapshots
// ---------------------------------------------------------------------------
async function computeLiveLeaderboard(
  orgId: number,
  periodType: string,
  periodKey: string,
  page: number,
  perPage: number,
): Promise<LeaderboardResult> {
  const db = getDB();
  const offset = (page - 1) * perPage;

  // #19 — Build date-bounded count subqueries for the selected period.
  const range = periodToDateRange(periodType, periodKey);
  const dateClause = range ? `AND created_at >= ? AND created_at < ?` : "";
  const dateParams: any[] = range ? [range.start, range.end] : [];

  // For a specific period, rank by points EARNED within that period (summed
  // from point_transactions), not the all-time balance — otherwise every
  // period shows the same ranking. All-time keeps using the cumulative balance.
  const pts = buildPeriodPoints(range);

  const [rows] = await db.raw<any>(
    `SELECT
       pb.user_id,
       ${pts.select} as total_points,
       COALESCE(kr.cnt, 0) as kudos_received,
       COALESCE(ks.cnt, 0) as kudos_sent,
       COALESCE(be.cnt, 0) as badges_earned,
       u.first_name, u.last_name, u.email, u.designation, u.department_id
     FROM point_balances pb
     LEFT JOIN empcloud.users u ON u.id = pb.user_id
     ${pts.join}
     LEFT JOIN (SELECT receiver_id, COUNT(*) as cnt FROM kudos WHERE organization_id = ? ${dateClause} GROUP BY receiver_id) kr ON kr.receiver_id = pb.user_id
     LEFT JOIN (SELECT sender_id, COUNT(*) as cnt FROM kudos WHERE organization_id = ? ${dateClause} GROUP BY sender_id) ks ON ks.sender_id = pb.user_id
     LEFT JOIN (SELECT user_id, COUNT(*) as cnt FROM user_badges WHERE organization_id = ? ${dateClause} GROUP BY user_id) be ON be.user_id = pb.user_id
     WHERE pb.organization_id = ? AND u.status = 1
     ORDER BY total_points DESC
     LIMIT ? OFFSET ?`,
    [...pts.params, orgId, ...dateParams, orgId, ...dateParams, orgId, ...dateParams, orgId, perPage, offset],
  );

  const [countResult] = await db.raw<any>(
    `SELECT COUNT(*) as total FROM point_balances pb
     LEFT JOIN empcloud.users u ON u.id = pb.user_id
     WHERE pb.organization_id = ? AND u.status = 1`,
    [orgId],
  );
  const total = Number(countResult[0]?.total || 0);

  const entries = (rows || []).map((row: any, idx: number) => ({
    ...row,
    rank: offset + idx + 1,
  }));

  return {
    entries,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}
