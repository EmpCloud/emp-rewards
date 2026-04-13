// ============================================================================
// REWARD CATALOG SERVICE
// ============================================================================

import { v4 as uuidv4 } from "uuid";
import { getDB } from "../../db/adapters";
import { logger } from "../../utils/logger";
import { AppError, NotFoundError, ValidationError } from "../../utils/errors";
import type {
  RewardCatalogItem,
  PointBalance,
  RewardRedemption,
  RedemptionStatus,
  PaginatedResponse,
} from "@emp-rewards/shared";

const TABLE = "reward_catalog";
const REDEMPTIONS_TABLE = "reward_redemptions";
const BALANCES_TABLE = "point_balances";
const TRANSACTIONS_TABLE = "point_transactions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateRewardData {
  name: string;
  description?: string | null;
  category: string;
  points_cost: number;
  monetary_value?: number | null;
  image_url?: string | null;
  quantity_available?: number | null;
  is_active?: boolean;
}

interface ListRewardsParams {
  page?: number;
  perPage?: number;
  category?: string;
  is_active?: boolean;
  sort?: string;
  order?: "asc" | "desc";
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function createReward(
  orgId: number,
  data: CreateRewardData,
): Promise<RewardCatalogItem> {
  const db = getDB();
  const reward = await db.create<RewardCatalogItem>(TABLE, {
    organization_id: orgId,
    ...data,
  } as any);
  logger.info(`Reward created: ${reward.id} for org ${orgId}`);
  return reward;
}

export async function listRewards(
  orgId: number,
  params: ListRewardsParams = {},
): Promise<PaginatedResponse<RewardCatalogItem>> {
  const db = getDB();
  const filters: Record<string, any> = { organization_id: orgId };

  if (params.category) filters.category = params.category;
  if (params.is_active !== undefined) filters.is_active = params.is_active;

  const result = await db.findMany<RewardCatalogItem>(TABLE, {
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

export async function getReward(
  orgId: number,
  id: string,
): Promise<RewardCatalogItem> {
  const db = getDB();
  const reward = await db.findOne<RewardCatalogItem>(TABLE, {
    id,
    organization_id: orgId,
  });
  if (!reward) throw new NotFoundError("Reward", id);
  return reward;
}

export async function updateReward(
  orgId: number,
  id: string,
  data: Partial<CreateRewardData>,
): Promise<RewardCatalogItem> {
  const db = getDB();

  // Verify it belongs to this org
  const existing = await db.findOne<RewardCatalogItem>(TABLE, {
    id,
    organization_id: orgId,
  });
  if (!existing) throw new NotFoundError("Reward", id);

  const updated = await db.update<RewardCatalogItem>(TABLE, id, data as any);
  logger.info(`Reward updated: ${id} for org ${orgId}`);
  return updated;
}

export async function deleteReward(
  orgId: number,
  id: string,
): Promise<RewardCatalogItem> {
  const db = getDB();

  const existing = await db.findOne<RewardCatalogItem>(TABLE, {
    id,
    organization_id: orgId,
  });
  if (!existing) throw new NotFoundError("Reward", id);

  // Soft delete — mark inactive
  const updated = await db.update<RewardCatalogItem>(TABLE, id, {
    is_active: false,
  } as any);
  logger.info(`Reward soft-deleted: ${id} for org ${orgId}`);
  return updated;
}

export async function redeemReward(
  orgId: number,
  userId: number,
  rewardId: string,
): Promise<RewardRedemption> {
  const db = getDB();

  // 1. Get reward and validate
  const reward = await db.findOne<RewardCatalogItem>(TABLE, {
    id: rewardId,
    organization_id: orgId,
    is_active: true,
  });
  if (!reward) throw new NotFoundError("Reward", rewardId);

  // 2. Check stock
  if (reward.quantity_available !== null && reward.quantity_available <= 0) {
    throw new ValidationError("This reward is out of stock");
  }

  // 3. Check user's point balance
  const balance = await db.findOne<PointBalance>(BALANCES_TABLE, {
    organization_id: orgId,
    user_id: userId,
  });
  const currentBalance = balance?.current_balance ?? 0;

  if (currentBalance < reward.points_cost) {
    throw new ValidationError(
      `Insufficient points. You have ${currentBalance} but need ${reward.points_cost}`,
    );
  }

  // 4. Deduct points
  const newBalance = currentBalance - reward.points_cost;
  const newTotalRedeemed = (balance?.total_redeemed ?? 0) + reward.points_cost;

  if (balance) {
    await db.update(BALANCES_TABLE, balance.id, {
      current_balance: newBalance,
      total_redeemed: newTotalRedeemed,
    });
  } else {
    // Edge case: balance row doesn't exist yet
    await db.create(BALANCES_TABLE, {
      organization_id: orgId,
      user_id: userId,
      total_earned: 0,
      total_redeemed: reward.points_cost,
      current_balance: -reward.points_cost,
    });
  }

  // 5. Create point transaction
  await db.create(TRANSACTIONS_TABLE, {
    organization_id: orgId,
    user_id: userId,
    type: "redemption",
    amount: -reward.points_cost,
    balance_after: newBalance,
    reference_type: "reward_redemption",
    description: `Redeemed: ${reward.name}`,
  });

  // 6. Decrement stock if applicable
  if (reward.quantity_available !== null) {
    await db.update(TABLE, rewardId, {
      quantity_available: reward.quantity_available - 1,
    } as any);
  }

  // 7. Create pending redemption
  const redemption = await db.create<RewardRedemption>(REDEMPTIONS_TABLE, {
    organization_id: orgId,
    user_id: userId,
    reward_id: rewardId,
    points_spent: reward.points_cost,
    status: "pending" as RedemptionStatus,
  });

  // Update the transaction reference_id with the redemption id
  await db.raw(
    `UPDATE ${TRANSACTIONS_TABLE} SET reference_id = ? WHERE organization_id = ? AND user_id = ? AND reference_type = 'reward_redemption' AND reference_id IS NULL ORDER BY created_at DESC LIMIT 1`,
    [redemption.id, orgId, userId],
  );

  logger.info(
    `Reward redeemed: user ${userId} redeemed reward ${rewardId} for ${reward.points_cost} points`,
  );

  return redemption;
}
