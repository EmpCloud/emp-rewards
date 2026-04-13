// ============================================================================
// ADD TEAMS COLUMNS TO recognition_settings
// ============================================================================

import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasTeamsWebhook = await knex.schema.hasColumn("recognition_settings", "teams_webhook_url");

  if (!hasTeamsWebhook) {
    await knex.schema.alterTable("recognition_settings", (t) => {
      t.string("teams_webhook_url", 512).nullable();
      t.boolean("teams_enabled").notNullable().defaultTo(false);
      t.boolean("teams_notify_kudos").notNullable().defaultTo(true);
      t.boolean("teams_notify_celebrations").notNullable().defaultTo(true);
      t.boolean("teams_notify_milestones").notNullable().defaultTo(true);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTeamsWebhook = await knex.schema.hasColumn("recognition_settings", "teams_webhook_url");

  if (hasTeamsWebhook) {
    await knex.schema.alterTable("recognition_settings", (t) => {
      t.dropColumn("teams_webhook_url");
      t.dropColumn("teams_enabled");
      t.dropColumn("teams_notify_kudos");
      t.dropColumn("teams_notify_celebrations");
      t.dropColumn("teams_notify_milestones");
    });
  }
}
