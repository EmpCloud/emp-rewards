// ============================================================================
// CELEBRATIONS SCHEMA
// Tables for birthday, work anniversary, and custom celebration tracking.
// ============================================================================

import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // -------------------------------------------------------------------------
  // celebrations — birthday, anniversary, and custom celebration records
  // -------------------------------------------------------------------------
  await knex.schema.createTable("celebrations", (t) => {
    t.uuid("id").primary();
    t.bigInteger("organization_id").unsigned().notNullable();
    t.bigInteger("user_id").unsigned().notNullable();
    t.enum("type", ["birthday", "work_anniversary", "new_joiner", "promotion", "custom"])
      .notNullable()
      .defaultTo("birthday");
    t.string("title", 255).notNullable();
    t.text("description").nullable();
    t.date("celebration_date").notNullable();
    t.json("metadata").nullable().comment("e.g. {years: 5} for anniversary");
    t.boolean("is_auto_generated").notNullable().defaultTo(true);
    t.timestamp("created_at").defaultTo(knex.fn.now());

    t.index(["organization_id", "celebration_date"]);
    t.index(["organization_id", "user_id"]);
    t.index(["organization_id", "type"]);
  });

  // -------------------------------------------------------------------------
  // celebration_wishes — wishes/greetings on celebrations
  // -------------------------------------------------------------------------
  await knex.schema.createTable("celebration_wishes", (t) => {
    t.uuid("id").primary();
    t.uuid("celebration_id")
      .notNullable()
      .references("id")
      .inTable("celebrations")
      .onDelete("CASCADE");
    t.bigInteger("user_id").unsigned().notNullable();
    t.text("message").notNullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());

    t.index(["celebration_id", "created_at"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("celebration_wishes");
  await knex.schema.dropTableIfExists("celebrations");
}
