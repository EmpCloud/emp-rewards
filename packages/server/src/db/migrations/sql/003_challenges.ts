// ============================================================================
// CHALLENGES SCHEMA
// Tables for team/individual challenges and participant tracking.
// ============================================================================

import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // -------------------------------------------------------------------------
  // challenges — team, individual, and department challenges
  // -------------------------------------------------------------------------
  await knex.schema.createTable("challenges", (t) => {
    t.uuid("id").primary();
    t.bigInteger("organization_id").unsigned().notNullable();
    t.string("title", 255).notNullable();
    t.text("description").nullable();
    t.enum("type", ["individual", "team", "department"]).notNullable().defaultTo("individual");
    t.enum("metric", ["kudos_sent", "kudos_received", "points_earned", "badges_earned"])
      .notNullable()
      .defaultTo("kudos_sent");
    t.integer("target_value").notNullable();
    t.date("start_date").notNullable();
    t.date("end_date").notNullable();
    t.integer("reward_points").notNullable().defaultTo(0);
    t.uuid("reward_badge_id").nullable();
    t.enum("status", ["upcoming", "active", "completed", "cancelled"])
      .notNullable()
      .defaultTo("upcoming");
    t.bigInteger("created_by").unsigned().notNullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.timestamp("updated_at").defaultTo(knex.fn.now());

    t.index(["organization_id", "status"]);
    t.index(["organization_id", "start_date", "end_date"]);
  });

  // -------------------------------------------------------------------------
  // challenge_participants — users participating in challenges
  // -------------------------------------------------------------------------
  await knex.schema.createTable("challenge_participants", (t) => {
    t.uuid("id").primary();
    t.uuid("challenge_id")
      .notNullable()
      .references("id")
      .inTable("challenges")
      .onDelete("CASCADE");
    t.bigInteger("user_id").unsigned().notNullable();
    t.integer("current_value").notNullable().defaultTo(0);
    t.integer("rank").nullable();
    t.boolean("completed").notNullable().defaultTo(false);
    t.timestamp("completed_at").nullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());

    t.index(["challenge_id"]);
    t.unique(["challenge_id", "user_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("challenge_participants");
  await knex.schema.dropTableIfExists("challenges");
}
