// ============================================================================
// EMP-REWARDS CONSTANTS
// ============================================================================

import { ReactionType, BadgeCriteriaType, RewardCategory } from "../types/index";

/**
 * Default recognition categories seeded for new organizations.
 */
export const DEFAULT_CATEGORIES = [
  {
    name: "Teamwork",
    description: "Recognized for excellent collaboration and team spirit",
    icon: "users",
    color: "#3B82F6",
    points_multiplier: 1.0,
    sort_order: 1,
  },
  {
    name: "Innovation",
    description: "Recognized for creative thinking and problem solving",
    icon: "lightbulb",
    color: "#F59E0B",
    points_multiplier: 1.5,
    sort_order: 2,
  },
  {
    name: "Leadership",
    description: "Recognized for guiding and inspiring others",
    icon: "star",
    color: "#8B5CF6",
    points_multiplier: 1.5,
    sort_order: 3,
  },
  {
    name: "Customer Focus",
    description: "Recognized for going above and beyond for customers",
    icon: "heart",
    color: "#EF4444",
    points_multiplier: 1.0,
    sort_order: 4,
  },
  {
    name: "Excellence",
    description: "Recognized for exceptional quality of work",
    icon: "award",
    color: "#10B981",
    points_multiplier: 2.0,
    sort_order: 5,
  },
  {
    name: "Mentoring",
    description: "Recognized for helping others grow and learn",
    icon: "book-open",
    color: "#6366F1",
    points_multiplier: 1.0,
    sort_order: 6,
  },
] as const;

/**
 * Available reaction types for kudos.
 */
export const REACTION_TYPES = [
  { value: ReactionType.LIKE, label: "Like", emoji: "\uD83D\uDC4D" },
  { value: ReactionType.CLAP, label: "Clap", emoji: "\uD83D\uDC4F" },
  { value: ReactionType.HEART, label: "Heart", emoji: "\u2764\uFE0F" },
] as const;

/**
 * Badge criteria type labels and descriptions.
 */
export const BADGE_CRITERIA = [
  { value: BadgeCriteriaType.MANUAL, label: "Manual", description: "Awarded manually by admins" },
  { value: BadgeCriteriaType.AUTO_KUDOS_COUNT, label: "Kudos Count", description: "Auto-awarded after receiving N kudos" },
  { value: BadgeCriteriaType.AUTO_TENURE, label: "Tenure", description: "Auto-awarded after N months of service" },
  { value: BadgeCriteriaType.AUTO_POINTS, label: "Points", description: "Auto-awarded after earning N points" },
  { value: BadgeCriteriaType.AUTO_KUDOS_STREAK, label: "Kudos Streak", description: "Auto-awarded for N consecutive days sending kudos" },
] as const;

/**
 * Reward category labels and icons.
 */
export const REWARD_CATEGORIES = [
  { value: RewardCategory.GIFT_CARD, label: "Gift Card", icon: "credit-card" },
  { value: RewardCategory.PTO, label: "Paid Time Off", icon: "calendar" },
  { value: RewardCategory.SWAG, label: "Company Swag", icon: "shirt" },
  { value: RewardCategory.EXPERIENCE, label: "Experience", icon: "compass" },
  { value: RewardCategory.DONATION, label: "Donation", icon: "heart-handshake" },
  { value: RewardCategory.CUSTOM, label: "Custom", icon: "package" },
] as const;
