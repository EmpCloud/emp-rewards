// ============================================================================
// CELEBRATION SERVICE
// Detects birthdays and work anniversaries from empcloud user data and
// manages celebration records + wishes.
// ============================================================================

import { v4 as uuidv4 } from "uuid";
import { getEmpCloudDB, type EmpCloudUser } from "../../db/empcloud";
import { getDB } from "../../db/adapters";
import type { QueryResult } from "../../db/adapters/interface";
import { NotFoundError } from "../../utils/errors";
import { logger } from "../../utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CelebrationType =
  | "birthday"
  | "work_anniversary"
  | "new_joiner"
  | "promotion"
  | "custom";

export interface Celebration {
  id: string;
  organization_id: number;
  user_id: number;
  type: CelebrationType;
  title: string;
  description: string | null;
  celebration_date: string;
  metadata: Record<string, any> | null;
  is_auto_generated: boolean;
  created_at: string;
  // Joined fields (populated in feed queries)
  first_name?: string;
  last_name?: string;
  email?: string;
  designation?: string;
  wish_count?: number;
}

export interface CelebrationWish {
  id: string;
  celebration_id: string;
  user_id: number;
  message: string;
  created_at: string;
  // Joined
  first_name?: string;
  last_name?: string;
}

// ---------------------------------------------------------------------------
// getTodaysBirthdays
// ---------------------------------------------------------------------------
export async function getTodaysBirthdays(orgId: number): Promise<EmpCloudUser[]> {
  const empcloud = getEmpCloudDB();
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const users = await empcloud("users")
    .where({
      organization_id: orgId,
      status: 1,
    })
    .whereRaw("MONTH(date_of_birth) = ?", [month])
    .whereRaw("DAY(date_of_birth) = ?", [day])
    .whereNotNull("date_of_birth");

  return users;
}

// ---------------------------------------------------------------------------
// getTodaysAnniversaries
// ---------------------------------------------------------------------------
export async function getTodaysAnniversaries(orgId: number): Promise<EmpCloudUser[]> {
  const empcloud = getEmpCloudDB();
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const users = await empcloud("users")
    .where({
      organization_id: orgId,
      status: 1,
    })
    .whereRaw("MONTH(date_of_joining) = ?", [month])
    .whereRaw("DAY(date_of_joining) = ?", [day])
    .whereRaw("YEAR(date_of_joining) < YEAR(NOW())")
    .whereNotNull("date_of_joining");

  return users;
}

// ---------------------------------------------------------------------------
// getUpcomingBirthdays
// ---------------------------------------------------------------------------
export async function getUpcomingBirthdays(
  orgId: number,
  days: number = 7,
): Promise<EmpCloudUser[]> {
  const empcloud = getEmpCloudDB();

  // Use a date range approach: compare MONTH/DAY against current date + N days
  const users = await empcloud("users")
    .where({
      organization_id: orgId,
      status: 1,
    })
    .whereNotNull("date_of_birth")
    .whereRaw(
      `DAYOFYEAR(CONCAT(YEAR(NOW()), '-', MONTH(date_of_birth), '-', DAY(date_of_birth)))
       BETWEEN DAYOFYEAR(NOW()) + 1 AND DAYOFYEAR(NOW()) + ?`,
      [days],
    );

  return users;
}

// ---------------------------------------------------------------------------
// getUpcomingAnniversaries
// ---------------------------------------------------------------------------
export async function getUpcomingAnniversaries(
  orgId: number,
  days: number = 7,
): Promise<EmpCloudUser[]> {
  const empcloud = getEmpCloudDB();

  const users = await empcloud("users")
    .where({
      organization_id: orgId,
      status: 1,
    })
    .whereNotNull("date_of_joining")
    .whereRaw("YEAR(date_of_joining) < YEAR(NOW())")
    .whereRaw(
      `DAYOFYEAR(CONCAT(YEAR(NOW()), '-', MONTH(date_of_joining), '-', DAY(date_of_joining)))
       BETWEEN DAYOFYEAR(NOW()) + 1 AND DAYOFYEAR(NOW()) + ?`,
      [days],
    );

  return users;
}

// ---------------------------------------------------------------------------
// createCelebration — insert a celebration record
// ---------------------------------------------------------------------------
export async function createCelebration(data: {
  organization_id: number;
  user_id: number;
  type: CelebrationType;
  title: string;
  description?: string | null;
  celebration_date: string;
  metadata?: Record<string, any> | null;
  is_auto_generated?: boolean;
}): Promise<Celebration> {
  const db = getDB();
  const celebration = await db.create<Celebration>("celebrations", {
    id: uuidv4(),
    organization_id: data.organization_id,
    user_id: data.user_id,
    type: data.type,
    title: data.title,
    description: data.description || null,
    celebration_date: data.celebration_date,
    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    is_auto_generated: data.is_auto_generated ?? true,
  } as any);

  logger.info(
    `Celebration created: id=${celebration.id} type=${data.type} user=${data.user_id} org=${data.organization_id}`,
  );

  return celebration;
}

