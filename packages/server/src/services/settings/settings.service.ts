// ============================================================================
// SETTINGS SERVICE
// Manages recognition settings and categories for an organization.
// ============================================================================

import { v4 as uuidv4 } from "uuid";
import { getDB } from "../../db/adapters";
import { NotFoundError, AppError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import type { RecognitionSettings, RecognitionCategory } from "@emp-rewards/shared";

// ---------------------------------------------------------------------------
// getSettings
// ---------------------------------------------------------------------------
export async function getSettings(orgId: number): Promise<RecognitionSettings> {
  const db = getDB();
  let settings = await db.findOne<RecognitionSettings>("recognition_settings", {
    organization_id: orgId,
  });

  // Auto-create default settings if none exist
  if (!settings) {
    settings = await db.create<RecognitionSettings>("recognition_settings", {
      id: uuidv4(),
      organization_id: orgId,
      points_per_kudos: 10,
      max_kudos_per_day: 5,
      allow_self_kudos: false,
      allow_anonymous_kudos: true,
      default_visibility: "public",
      points_currency_name: "Points",
      require_category: false,
      require_message: true,
    } as any);
    logger.info(`Default recognition settings created for org=${orgId}`);
  }

  return settings;
}

// ---------------------------------------------------------------------------
// updateSettings
// ---------------------------------------------------------------------------
export async function updateSettings(
  orgId: number,
  data: {
    points_per_kudos?: number;
    max_kudos_per_day?: number;
    allow_self_kudos?: boolean;
    allow_anonymous_kudos?: boolean;
    default_visibility?: string;
    points_currency_name?: string;
    require_category?: boolean;
    require_message?: boolean;
  },
): Promise<RecognitionSettings> {
  const db = getDB();
  const existing = await getSettings(orgId);

  const updated = await db.update<RecognitionSettings>("recognition_settings", existing.id, data as any);
  logger.info(`Recognition settings updated for org=${orgId}`);
  return updated;
}

// ---------------------------------------------------------------------------
// getCategories
// ---------------------------------------------------------------------------
export async function getCategories(
  orgId: number,
  params: { includeInactive?: boolean } = {},
): Promise<RecognitionCategory[]> {
  const db = getDB();
  const filters: Record<string, any> = { organization_id: orgId };

  if (!params.includeInactive) {
    filters.is_active = 1;
  }

  const result = await db.findMany<RecognitionCategory>("recognition_categories", {
    page: 1,
    limit: 100,
    sort: { field: "sort_order", order: "asc" },
    filters,
  });

  return result.data;
}

// ---------------------------------------------------------------------------
// createCategory
// ---------------------------------------------------------------------------
export async function createCategory(
  orgId: number,
  data: {
    name: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    points_multiplier?: number;
    sort_order?: number;
  },
): Promise<RecognitionCategory> {
  const db = getDB();

  // Get max sort_order for this org
  const categories = await getCategories(orgId, { includeInactive: true });
  const maxOrder = categories.reduce((max, c) => Math.max(max, c.sort_order || 0), 0);

  const category = await db.create<RecognitionCategory>("recognition_categories", {
    id: uuidv4(),
    organization_id: orgId,
    name: data.name,
    description: data.description || null,
    icon: data.icon || null,
    color: data.color || null,
    points_multiplier: data.points_multiplier ?? 1,
    is_active: true,
    sort_order: data.sort_order ?? maxOrder + 1,
  } as any);

  logger.info(`Category created: id=${category.id} name=${data.name} org=${orgId}`);
  return category;
}

// ---------------------------------------------------------------------------
// updateCategory
// ---------------------------------------------------------------------------
export async function updateCategory(
  orgId: number,
  id: string,
  data: {
    name?: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    points_multiplier?: number;
    is_active?: boolean;
    sort_order?: number;
  },
): Promise<RecognitionCategory> {
  const db = getDB();
  const existing = await db.findById<RecognitionCategory>("recognition_categories", id);

  if (!existing || existing.organization_id !== orgId) {
    throw new NotFoundError("Category", id);
  }

  const updated = await db.update<RecognitionCategory>("recognition_categories", id, data as any);
  logger.info(`Category updated: id=${id} org=${orgId}`);
  return updated;
}

// ---------------------------------------------------------------------------
// deleteCategory — soft delete (set is_active = false)
// ---------------------------------------------------------------------------
export async function deleteCategory(orgId: number, id: string): Promise<void> {
  const db = getDB();
  const existing = await db.findById<RecognitionCategory>("recognition_categories", id);

  if (!existing || existing.organization_id !== orgId) {
    throw new NotFoundError("Category", id);
  }

  await db.update("recognition_categories", id, { is_active: false } as any);
  logger.info(`Category deactivated: id=${id} org=${orgId}`);
}
