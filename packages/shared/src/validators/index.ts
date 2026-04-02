// ============================================================================
// EMP-REWARDS ZOD VALIDATORS
// ============================================================================

import { z } from "zod";
import {
  KudosVisibility,
  ReactionType,
  FeedbackType,
  BadgeCriteriaType,
  RewardCategory,
  RedemptionStatus,
  NominationFrequency,
  NominationStatus,
  PointTransactionType,
  BudgetType,
  BudgetPeriod,
} from "../types/index";

// ---------------------------------------------------------------------------
// Kudos
// ---------------------------------------------------------------------------

export const sendKudosSchema = z.object({
  receiver_id: z.number().int().positive(),
  category_id: z.string().uuid().optional().nullable(),
  message: z.string().min(1).max(1000),
  points: z.number().int().min(0).optional(),
  visibility: z.nativeEnum(KudosVisibility).optional().default(KudosVisibility.PUBLIC),
  feedback_type: z.nativeEnum(FeedbackType).optional().default(FeedbackType.KUDOS),
  is_anonymous: z.boolean().optional().default(false),
});

export const addReactionSchema = z.object({
  kudos_id: z.string().uuid(),
  reaction_type: z.nativeEnum(ReactionType),
});

export const addCommentSchema = z.object({
  kudos_id: z.string().uuid(),
  content: z.string().min(1).max(500),
});

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

export const adjustPointsSchema = z.object({
  user_id: z.number().int().positive(),
  amount: z.number().int(),
  type: z.nativeEnum(PointTransactionType),
  description: z.string().min(1).max(500).optional(),
});

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export const createBadgeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  icon_url: z.string().url().optional().nullable(),
  criteria_type: z.nativeEnum(BadgeCriteriaType),
  criteria_value: z.number().int().min(0).optional().nullable(),
  points_awarded: z.number().int().min(0).default(0),
  is_active: z.boolean().optional().default(true),
});

export const awardBadgeSchema = z.object({
  user_id: z.number().int().positive(),
  badge_id: z.string().uuid(),
  awarded_reason: z.string().max(500).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

export const createRewardSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  category: z.nativeEnum(RewardCategory),
  points_cost: z.number().int().positive(),
  monetary_value: z.number().int().min(0).optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  quantity_available: z.number().int().min(0).optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export const redeemRewardSchema = z.object({
  reward_id: z.string().uuid(),
});

export const reviewRedemptionSchema = z.object({
  status: z.enum([
    RedemptionStatus.APPROVED,
    RedemptionStatus.REJECTED,
    RedemptionStatus.FULFILLED,
    RedemptionStatus.CANCELLED,
  ]),
  review_note: z.string().max(500).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Nominations
// ---------------------------------------------------------------------------

export const createNominationProgramSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  frequency: z.nativeEnum(NominationFrequency),
  nominations_per_user: z.number().int().positive().default(1),
  points_awarded: z.number().int().min(0).default(0),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export const updateNominationProgramSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  frequency: z.nativeEnum(NominationFrequency).optional(),
  nominations_per_user: z.number().int().positive().optional(),
  points_awarded: z.number().int().min(0).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  is_active: z.boolean().optional(),
});

export const submitNominationSchema = z.object({
  program_id: z.string().uuid(),
  nominee_id: z.number().int().positive(),
  reason: z.string().min(1).max(2000),
});

export const reviewNominationSchema = z.object({
  status: z.enum([NominationStatus.SELECTED, NominationStatus.NOT_SELECTED]),
  review_note: z.string().max(500).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export const createBudgetSchema = z.object({
  budget_type: z.nativeEnum(BudgetType),
  owner_id: z.number().int().positive(),
  department_id: z.number().int().positive().optional().nullable(),
  period: z.nativeEnum(BudgetPeriod),
  total_amount: z.number().int().positive(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_active: z.boolean().optional().default(true),
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const updateSettingsSchema = z.object({
  points_per_kudos: z.number().int().min(0).optional(),
  max_kudos_per_day: z.number().int().min(0).optional(),
  allow_self_kudos: z.boolean().optional(),
  allow_anonymous_kudos: z.boolean().optional(),
  default_visibility: z.nativeEnum(KudosVisibility).optional(),
  points_currency_name: z.string().min(1).max(50).optional(),
  require_category: z.boolean().optional(),
  require_message: z.boolean().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  points_multiplier: z.number().min(0).max(10).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// Celebrations
// ---------------------------------------------------------------------------

export const sendCelebrationWishSchema = z.object({
  message: z.string().min(1).max(500),
});

export const createCustomCelebrationSchema = z.object({
  user_id: z.number().int().positive(),
  type: z.enum(["birthday", "work_anniversary", "new_joiner", "promotion", "custom"]),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  celebration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  metadata: z.record(z.any()).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

export const paginationSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().min(1).max(100).optional(),
    per_page: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.string().optional(),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
  })
  .transform((val) => ({
    ...val,
    perPage: val.perPage ?? val.per_page ?? 20,
  }));

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