// ---------------------------------------------------------------------------
// getTodayCelebrations — today's celebrations from DB
// ---------------------------------------------------------------------------
export async function getTodayCelebrations(orgId: number): Promise<Celebration[]> {
  const db = getDB();
  const today = new Date().toISOString().slice(0, 10);

  const [rows] = await db.raw<any>(
    `SELECT c.*, u.first_name, u.last_name, u.email, u.designation,
       (SELECT COUNT(*) FROM celebration_wishes w WHERE w.celebration_id = c.id) as wish_count
     FROM celebrations c
     LEFT JOIN empcloud.users u ON u.id = c.user_id
     WHERE c.organization_id = ? AND c.celebration_date = ?
     ORDER BY c.type ASC, c.created_at DESC`,
    [orgId, today],
  );

  return rows || [];
}

// ---------------------------------------------------------------------------
// getUpcomingCelebrations — next N days
// ---------------------------------------------------------------------------
export async function getUpcomingCelebrations(
  orgId: number,
  days: number = 7,
): Promise<Celebration[]> {
  const db = getDB();
  const today = new Date().toISOString().slice(0, 10);

  const [rows] = await db.raw<any>(
    `SELECT c.*, u.first_name, u.last_name, u.email, u.designation,
       (SELECT COUNT(*) FROM celebration_wishes w WHERE w.celebration_id = c.id) as wish_count
     FROM celebrations c
     LEFT JOIN empcloud.users u ON u.id = c.user_id
     WHERE c.organization_id = ?
       AND c.celebration_date > ?
       AND c.celebration_date <= DATE_ADD(?, INTERVAL ? DAY)
     ORDER BY c.celebration_date ASC, c.type ASC`,
    [orgId, today, today, days],
  );

  return rows || [];
}

