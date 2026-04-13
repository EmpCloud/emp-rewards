// ============================================================================
// CREATE push_subscriptions TABLE FOR WEB PUSH NOTIFICATIONS
// ============================================================================

import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable("push_subscriptions");

  if (!exists) {
    await knex.schema.createTable("push_subscriptions", (t) => {
      t.string("id", 36).primary();
      t.integer("organization_id").unsigned().notNullable();
      t.integer("user_id").unsigned().notNullable();
      t.string("endpoint", 500).notNullable();
      t.string("keys_p256dh", 512).notNullable();
      t.string("keys_auth", 512).notNullable();
      t.timestamp("created_at").defaultTo(knex.fn.now());

      t.index(["organization_id", "user_id"], "idx_push_sub_org_user");
      t.unique(["user_id", "endpoint"], { indexName: "uq_push_sub_user_endpoint" });
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("push_subscriptions");
}
