import { useState, useEffect } from "react";
import { Bell, Heart, Award, Gift, Loader2, ThumbsUp, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { apiGet } from "@/api/client";
import { useAuthStore } from "@/lib/auth-store";
import { cn, formatDate } from "@/lib/utils";

interface KudosItem {
  id: string;
  sender_id: number;
  receiver_id: number;
  message: string;
  points: number;
  is_anonymous: boolean;
  created_at: string;
  sender_name?: string;
}

interface BadgeItem {
  id: string;
  badge_id: string;
  awarded_reason: string | null;
  created_at: string;
}

type NotificationItem = {
  id: string;
  type: "kudos_received" | "badge_earned";
  message: string;
  points?: number;
  created_at: string;
  link: string;
};

export function NotificationsPage() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.empcloudUserId;
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const items: NotificationItem[] = [];

        // Fetch kudos received by the current user
        const kudosRes = await apiGet<any>("/kudos/received", { page: 1, perPage: 20 });
        if (kudosRes.success && kudosRes.data?.data) {
          for (const k of kudosRes.data.data as KudosItem[]) {
            items.push({
              id: `kudos-${k.id}`,
              type: "kudos_received",
              message: k.is_anonymous
                ? `Anonymous sent you kudos: "${k.message}"`
                : `${k.sender_name || `User #${k.sender_id}`} sent you kudos: "${k.message}"`,
              points: k.points,
              created_at: k.created_at,
              link: `/kudos/${k.id}`,
            });
          }
        }

        // Fetch badges earned
        const badgesRes = await apiGet<any>("/badges/my");
        if (badgesRes.success && Array.isArray(badgesRes.data)) {
          for (const b of badgesRes.data as BadgeItem[]) {
            items.push({
              id: `badge-${b.id}`,
              type: "badge_earned",
              message: b.awarded_reason
                ? `You earned a badge: ${b.awarded_reason}`
                : "You earned a new badge!",
              created_at: b.created_at,
              link: "/badges/mine",
            });
          }
        }

        // Sort by date descending
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setNotifications(items);
      } catch {
        // silently handled
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const getIcon = (type: string) => {
    switch (type) {
      case "kudos_received":
        return Heart;
      case "badge_earned":
        return Award;
      default:
        return Bell;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case "kudos_received":
        return "bg-pink-50 text-pink-600";
      case "badge_earned":
        return "bg-purple-50 text-purple-600";
      default:
        return "bg-gray-50 text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your recent recognition activity and updates.
        </p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Bell className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((item) => {
            const Icon = getIcon(item.type);
            return (
              <Link
                key={item.id}
                to={item.link}
                className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50 transition-colors"
              >
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", getIconColor(item.type))}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{item.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{formatDate(item.created_at)}</span>
                    {item.points != null && item.points > 0 && (
                      <span className="text-xs text-amber-600 font-medium">+{item.points} pts</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