// ---------------------------------------------------------------------------
// getCelebrationFeed — unified: today's celebrations + recent kudos (7 days)
// ---------------------------------------------------------------------------
export async function getCelebrationFeed(
  orgId: number,
  params: { page?: number; perPage?: number } = {},
): Promise<{ items: any[]; total: number; page: number; perPage: number; totalPages: number }> {
  const db = getDB();
  const page = params.page || 1;
  const perPage = params.perPage || 20;
  const offset = (page - 1) * perPage;

  // Get celebration items from last 7 days
  const [celebrationRows] = await db.raw<any>(
    `SELECT c.id, c.organization_id, c.user_id, c.type as item_type, c.title,
       c.description, c.celebration_date as item_date, c.metadata,
       c.is_auto_generated, c.created_at,
       u.first_name, u.last_name, u.email, u.designation,
       (SELECT COUNT(*) FROM celebration_wishes w WHERE w.celebration_id = c.id) as wish_count
     FROM celebrations c
     LEFT JOIN empcloud.users u ON u.id = c.user_id
     WHERE c.organization_id = ?
       AND c.celebration_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       AND c.celebration_date <= NOW()
     ORDER BY c.celebration_date DESC, c.created_at DESC`,
    [orgId],
  );

  // Get recent kudos from last 7 days
  const [kudosRows] = await db.raw<any>(
    `SELECT k.id, k.organization_id, k.sender_id, k.receiver_id,
       'kudos' as item_type, k.message as title, k.message as description,
       DATE(k.created_at) as item_date, k.points, k.visibility,
       k.is_anonymous, k.created_at,
       su.first_name as sender_first_name, su.last_name as sender_last_name,
       ru.first_name as receiver_first_name, ru.last_name as receiver_last_name,
       ru.designation as receiver_designation
     FROM kudos k
     LEFT JOIN empcloud.users su ON su.id = k.sender_id
     LEFT JOIN empcloud.users ru ON ru.id = k.receiver_id
     WHERE k.organization_id = ?
       AND k.visibility = 'public'
       AND k.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     ORDER BY k.created_at DESC`,
    [orgId],
  );

  // Combine and sort by date
  const celebrations = (celebrationRows || []).map((c: any) => ({
    ...c,
    feed_type: c.item_type,
    sort_date: c.created_at,
  }));

  const kudos = (kudosRows || []).map((k: any) => ({
    ...k,
    feed_type: "kudos",
    sort_date: k.created_at,
  }));

  const combined = [...celebrations, ...kudos].sort(
    (a, b) => new Date(b.sort_date).getTime() - new Date(a.sort_date).getTime(),
  );

  const total = combined.length;
  const paginatedItems = combined.slice(offset, offset + perPage);

  return {
    items: paginatedItems,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

// ---------------------------------------------------------------------------
// getCelebrationById
// ---------------------------------------------------------------------------
export async function getCelebrationById(
  orgId: number,
  id: string,
): Promise<Celebration> {
  const db = getDB();

  const [rows] = await db.raw<any>(
    `SELECT c.*, u.first_name, u.last_name, u.email, u.designation,
       (SELECT COUNT(*) FROM celebration_wishes w WHERE w.celebration_id = c.id) as wish_count
     FROM celebrations c
     LEFT JOIN empcloud.users u ON u.id = c.user_id
     WHERE c.id = ? AND c.organization_id = ?`,
    [id, orgId],
  );

  if (!rows || rows.length === 0) {
    throw new NotFoundError("Celebration", id);
  }

  return rows[0];
}

// ---------------------------------------------------------------------------
// sendWish — send a wish on a celebration
// ---------------------------------------------------------------------------
export async function sendWish(
  orgId: number,
  celebrationId: string,
  userId: number,
  message: string,
): Promise<CelebrationWish> {
  const db = getDB();

  // Verify celebration exists and belongs to org
  await getCelebrationById(orgId, celebrationId);

  const wish = await db.create<CelebrationWish>("celebration_wishes", {
    id: uuidv4(),
    celebration_id: celebrationId,
    user_id: userId,
    message,
  } as any);

  logger.info(
    `Celebration wish sent: celebration=${celebrationId} from user=${userId}`,
  );

  return wish;
}

// ---------------------------------------------------------------------------
// getWishes — list wishes for a celebration
// ---------------------------------------------------------------------------
export async function getWishes(
  orgId: number,
  celebrationId: string,
): Promise<CelebrationWish[]> {
  const db = getDB();

  // Verify celebration exists
  await getCelebrationById(orgId, celebrationId);

  const [rows] = await db.raw<any>(
    `SELECT w.*, u.first_name, u.last_name
     FROM celebration_wishes w
     LEFT JOIN empcloud.users u ON u.id = w.user_id
     WHERE w.celebration_id = ?
     ORDER BY w.created_at ASC`,
    [celebrationId],
  );

  return rows || [];
}

// ---------------------------------------------------------------------------
// generateTodayCelebrations — auto-detect and create celebration records
// Called by the daily job.
// ---------------------------------------------------------------------------
export async function generateTodayCelebrations(orgId: number): Promise<{
  birthdays: number;
  anniversaries: number;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const db = getDB();

  // Check if we already generated today's celebrations for this org
  const existingCount = await db.count("celebrations", {
    organization_id: orgId,
    celebration_date: today,
    is_auto_generated: true,
  });

  if (existingCount > 0) {
    logger.info(`Celebrations already generated for org=${orgId} date=${today}`);
    return { birthdays: 0, anniversaries: 0 };
  }

  // Fetch birthdays
  const birthdayUsers = await getTodaysBirthdays(orgId);
  for (const user of birthdayUsers) {
    await createCelebration({
      organization_id: orgId,
      user_id: user.id,
      type: "birthday",
      title: `Happy Birthday, ${user.first_name} ${user.last_name}!`,
      description: `Wishing ${user.first_name} a wonderful birthday!`,
      celebration_date: today,
      is_auto_generated: true,
    });
  }

  // Fetch anniversaries
  const anniversaryUsers = await getTodaysAnniversaries(orgId);
  for (const user of anniversaryUsers) {
    const joiningDate = new Date(user.date_of_joining!);
    const years = new Date().getFullYear() - joiningDate.getFullYear();
    await createCelebration({
      organization_id: orgId,
      user_id: user.id,
      type: "work_anniversary",
      title: `Celebrating ${years} year${years !== 1 ? "s" : ""} — ${user.first_name} ${user.last_name}!`,
      description: `Congratulations to ${user.first_name} on ${years} year${years !== 1 ? "s" : ""} with the organization!`,
      celebration_date: today,
      metadata: { years },
      is_auto_generated: true,
    });
  }

  logger.info(
    `Generated celebrations for org=${orgId}: ${birthdayUsers.length} birthdays, ${anniversaryUsers.length} anniversaries`,
  );

  return {
    birthdays: birthdayUsers.length,
    anniversaries: anniversaryUsers.length,
  };
}
