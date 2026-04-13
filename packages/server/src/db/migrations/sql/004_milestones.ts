// ============================================================================
// MILESTONES SCHEMA
// Tables for automated milestone rules and user achievements.
// ============================================================================

import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // -------------------------------------------------------------------------
  // milestone_rules — configurable milestone triggers
  // -------------------------------------------------------------------------
  await knex.schema.createTable("milestone_rules", (t) => {
    t.uuid("id").primary();
    t.bigInteger("organization_id").unsigned().notNullable();
    t.string("name", 255).notNullable();
    t.text("description").nullable();
    t.enum("trigger_type", [
      "work_anniversary",
      "kudos_count",
      "points_total",
      "badges_count",
      "referral_hired",
      "first_kudos",
    ]).notNullable();
    t.integer("trigger_value").notNullable().defaultTo(0);
    t.integer("reward_points").notNullable().defaultTo(0);
    t.uuid("reward_badge_id").nullable();
    t.boolean("is_active").notNullable().defaultTo(true);
    t.timestamp("created_at").defaultTo(knex.fn.now());

    t.index(["organization_id", "is_active"]);
    t.index(["organization_id", "trigger_type"]);
  });

  // -------------------------------------------------------------------------
  // milestone_achievements — records of achieved milestones per user
  // -------------------------------------------------------------------------
  await knex.schema.createTable("milestone_achievements", (t) => {
    t.uuid("id").primary();
    t.bigInteger("organization_id").unsigned().notNullable();
    t.bigInteger("user_id").unsigned().notNullable();
    t.uuid("milestone_rule_id")
      .notNullable()
      .references("id")
      .inTable("milestone_rules")
      .onDelete("CASCADE");
    t.timestamp("achieved_at").defaultTo(knex.fn.now());
    t.integer("points_awarded").notNullable().defaultTo(0);

    t.unique(["user_id", "milestone_rule_id"]);
    t.index(["organization_id", "user_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("milestone_achievements");
  await knex.schema.dropTableIfExists("milestone_rules");
}
