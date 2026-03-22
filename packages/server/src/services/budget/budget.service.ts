// ============================================================================
// BUDGET SERVICE
// Manages recognition budgets — create, list, update, usage tracking.
// ============================================================================

import { v4 as uuidv4 } from "uuid";
import { getDB } from "../../db/adapters";
import { NotFoundError, AppError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import type { RecognitionBudget } from "@emp-rewards/shared";

// ---------------------------------------------------------------------------
// createBudget
// ---------------------------------------------------------------------------
export async function createBudget(
  orgId: number,
  data: {
    budget_type: string;
    owner_id: number;
    department_id?: number | null;
    period: string;
    total_amount: number;
    period_start: string;
    period_end: string;
  },
): Promise<RecognitionBudget> {
  const db = getDB();

  const budget = await db.create<RecognitionBudget>("recognition_budgets", {
    id: uuidv4(),
    organization_id: orgId,
    budget_type: data.budget_type,
    owner_id: data.owner_id,
    department_id: data.department_id || null,
    period: data.period,
    total_amount: data.total_amount,
    spent_amount: 0,
    remaining_amount: data.total_amount,
    period_start: data.period_start,
    period_end: data.period_end,
    is_active: true,
  } as any);

  logger.info(`Budget created: id=${budget.id} type=${data.budget_type} org=${orgId}`);
  return budget;
}

// ---------------------------------------------------------------------------
// listBudgets
// ---------------------------------------------------------------------------
export async function listBudgets(
  orgId: number,
  params: { page?: number; perPage?: number; budgetType?: string; isActive?: boolean } = {},
) {
  const db = getDB();
  const filters: Record<string, any> = { organization_id: orgId };

  if (params.budgetType) {
    filters.budget_type = params.budgetType;
  }
  if (params.isActive !== undefined) {
    filters.is_active = params.isActive ? 1 : 0;
  }

  return db.findMany<RecognitionBudget>("recognition_budgets", {
    page: params.page || 1,
    limit: params.perPage || 20,
    sort: { field: "created_at", order: "desc" },
    filters,
  });
}

// ---------------------------------------------------------------------------
// getBudget
// ---------------------------------------------------------------------------
export async function getBudget(orgId: number, id: string): Promise<RecognitionBudget> {
  const db = getDB();
  const budget = await db.findById<RecognitionBudget>("recognition_budgets", id);

  if (!budget || budget.organization_id !== orgId) {
    throw new NotFoundError("Budget", id);
  }

  return budget;
}

// ---------------------------------------------------------------------------
// updateBudget
// ---------------------------------------------------------------------------
export async function updateBudget(
  orgId: number,
  id: string,
  data: {
    total_amount?: number;
    period_start?: string;
    period_end?: string;
    is_active?: boolean;
  },
): Promise<RecognitionBudget> {
  const db = getDB();
  const existing = await getBudget(orgId, id);

  const updateData: Record<string, any> = {};
  if (data.total_amount !== undefined) {
    updateData.total_amount = data.total_amount;
    updateData.remaining_amount = data.total_amount - Number(existing.spent_amount);
  }
  if (data.period_start !== undefined) updateData.period_start = data.period_start;
  if (data.period_end !== undefined) updateData.period_end = data.period_end;
  if (data.is_active !== undefined) updateData.is_active = data.is_active;

  const updated = await db.update<RecognitionBudget>("recognition_budgets", id, updateData as any);
  logger.info(`Budget updated: id=${id} org=${orgId}`);
  return updated;
}

// ---------------------------------------------------------------------------
// getBudgetUsage — detailed spend breakdown
// ---------------------------------------------------------------------------
export async function getBudgetUsage(orgId: number, id: string) {
  const db = getDB();
  const budget = await getBudget(orgId, id);

  // Get point transactions that consumed this budget
  const [transactions] = await db.raw<any>(
    `SELECT
       pt.id,
       pt.user_id,
       pt.type,
       pt.amount,
       pt.description,
       pt.created_at,
       u.first_name,
       u.last_name
     FROM point_transactions pt
     LEFT JOIN empcloud.users u ON u.id = pt.user_id
     WHERE pt.organization_id = ? AND pt.reference_type = 'budget' AND pt.reference_id = ?
     ORDER BY pt.created_at DESC
     LIMIT 100`,
    [orgId, id],
  );

  return {
    budget,
    transactions: transactions || [],
    utilizationRate: Number(budget.total_amount) > 0
      ? Math.round((Number(budget.spent_amount) / Number(budget.total_amount)) * 100)
      : 0,
  };
}

// ---------------------------------------------------------------------------
// checkBudget — validate spend within limit before a transaction
// ---------------------------------------------------------------------------
export async function checkBudget(
  orgId: number,
  budgetType: string,
  referenceId: number,
  amount: number,
): Promise<{ allowed: boolean; remainingBudget: number; budgetId: string | null }> {
  const db = getDB();

  const filterCol = budgetType === "department" ? "department_id" : "owner_id";

  const [rows] = await db.raw<any>(
    `SELECT id, remaining_amount FROM recognition_budgets
     WHERE organization_id = ? AND budget_type = ? AND ${filterCol} = ?
       AND is_active = 1
       AND period_start <= CURDATE() AND period_end >= CURDATE()
     ORDER BY created_at DESC
     LIMIT 1`,
    [orgId, budgetType, referenceId],
  );

  if (!rows || rows.length === 0) {
    // No budget configured — allow by default
    return { allowed: true, remainingBudget: -1, budgetId: null };
  }

  const budget = rows[0];
  const remaining = Number(budget.remaining_amount);

  if (remaining < amount) {
    return { allowed: false, remainingBudget: remaining, budgetId: budget.id };
  }

  return { allowed: true, remainingBudget: remaining - amount, budgetId: budget.id };
}
