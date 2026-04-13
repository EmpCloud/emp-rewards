// ============================================================================
// REDEMPTION SERVICE
// ============================================================================

import { getDB } from "../../db/adapters";
import { logger } from "../../utils/logger";
import { AppError, NotFoundError, ValidationError } from "../../utils/errors";
import type {
  RewardRedemption,
  RewardCatalogItem,
  PointBalance,
  RedemptionStatus,
  PaginatedResponse,
} from "@emp-rewards/shared";

const TABLE = "reward_redemptions";
const REWARDS_TABLE = "reward_catalog";
const BALANCES_TABLE = "point_balances";
const TRANSACTIONS_TABLE = "point_transactions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ListRedemptionsParams {
  page?: number;
  perPage?: number;
  status?: string;
  userId?: number;
  sort?: string;
  order?: "asc" | "desc";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getRedemptionOrThrow(
  orgId: number,
  id: string,
): Promise<RewardRedemption> {
  const db = getDB();
  const redemption = await db.findOne<RewardRedemption>(TABLE, {
    id,
    organization_id: orgId,
  });
  if (!redemption) throw new NotFoundError("Redemption", id);
  return redemption;
}

async function refundPoints(orgId: number, redemption: RewardRedemption): Promise<void> {
  const db = getDB();

  const balance = await db.findOne<PointBalance>(BALANCES_TABLE, {
    organization_id: orgId,
    user_id: redemption.user_id,
  });

  const currentBalance = balance?.current_balance ?? 0;
  const newBalance = currentBalance + redemption.points_spent;
  const newTotalRedeemed = Math.max(
    0,
    (balance?.total_redeemed ?? 0) - redemption.points_spent,
  );

  if (balance) {
    await db.update(BALANCES_TABLE, balance.id, {
      current_balance: newBalance,
      total_redeemed: newTotalRedeemed,
    });
  }

  // Record refund transaction
  await db.create(TRANSACTIONS_TABLE, {
    organization_id: orgId,
    user_id: redemption.user_id,
    type: "admin_adjustment",
    amount: redemption.points_spent,
    balance_after: newBalance,
    reference_id: redemption.id,
    reference_type: "redemption_refund",
    description: `Refund for redemption ${redemption.id}`,
  });

  // Restore stock if the reward tracks quantity
  const reward = await db.findOne<RewardCatalogItem>(REWARDS_TABLE, {
    id: redemption.reward_id,
    organization_id: orgId,
  });
  if (reward && reward.quantity_available !== null) {
    await db.update(REWARDS_TABLE, reward.id, {
      quantity_available: reward.quantity_available + 1,
    } as any);
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function listRedemptions(
  orgId: number,
  params: ListRedemptionsParams = {},
): Promise<PaginatedResponse<RewardRedemption>> {
  const db = getDB();
  const filters: Record<string, any> = { organization_id: orgId };

  if (params.status) filters.status = params.status;
  if (params.userId) filters.user_id = params.userId;

  const result = await db.findMany<RewardRedemption>(TABLE, {
    page: params.page || 1,
    limit: params.perPage || 20,
    filters,
    sort: params.sort
      ? { field: params.sort, order: params.order || "desc" }
      : { field: "created_at", order: "desc" },
  });

  return {
    data: result.data,
    total: result.total,
    page: result.page,
    perPage: result.limit,
    totalPages: result.totalPages,
  };
}

export async function getRedemption(
  orgId: number,
  id: string,
): Promise<RewardRedemption> {
  return getRedemptionOrThrow(orgId, id);
}

export async function approveRedemption(
  orgId: number,
  id: string,
  approvedBy: number,
): Promise<RewardRedemption> {
  const db = getDB();
  const redemption = await getRedemptionOrThrow(orgId, id);

  if (redemption.status !== "pending") {
    throw new ValidationError(
      `Cannot approve a redemption with status '${redemption.status}'`,
    );
  }

  const updated = await db.update<RewardRedemption>(TABLE, id, {
    status: "approved" as RedemptionStatus,
    reviewed_by: approvedBy,
  } as any);

  logger.info(`Redemption ${id} approved by user ${approvedBy}`);
  return updated;
}

export async function rejectRedemption(
  orgId: number,
  id: string,
  rejectedBy: number,
  reason?: string,
): Promise<RewardRedemption> {
  const db = getDB();
  const redemption = await getRedemptionOrThrow(orgId, id);

  if (redemption.status !== "pending") {
    throw new ValidationError(
      `Cannot reject a redemption with status '${redemption.status}'`,
    );
  }

  // Refund points
  await refundPoints(orgId, redemption);

  const updated = await db.update<RewardRedemption>(TABLE, id, {
    status: "rejected" as RedemptionStatus,
    reviewed_by: rejectedBy,
    review_note: reason || null,
  } as any);

  logger.info(`Redemption ${id} rejected by user ${rejectedBy}`);
  return updated;
}

export async function fulfillRedemption(
  orgId: number,
  id: string,
  notes?: string,
): Promise<RewardRedemption> {
  const db = getDB();
  const redemption = await getRedemptionOrThrow(orgId, id);

  if (redemption.status !== "approved") {
    throw new ValidationError(
      `Cannot fulfill a redemption with status '${redemption.status}'. It must be approved first.`,
    );
  }

  const updated = await db.update<RewardRedemption>(TABLE, id, {
    status: "fulfilled" as RedemptionStatus,
    review_note: notes ?? redemption.review_note ?? null,
    fulfilled_at: new Date().toISOString(),
  } as any);

  logger.info(`Redemption ${id} fulfilled`);
  return updated;
}

export async function cancelRedemption(
  orgId: number,
  id: string,
  userId: number,
): Promise<RewardRedemption> {
  const db = getDB();
  const redemption = await getRedemptionOrThrow(orgId, id);

  // Only the requesting user can cancel, and only if pending
  if (redemption.user_id !== userId) {
    throw new ValidationError("You can only cancel your own redemptions");
  }
  if (redemption.status !== "pending") {
    throw new ValidationError(
      `Cannot cancel a redemption with status '${redemption.status}'`,
    );
  }

  // Refund points
  await refundPoints(orgId, redemption);

  const updated = await db.update<RewardRedemption>(TABLE, id, {
    status: "cancelled" as RedemptionStatus,
  } as any);

  logger.info(`Redemption ${id} cancelled by user ${userId}`);
  return updated;
}

export async function getMyRedemptions(
  orgId: number,
  userId: number,
  params: { page?: number; perPage?: number; status?: string } = {},
): Promise<PaginatedResponse<RewardRedemption>> {
  return listRedemptions(orgId, { ...params, userId });
}
