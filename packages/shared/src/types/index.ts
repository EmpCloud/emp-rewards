// ============================================================================
// EMP-REWARDS SHARED TYPES
// ============================================================================

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum KudosVisibility {
  PUBLIC = "public",
  PRIVATE = "private",
}

export enum ReactionType {
  LIKE = "like",
  CLAP = "clap",
  HEART = "heart",
}

export enum FeedbackType {
  KUDOS = "kudos",
  CONSTRUCTIVE = "constructive",
  GENERAL = "general",
}

export enum BadgeCriteriaType {
  MANUAL = "manual",
  AUTO_KUDOS_COUNT = "auto_kudos_count",
  AUTO_TENURE = "auto_tenure",
  AUTO_POINTS = "auto_points",
  AUTO_KUDOS_STREAK = "auto_kudos_streak",
}

export enum RewardCategory {
  GIFT_CARD = "gift_card",
  PTO = "pto",
  SWAG = "swag",
  EXPERIENCE = "experience",
  DONATION = "donation",
  CUSTOM = "custom",
}

export enum RedemptionStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  FULFILLED = "fulfilled",
  CANCELLED = "cancelled",
}

export enum NominationFrequency {
  ONE_TIME = "one_time",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  ANNUAL = "annual",
}

export enum NominationStatus {
  SUBMITTED = "submitted",
  UNDER_REVIEW = "under_review",
  SELECTED = "selected",
  NOT_SELECTED = "not_selected",
}

export enum LeaderboardPeriod {
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  YEARLY = "yearly",
  ALL_TIME = "all_time",
}

export enum PointTransactionType {
  KUDOS_RECEIVED = "kudos_received",
  KUDOS_SENT = "kudos_sent",
  ACHIEVEMENT = "achievement",
  MILESTONE = "milestone",
  REDEMPTION = "redemption",
  ADMIN_ADJUSTMENT = "admin_adjustment",
  NOMINATION_AWARD = "nomination_award",
}

export enum BudgetType {
  MANAGER = "manager",
  DEPARTMENT = "department",
}

export enum BudgetPeriod {
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  ANNUAL = "annual",
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface RecognitionSettings {
  id: string;
  organization_id: number;
  points_per_kudos: number;
  max_kudos_per_day: number;
  allow_self_kudos: boolean;
  allow_anonymous_kudos: boolean;
  default_visibility: KudosVisibility;
  points_currency_name: string;
  require_category: boolean;
  require_message: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecognitionCategory {
  id: string;
  organization_id: number;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  points_multiplier: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Kudos {
  id: string;
  organization_id: number;
  sender_id: number;
  receiver_id: number;
  category_id: string | null;
  message: string;
  points: number;
  visibility: KudosVisibility;
  feedback_type: FeedbackType;
  is_anonymous: boolean;
  created_at: string;
}

export interface KudosReaction {
  id: string;
  kudos_id: string;
  user_id: number;
  reaction_type: ReactionType;
  created_at: string;
}

export interface KudosComment {
  id: string;
  kudos_id: string;
  user_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface PointBalance {
  id: string;
  organization_id: number;
  user_id: number;
  total_earned: number;
  total_redeemed: number;
  current_balance: number;
  updated_at: string;
}

export interface PointTransaction {
  id: string;
  organization_id: number;
  user_id: number;
  type: PointTransactionType;
  amount: number;
  balance_after: number;
  reference_id: string | null;
  reference_type: string | null;
  description: string | null;
  created_by: number | null;
  created_at: string;
}

export interface BadgeDefinition {
  id: string;
  organization_id: number;
  name: string;
  description: string | null;
  icon_url: string | null;
  criteria_type: BadgeCriteriaType;
  criteria_value: number | null;
  points_awarded: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserBadge {
  id: string;
  organization_id: number;
  user_id: number;
  badge_id: string;
  awarded_by: number | null;
  awarded_reason: string | null;
  created_at: string;
}

export interface RewardCatalogItem {
  id: string;
  organization_id: number;
  name: string;
  description: string | null;
  category: RewardCategory;
  points_cost: number;
  monetary_value: number | null;
  image_url: string | null;
  quantity_available: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RewardRedemption {
  id: string;
  organization_id: number;
  user_id: number;
  reward_id: string;
  points_spent: number;
  status: RedemptionStatus;
  reviewed_by: number | null;
  review_note: string | null;
  fulfilled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NominationProgram {
  id: string;
  organization_id: number;
  name: string;
  description: string | null;
  frequency: NominationFrequency;
  nominations_per_user: number;
  points_awarded: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface Nomination {
  id: string;
  organization_id: number;
  program_id: string;
  nominator_id: number;
  nominee_id: number;
  reason: string;
  status: NominationStatus;
  reviewed_by: number | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardEntry {
  user_id: number;
  organization_id: number;
  period: LeaderboardPeriod;
  total_points: number;
  kudos_sent: number;
  kudos_received: number;
  badges_earned: number;
  rank: number;
  // Joined fields
  first_name?: string;
  last_name?: string;
  email?: string;
  designation?: string;
}

export interface RecognitionBudget {
  id: string;
  organization_id: number;
  budget_type: BudgetType;
  owner_id: number;
  department_id: number | null;
  period: BudgetPeriod;
  total_amount: number;
  spent_amount: number;
  remaining_amount: number;
  period_start: string;
  period_end: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: number;
  user_id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Celebrations
// ---------------------------------------------------------------------------

export enum CelebrationType {
  BIRTHDAY = "birthday",
  WORK_ANNIVERSARY = "work_anniversary",
  NEW_JOINER = "new_joiner",
  PROMOTION = "promotion",
  CUSTOM = "custom",
}

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
  // Joined fields
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
  // Joined fields
  first_name?: string;
  last_name?: string;
}

export interface CelebrationFeedItem {
  id: string;
  feed_type: "birthday" | "work_anniversary" | "new_joiner" | "promotion" | "custom" | "kudos";
  title: string;
  description: string | null;
  item_date: string;
  created_at: string;
  user_id?: number;
  first_name?: string;
  last_name?: string;
  designation?: string;
  metadata?: Record<string, any> | null;
  wish_count?: number;
  // Kudos-specific
  sender_id?: number;
  receiver_id?: number;
  sender_first_name?: string;
  sender_last_name?: string;
  receiver_first_name?: string;
  receiver_last_name?: string;
  points?: number;
  is_anonymous?: boolean;
}

// ---------------------------------------------------------------------------
// API Response Types
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface AuthPayload {
  empcloudUserId: number;
  empcloudOrgId: number;
  rewardsProfileId: string | null;
  role: "super_admin" | "org_admin" | "hr_admin" | "hr_manager" | "employee";
  email: string;
  firstName: string;
  lastName: string;
  orgName: string;
}
