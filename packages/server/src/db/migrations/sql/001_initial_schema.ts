// ============================================================================
// EMP-REWARDS INITIAL SCHEMA
// All 17 tables for the rewards & recognition module.
// ============================================================================

import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // -------------------------------------------------------------------------
  // 1. recognition_settings — per-org configuration
  // -------------------------------------------------------------------------
  await knex.schema.createTable("recognition_settings", (t) => {
    t.uuid("id").primary();
    t.bigInteger("organization_id").unsigned().notNullable().unique();
    t.integer("points_per_kudos").notNullable().defaultTo(10);
    t.integer("max_kudos_per_day").notNullable().defaultTo(5);
    t.boolean("allow_self_kudos").notNullable().defaultTo(false);
    t.boolean("allow_anonymous_kudos").notNullable().defaultTo(true);
    t.string("default_visibility", 20).notNullable().defaultTo("public");
    t.string("points_currency_name", 50).notNullable().defaultTo("Points");
    t.boolean("require_category").notNullable().defaultTo(false);
    t.boolean("require_message").notNullable().defaultTo(true);
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.timestamp("updated_at").defaultTo(knex.fn.now());
  });

  // -------------------------------------------------------------------------
  // 2. recognition_categories — kudos categories per org
  // -------------------------------------------------------------------------
  await knex.schema.createTable("recognition_categories", (t) => {
    t.uuid("id").primary();
    t.bigInteger("organization_id").unsigned().notNullable();
    t.string("name", 100).notNullable();
    t.string("description", 500).nullable();
    t.string("icon", 50).nullable();
    t.string("color", 20).nullable();
    t.decimal("points_multiplier", 4, 2).notNullable().defaultTo(1.0);
    t.boolean("is_active").notNullable().defaultTo(true);
    t.integer("sort_order").notNullable().defaultTo(0);
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.timestamp("updated_at").defaultTo(knex.fn.now());

    t.index(["organization_id", "is_active"]);
  });

  // -------------------------------------------------------------------------
  // 3. kudos — individual recognition messages
  // -------------------------------------------------------------------------
  await knex.schema.createTable("kudos", (t) => {
    t.uuid("id").primary();
    t.bigInteger("organization_id").unsigned().notNullable();
    t.bigInteger("sender_id").unsigned().notNullable();
    t.bigInteger("receiver_id").unsigned().notNullable();
    t.uuid("category_id").nullable().references("id").inTable("recognition_categories").onDelete("SET NULL");
    t.text("message").notNullable();
    t.integer("points").notNullable().defaultTo(0);
    t.string("visibility", 20).notNullable().defaultTo("public");
    t.string("feedback_type", 20).notNullable().defaultTo("kudos");
    t.boolean("is_anonymous").notNullable().defaultTo(false);
    t.timestamp("created_at").defaultTo(knex.fn.now());

    t.index(["organization_id", "receiver_id"]);
    t.index(["organization_id", "sender_id"]);
    t.index(["organization_id", "created_at"]);
  });

  // -------------------------------------------------------------------------
  // 4. kudos_reactions — emoji reactions on kudos
  // -------------------------------------------------------------------------
  await knex.schema.createTable("kudos_reactions", (t) => {
    t.uuid("id").primary();
    t.uuid("kudos_id").notNullable().references("id").inTable("kudos").onDelete("CASCADE");
    t.bigInteger("user_id").unsigned().notNullable();
    t.string("reaction_type", 20).notNullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());

    t.unique(["kudos_id", "user_id", "reaction_type"]);
  });

  // -------------------------------------------------------------------------
  // 5. kudos_comments — comments on kudos
  // -------------------------------------------------------------------------
  await knex.schema.createTable("kudos_comments", (t) => {
    t.uuid("id").primary();
    t.uuid("kudos_id").notNullable().references("id").inTable("kudos").onDelete("CASCADE");
    t.bigInteger("user_id").unsigned().notNullable();
    t.text("content").notNullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.timestamp("updated_at").defaultTo(knex.fn.now());

    t.index(["kudos_id", "created_at"]);
  });

  // -------------------------------------------------------------------------
  // 6. point_balances — current point balance per user
  // -------------------------------------------------------------------------
  await knex.schema.createTable("point_balances", (t) => {
    t.uuid("id").primary();
    t.bigInteger("organization_id").unsigned().notNullable();
    t.bigInteger("user_id").unsigned().notNullable();
    t.bigInteger("total_earned").notNullable().defaultTo(0);
    t.bigInteger("total_redeemed").notNullable().defaultTo(0);
    t.bigInteger("current_balance").notNullable().defaultTo(0);
    t.timestamp("updated_at").defaultTo(knex.fn.now());

    t.unique(["organization_id", "user_id"]);
  });

  // -------------------------------------------------------------------------
  // 7. point_transactions — ledger of all point changes
  // -------------------------------------------------------------------------
  await knex.schema.createTable("point_transactions", (t) => {
    t.uuid("id").primary();
    t.bigInteger("organization_id").unsigned().notNullable();
    t.bigInteger("user_id").unsigned().notNullable();
    t.string("type", 30).notNullable();
    t.bigInteger("amount").notNullable();
    t.bigInteger("balance_after").notNullable();
    t.uuid("reference_id").nullable();
    t.string("reference_type", 50).nullable();
    t.string("description", 500).nullable();
    t.bigInteger("created_by").unsigned().nullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());

    t.index(["organization_id", "user_id", "created_at"]);
    t.index(["organization_id", "type"]);
  });

  // -------------------------------------------------------------------------
  // 8. badge_definitions — badge templates
  // -------------------------------------------------------------------------
  await knex.schema.createTable("badge_definitions", (t) => {
    t.uuid("id").primary();
    t.bigInteger("organization_id").unsigned().notNullable();
    t.string("name", 100).notNullable();
    t.string("description", 500).nullable();
    t.string("icon_url", 512).nullable();
    t.string("criteria_type", 30).notNullable().defaultTo("manual");
    t.integer("criteria_value").nullable();
    t.integer("points_awarded").notNullable().defaultTo(0);
    t.boolean("is_active").notNullable().defaultTo(true);
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.timestamp("updated_at").defaultTo(knex.fn.now());

    t.index(["organization_id", "is_active"]);
  });

  // -------------------------------------------------------------------------
  // 9. user_badges — awarded badges
  // -------------------------------------------------------------------------
  await knex.schema.createTable("user_badges", (t) => {
    t.uuid("id").primary();
    t.bigInteger("organization_id").unsigned().notNullable();
    t.bigInteger("user_id").unsigned().notNullable();
    t.uuid("badge_id").notNullable().references("id").inTable("badge_definitions").onDelete("CASCADE");
    t.bigInteger("awarded_by").unsigned().nullable();
    t.string("awarded_reason", 500).nullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());

    t.index(["organization_id", "user_id"]);
    t.index(["badge_id"]);
  });

  // -------------------------------------------------------------------------
  // 10. reward_catalog — items available for redemption
  // -------------------------------------------------------------------------
  await knex.schema.createTable("reward_catalog", (t) => {
    t.uuid("id").primary();
    t.bigInteger("organization_id").unsigned().notNullable();
    t.string("name", 200).notNullable();
    t.text("description").nullable();
    t.string("category", 30).notNullable();
    t.integer("points_cost").notNullable();
    t.bigInteger("monetary_value").nullable().comment("In smallest currency unit");
    t.string("image_url", 512).nullable();
    t.integer("quantity_available").nullable();
    t.boolean("is_active").notNullable().defaultTo(true);
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.timestamp("updated_at").defaultTo(knex.fn.now());

    t.index(["organization_id", "is_active"]);
    t.index(["organization_id", "category"]);
  });

  // -------------------------------------------------------------------------
  // 11. reward_redemptions — redemption requests
  // -------------------------------------------------------------------------
  await knex.schema.createTable("reward_redemptions", (t) => {
    t.uuid("id").primary();
    t.bigInteger("organization_id").unsigned().notNullable();
    t.bigInteger("user_id").unsigned().notNullable();
    t.uuid("reward_id").notNullable().references("id").inTable("reward_catalog").onDelete("CASCADE");
    t.integer("points_spent").notNullable();
    t.string("status", 20).notNullable().defaultTo("pending");
    t.bigInteger("reviewed_by").unsigned().nullable();
    t.string("review_note", 500).nullable();
    t.timestamp("fulfilled_at").nullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.timestamp("updated_at").defaultTo(knex.fn.now());

    t.index(["organization_id", "user_id"]);
    t.index(["organization_id", "status"]);
  });

  // -------------------------------------------------------------------------
  // 12. nomination_programs — award/recognition programs
  // -------------------------------------------------------------------------
  await knex.schema.createTable("nomination_programs", (t) => {
    t.uuid("id").primary();
    t.bigInteger("organization_id").unsigned().notNullable();
    t.string("name", 200).notNullable();
    t.text("description").nullable();
    t.string("frequency", 20).notNullable().defaultTo("monthly");
    t.integer("nominations_per_user").notNullable().defaultTo(1);
    t.integer("points_awarded").notNullable().defaultTo(0);
    t.date("start_date").notNullable();
    t.date("end_date").nullable();
    t.boolean("is_active").notNullable().defaultTo(true);
    t.bigInteger("created_by").unsigned().notNullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.timestamp("updated_at").defaultTo(knex.fn.now());

    t.index(["organization_id", "is_active"]);
  });

  // -------------------------------------------------------------------------
  // 13. nominations — individual nominations
  // -------------------------------------------------------------------------
  await knex.schema.createTable("nominations", (t) => {
    t.uuid("id").primary();
    t.bigInteger("organization_id").unsigned().notNullable();
    t.uuid("program_id").notNullable().references("id").inTable("nomination_programs").onDelete("CASCADE");
    t.bigInteger("nominator_id").unsigned().notNullable();
    t.bigInteger("nominee_id").unsigned().notNullable();
    t.text("reason").notNullable();
    t.string("status", 20).notNullable().defaultTo("submitted");
    t.bigInteger("reviewed_by").unsigned().nullable();
    t.string("review_note", 500).nullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.timestamp("updated_at").defaultTo(knex.fn.now());

    t.index(["organization_id", "program_id"]);
    t.index(["organization_id", "nominee_id"]);
    t.index(["organization_id", "status"]);
  });

  // -------------------------------------------------------------------------
  // 14. leaderboard_snapshots — pre-computed leaderboard data
  // -------------------------------------------------------------------------
  await knex.schema.createTable("leaderboard_snapshots", (t) => {
    t.uuid("id").primary();
    t.bigInteger("organization_id").unsigned().notNullable();
    t.bigInteger("user_id").unsigned().notNullable();
    t.string("period", 20).notNullable();
    t.string("period_key", 20).notNullable().comment("e.g. 2026-W12, 2026-03, 2026-Q1");
    t.bigInteger("total_points").notNullable().defaultTo(0);
    t.integer("kudos_sent").notNullable().defaultTo(0);
    t.integer("kudos_received").notNullable().defaultTo(0);
    t.integer("badges_earned").notNullable().defaultTo(0);
    t.integer("rank").notNullable().defaultTo(0);
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.timestamp("updated_at").defaultTo(knex.fn.now());

    t.unique(["organization_id", "user_id", "period", "period_key"], { indexName: "lb_org_user_period_key_uniq" });
    t.index(["organization_id", "period", "period_key", "rank"], "lb_org_period_key_rank_idx");
  });

  // -------------------------------------------------------------------------
  // 15. recognition_budgets — spending budgets per manager/dept
  // -------------------------------------------------------------------------
  await knex.schema.createTable("recognition_budgets", (t) => {
    t.uuid("id").primary();
    t.bigInteger("organization_id").unsigned().notNullable();
    t.string("budget_type", 20).notNullable();
    t.bigInteger("owner_id").unsigned().notNullable();
    t.bigInteger("department_id").unsigned().nullable();
    t.string("period", 20).notNullable();
    t.bigInteger("total_amount").notNullable();
    t.bigInteger("spent_amount").notNullable().defaultTo(0);
    t.bigInteger("remaining_amount").notNullable();
    t.date("period_start").notNullable();
    t.date("period_end").notNullable();
    t.boolean("is_active").notNullable().defaultTo(true);
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.timestamp("updated_at").defaultTo(knex.fn.now());

    t.index(["organization_id", "budget_type", "is_active"]);
    t.index(["organization_id", "owner_id"]);
  });

  // -------------------------------------------------------------------------
  // 16. audit_logs — security & compliance audit trail
  // -------------------------------------------------------------------------
  await knex.schema.createTable("audit_logs", (t) => {
    t.uuid("id").primary();
    t.bigInteger("organization_id").unsigned().notNullable();
    t.bigInteger("user_id").unsigned().notNullable();
    t.string("action", 100).notNullable();
    t.string("entity_type", 50).notNullable();
    t.uuid("entity_id").nullable();
    t.json("details").nullable();
    t.string("ip_address", 45).nullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());

    t.index(["organization_id", "created_at"]);
    t.index(["organization_id", "entity_type", "entity_id"]);
  });

  // -------------------------------------------------------------------------
  // 17. notification_preferences — per-user notification config
  // -------------------------------------------------------------------------
  await knex.schema.createTable("notification_preferences", (t) => {
    t.uuid("id").primary();
    t.bigInteger("organization_id").unsigned().notNullable();
    t.bigInteger("user_id").unsigned().notNullable();
    t.boolean("email_on_kudos_received").notNullable().defaultTo(true);
    t.boolean("email_on_badge_awarded").notNullable().defaultTo(true);
    t.boolean("email_on_redemption_update").notNullable().defaultTo(true);
    t.boolean("email_on_nomination").notNullable().defaultTo(true);
    t.boolean("email_weekly_digest").notNullable().defaultTo(true);
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.timestamp("updated_at").defaultTo(knex.fn.now());

    t.unique(["organization_id", "user_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  const tables = [
    "notification_preferences",
    "audit_logs",
    "recognition_budgets",
    "leaderboard_snapshots",
    "nominations",
    "nomination_programs",
    "reward_redemptions",
    "reward_catalog",
    "user_badges",
    "badge_definitions",
    "point_transactions",
    "point_balances",
    "kudos_comments",
    "kudos_reactions",
    "kudos",
    "recognition_categories",
    "recognition_settings",
  ];
  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
}
