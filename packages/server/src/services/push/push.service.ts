// ============================================================================
// PUSH NOTIFICATION SERVICE
// Web Push notifications for recognition events using the web-push protocol.
// ============================================================================

import { v4 as uuidv4 } from "uuid";
import { getDB } from "../../db/adapters";
import { logger } from "../../utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PushSubscription {
  id: string;
  organization_id: number;
  user_id: number;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
  created_at: string;
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// VAPID configuration — loaded from environment
// ---------------------------------------------------------------------------
function getVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "mailto:rewards@empcloud.com";
  return { publicKey, privateKey, subject };
}

export function getVapidPublicKey(): string {
  return getVapidConfig().publicKey;
}

// ---------------------------------------------------------------------------
// subscribe — register a push subscription for a user
// ---------------------------------------------------------------------------
export async function subscribe(
  orgId: number,
  userId: number,
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  },
): Promise<PushSubscription> {
  const db = getDB();

  // Check if this exact endpoint already exists for this user
  const existing = await db.findOne<PushSubscription>("push_subscriptions", {
    user_id: userId,
    endpoint: subscription.endpoint,
  });

  if (existing) {
    // Update keys in case they changed
    const updated = await db.update<PushSubscription>("push_subscriptions", existing.id, {
      keys_p256dh: subscription.keys.p256dh,
      keys_auth: subscription.keys.auth,
    } as any);
    logger.info(`Push subscription updated for user=${userId} org=${orgId}`);
    return updated;
  }

  const sub = await db.create<PushSubscription>("push_subscriptions", {
    id: uuidv4(),
    organization_id: orgId,
    user_id: userId,
    endpoint: subscription.endpoint,
    keys_p256dh: subscription.keys.p256dh,
    keys_auth: subscription.keys.auth,
  } as any);

  logger.info(`Push subscription created for user=${userId} org=${orgId}`);
  return sub;
}

// ---------------------------------------------------------------------------
// unsubscribe — remove a push subscription
// ---------------------------------------------------------------------------
export async function unsubscribe(
  userId: number,
  endpoint: string,
): Promise<void> {
  const db = getDB();
  await db.deleteMany("push_subscriptions", {
    user_id: userId,
    endpoint,
  });
  logger.info(`Push subscription removed for user=${userId}`);
}

// ---------------------------------------------------------------------------
// sendPushNotification — send via web-push protocol
// ---------------------------------------------------------------------------
export async function sendPushNotification(
  subscription: { endpoint: string; keys_p256dh: string; keys_auth: string },
  payload: PushPayload,
): Promise<boolean> {
  const vapid = getVapidConfig();

  if (!vapid.publicKey || !vapid.privateKey) {
    logger.warn("VAPID keys not configured — skipping push notification");
    return false;
  }

  try {
    // Dynamic import web-push (may not be installed in all envs)
    const webpush = await import("web-push");

    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys_p256dh,
          auth: subscription.keys_auth,
        },
      },
      JSON.stringify(payload),
    );

    return true;
  } catch (err: any) {
    // 410 Gone or 404 means the subscription is expired/invalid — clean it up
    if (err.statusCode === 410 || err.statusCode === 404) {
      logger.info(`Push subscription expired, removing: ${subscription.endpoint.slice(0, 60)}...`);
      const db = getDB();
      await db.deleteMany("push_subscriptions", { endpoint: subscription.endpoint });
      return false;
    }

    logger.error(`Push notification error: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// sendToUser — send push notification to all subscriptions for a user
// ---------------------------------------------------------------------------
async function sendToUser(userId: number, payload: PushPayload): Promise<void> {
  const db = getDB();
  const [rows] = await db.raw<any>(
    `SELECT * FROM push_subscriptions WHERE user_id = ?`,
    [userId],
  );

  if (!rows || rows.length === 0) return;

  const results = await Promise.allSettled(
    rows.map((sub: any) => sendPushNotification(sub, payload)),
  );

  const sent = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
  logger.debug(`Push notifications sent to user=${userId}: ${sent}/${rows.length} succeeded`);
}

// ---------------------------------------------------------------------------
// notifyKudosReceived — notify when someone receives kudos
// ---------------------------------------------------------------------------
export async function notifyKudosReceived(
  userId: number,
  kudosData: {
    senderName: string;
    message: string;
    points: number;
    kudosId: string;
  },
): Promise<void> {
  try {
    await sendToUser(userId, {
      title: `${kudosData.senderName} recognized you!`,
      body: kudosData.message.length > 120
        ? kudosData.message.slice(0, 117) + "..."
        : kudosData.message,
      icon: "/icons/kudos-192.png",
      badge: "/icons/badge-72.png",
      tag: `kudos-${kudosData.kudosId}`,
      data: {
        type: "kudos_received",
        kudosId: kudosData.kudosId,
        points: kudosData.points,
        url: "/feed",
      },
    });
  } catch (err: any) {
    logger.warn(`Failed to send kudos push notification to user=${userId}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// notifyBadgeEarned — notify badge earned
// ---------------------------------------------------------------------------
export async function notifyBadgeEarned(
  userId: number,
  badgeData: {
    badgeName: string;
    badgeDescription: string | null;
    badgeId: string;
  },
): Promise<void> {
  try {
    await sendToUser(userId, {
      title: `You earned a badge: ${badgeData.badgeName}!`,
      body: badgeData.badgeDescription || "Congratulations on your achievement!",
      icon: "/icons/badge-192.png",
      badge: "/icons/badge-72.png",
      tag: `badge-${badgeData.badgeId}`,
      data: {
        type: "badge_earned",
        badgeId: badgeData.badgeId,
        url: "/badges",
      },
    });
  } catch (err: any) {
    logger.warn(`Failed to send badge push notification to user=${userId}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// notifyMilestoneAchieved — notify milestone
// ---------------------------------------------------------------------------
export async function notifyMilestoneAchieved(
  userId: number,
  milestoneData: {
    milestoneName: string;
    milestoneDescription: string | null;
    pointsAwarded: number;
    achievementId: string;
  },
): Promise<void> {
  try {
    const body = milestoneData.pointsAwarded > 0
      ? `${milestoneData.milestoneDescription || "You reached a new milestone!"} (+${milestoneData.pointsAwarded} points)`
      : milestoneData.milestoneDescription || "You reached a new milestone!";

    await sendToUser(userId, {
      title: `Milestone: ${milestoneData.milestoneName}`,
      body,
      icon: "/icons/milestone-192.png",
      badge: "/icons/badge-72.png",
      tag: `milestone-${milestoneData.achievementId}`,
      data: {
        type: "milestone_achieved",
        achievementId: milestoneData.achievementId,
        url: "/milestones",
      },
    });
  } catch (err: any) {
    logger.warn(`Failed to send milestone push notification to user=${userId}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// testPush — send a test push notification to a user's subscriptions
// ---------------------------------------------------------------------------
export async function testPush(userId: number): Promise<{ sent: number; total: number }> {
  const db = getDB();
  const [rows] = await db.raw<any>(
    `SELECT * FROM push_subscriptions WHERE user_id = ?`,
    [userId],
  );

  if (!rows || rows.length === 0) {
    return { sent: 0, total: 0 };
  }

  const results = await Promise.allSettled(
    rows.map((sub: any) =>
      sendPushNotification(sub, {
        title: "EMP Rewards",
        body: "Push notifications are working! You will receive recognition alerts here.",
        icon: "/icons/kudos-192.png",
        tag: "test-push",
        data: { type: "test", url: "/settings" },
      }),
    ),
  );

  const sent = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
  return { sent, total: rows.length };
}
