// ============================================================================
// POINTS SERVICE
// Manages point balances, transactions, earn/spend/adjust operations.
// ============================================================================

import { v4 as uuidv4 } from "uuid";
import { getDB } from "../../db/adapters";
import { PointTransactionType } from "@emp-rewards/shared";
import type { PointBalance, PointTransaction } from "@emp-rewards/shared";
import type { QueryResult } from "../../db/adapters/interface";
import { AppError, NotFoundError } from "../../utils/errors";
import { logger } from "../../utils/logger";

// ---------------------------------------------------------------------------
// getBalance
// ---------------------------------------------------------------------------
export async function getBalance(orgId: number, userId: number): Promise<PointBalance> {
  const db = getDB();
  const balance = await db.findOne<PointBalance>("point_balances", {
    organization_id: orgId,
    user_id: userId,
  });

  if (!balance) {
    // Auto-create a zero balance row
    const newBalance = await db.create<PointBalance>("point_balances", {
      id: uuidv4(),
      organization_id: orgId,
      user_id: userId,
      total_earned: 0,
      total_redeemed: 0,
      current_balance: 0,
    } as any);
    return newBalance;
  }

  return balance;
}

// ---------------------------------------------------------------------------
// getTransactions
// ---------------------------------------------------------------------------
export async function getTransactions(
  orgId: number,
  userId: number,
  params: { page?: number; perPage?: number },
): Promise<QueryResult<PointTransaction>> {
  const db = getDB();
  return db.findMany<PointTransaction>("point_transactions", {
    page: params.page || 1,
    limit: params.perPage || 20,
    sort: { field: "created_at", order: "desc" },
    filters: {
      organization_id: orgId,
      user_id: userId,
    },
  });
}

// ---------------------------------------------------------------------------
// earnPoints — atomically credit points
// ---------------------------------------------------------------------------
export async function earnPoints(
  orgId: number,
  userId: number,
  amount: number,
  type: PointTransactionType,
  referenceType: string | null,
  referenceId: string | null,
  description: string | null,
): Promise<PointTransaction> {
  if (amount <= 0) {
    throw new AppError(400, "INVALID_AMOUNT", "Earn amount must be positive");
  }

  const db = getDB();

  // Upsert balance
  const balance = await getBalance(orgId, userId);
  const newEarned = Number(balance.total_earned) + amount;
  const newBalance = Number(balance.current_balance) + amount;

  await db.raw(
    `UPDATE point_balances
     SET total_earned = ?, current_balance = ?, updated_at = NOW()
     WHERE id = ?`,
    [newEarned, newBalance, balance.id],
  );

  // Create transaction
  const txn = await db.create<PointTransaction>("point_transactions", {
    id: uuidv4(),
    organization_id: orgId,
    user_id: userId,
    type,
    amount,
    balance_after: newBalance,
    reference_type: referenceType,
    reference_id: referenceId,
    description,
  } as any);

  logger.info(`Points earned: user=${userId} org=${orgId} amount=${amount} type=${type}`);
  return txn;
}

// ---------------------------------------------------------------------------
// spendPoints — validate balance, deduct
// ---------------------------------------------------------------------------
export async function spendPoints(
  orgId: number,
  userId: number,
  amount: number,
  type: PointTransactionType,
  referenceType: string | null,
  referenceId: string | null,
  description: string | null,
): Promise<PointTransaction> {
  if (amount <= 0) {
    throw new AppError(400, "INVALID_AMOUNT", "Spend amount must be positive");
  }

  const db = getDB();
  const balance = await getBalance(orgId, userId);

  if (Number(balance.current_balance) < amount) {
    throw new AppError(400, "INSUFFICIENT_BALANCE", "Not enough points to complete this action");
  }

  const newRedeemed = Number(balance.total_redeemed) + amount;
  const newBalance = Number(balance.current_balance) - amount;

  await db.raw(
    `UPDATE point_balances
     SET total_redeemed = ?, current_balance = ?, updated_at = NOW()
     WHERE id = ?`,
    [newRedeemed, newBalance, balance.id],
  );

  const txn = await db.create<PointTransaction>("point_transactions", {
    id: uuidv4(),
    organization_id: orgId,
    user_id: userId,
    type,
    amount: -amount,
    balance_after: newBalance,
    reference_type: referenceType,
    reference_id: referenceId,
    description,
  } as any);

  logger.info(`Points spent: user=${userId} org=${orgId} amount=${amount} type=${type}`);
  return txn;
}

// ---------------------------------------------------------------------------
// adjustPoints — admin manual adjustment (positive or negative)
// ---------------------------------------------------------------------------
export async function adjustPoints(
  orgId: number,
  userId: number,
  amount: number,
  description: string | null,
): Promise<PointTransaction> {
  const db = getDB();
  const balance = await getBalance(orgId, userId);

  const newBalance = Number(balance.current_balance) + amount;
  if (newBalance < 0) {
    throw new AppError(400, "INSUFFICIENT_BALANCE", "Adjustment would result in negative balance");
  }

  const updates: Record<string, any> = {
    current_balance: newBalance,
  };
  if (amount > 0) {
    updates.total_earned = Number(balance.total_earned) + amount;
  } else {
    updates.total_redeemed = Number(balance.total_redeemed) + Math.abs(amount);
  }

  await db.raw(
    `UPDATE point_balances
     SET total_earned = ?, total_redeemed = ?, current_balance = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      amount > 0 ? Number(balance.total_earned) + amount : Number(balance.total_earned),
      amount < 0 ? Number(balance.total_redeemed) + Math.abs(amount) : Number(balance.total_redeemed),
      newBalance,
      balance.id,
    ],
  );

  const txn = await db.create<PointTransaction>("point_transactions", {
    id: uuidv4(),
    organization_id: orgId,
    user_id: userId,
    type: PointTransactionType.ADMIN_ADJUSTMENT,
    amount,
    balance_after: newBalance,
    reference_type: null,
    reference_id: null,
    description: description || "Admin adjustment",
  } as any);

  logger.info(`Points adjusted: user=${userId} org=${orgId} amount=${amount}`);
  return txn;
}
