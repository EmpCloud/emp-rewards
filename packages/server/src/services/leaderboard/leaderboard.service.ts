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
       LEFT JOIN (SELECT receiver_id, COUNT(*) as cnt FROM kudos WHERE organization_id = ? GROUP BY receiver_id) kr ON kr.receiver_id = pb.user_id
       LEFT JOIN (SELECT sender_id, COUNT(*) as cnt FROM kudos WHERE organization_id = ? GROUP BY sender_id) ks ON ks.sender_id = pb.user_id
       LEFT JOIN (SELECT user_id, COUNT(*) as cnt FROM user_badges WHERE organization_id = ? GROUP BY user_id) be ON be.user_id = pb.user_id
       WHERE pb.organization_id = ? AND u.department_id = ? AND u.status = 1
       ORDER BY pb.total_earned DESC
       LIMIT 50`,
      [orgId, orgId, orgId, orgId, departmentId],
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
    `SELECT rank, total_points, kudos_received, kudos_sent, badges_earned
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

  // Compute live rank
  const [pointRows] = await db.raw<any>(
    `SELECT user_id, total_earned FROM point_balances
     WHERE organization_id = ?
     ORDER BY total_earned DESC`,
    [orgId],
  );

  const allUsers = pointRows || [];
  const myIdx = allUsers.findIndex((r: any) => r.user_id === userId);

  return {
    rank: myIdx >= 0 ? myIdx + 1 : 0,
    total_points: myIdx >= 0 ? Number(allUsers[myIdx].total_earned) : 0,
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
  const [rows] = await db.raw<any>(
    `SELECT
       pb.user_id,
       pb.total_earned as total_points,
       COALESCE(kr.cnt, 0) as kudos_received,
       COALESCE(ks.cnt, 0) as kudos_sent,
       COALESCE(be.cnt, 0) as badges_earned
     FROM point_balances pb
     LEFT JOIN empcloud.users u ON u.id = pb.user_id
     LEFT JOIN (SELECT receiver_id, COUNT(*) as cnt FROM kudos WHERE organization_id = ? GROUP BY receiver_id) kr ON kr.receiver_id = pb.user_id
     LEFT JOIN (SELECT sender_id, COUNT(*) as cnt FROM kudos WHERE organization_id = ? GROUP BY sender_id) ks ON ks.sender_id = pb.user_id
     LEFT JOIN (SELECT user_id, COUNT(*) as cnt FROM user_badges WHERE organization_id = ? GROUP BY user_id) be ON be.user_id = pb.user_id
     WHERE pb.organization_id = ? AND u.status = 1
     ORDER BY pb.total_earned DESC`,
    [orgId, orgId, orgId, orgId],
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
       (id, organization_id, user_id, period, period_key, rank, total_points, kudos_received, kudos_sent, badges_earned, created_at, updated_at)
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

  const [rows] = await db.raw<any>(
    `SELECT
       pb.user_id,
       pb.total_earned as total_points,
       COALESCE(kr.cnt, 0) as kudos_received,
       COALESCE(ks.cnt, 0) as kudos_sent,
       COALESCE(be.cnt, 0) as badges_earned,
       u.first_name, u.last_name, u.email, u.designation, u.department_id
     FROM point_balances pb
     LEFT JOIN empcloud.users u ON u.id = pb.user_id
     LEFT JOIN (SELECT receiver_id, COUNT(*) as cnt FROM kudos WHERE organization_id = ? GROUP BY receiver_id) kr ON kr.receiver_id = pb.user_id
     LEFT JOIN (SELECT sender_id, COUNT(*) as cnt FROM kudos WHERE organization_id = ? GROUP BY sender_id) ks ON ks.sender_id = pb.user_id
     LEFT JOIN (SELECT user_id, COUNT(*) as cnt FROM user_badges WHERE organization_id = ? GROUP BY user_id) be ON be.user_id = pb.user_id
     WHERE pb.organization_id = ? AND u.status = 1
     ORDER BY pb.total_earned DESC
     LIMIT ? OFFSET ?`,
    [orgId, orgId, orgId, orgId, perPage, offset],
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
