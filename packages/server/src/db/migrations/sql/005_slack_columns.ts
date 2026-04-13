// ============================================================================
// ADD SLACK COLUMNS TO recognition_settings
// ============================================================================

import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasSlackWebhook = await knex.schema.hasColumn("recognition_settings", "slack_webhook_url");

  if (!hasSlackWebhook) {
    await knex.schema.alterTable("recognition_settings", (t) => {
      t.string("slack_webhook_url", 512).nullable();
      t.string("slack_channel_name", 100).nullable();
      t.boolean("slack_notifications_enabled").notNullable().defaultTo(false);
      t.boolean("slack_notify_kudos").notNullable().defaultTo(true);
      t.boolean("slack_notify_celebrations").notNullable().defaultTo(true);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasSlackWebhook = await knex.schema.hasColumn("recognition_settings", "slack_webhook_url");

  if (hasSlackWebhook) {
    await knex.schema.alterTable("recognition_settings", (t) => {
      t.dropColumn("slack_webhook_url");
      t.dropColumn("slack_channel_name");
      t.dropColumn("slack_notifications_enabled");
      t.dropColumn("slack_notify_kudos");
      t.dropColumn("slack_notify_celebrations");
    });
  }
}
