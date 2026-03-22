import { useState, useEffect, useCallback } from "react";
import {
  Cake,
  Trophy,
  PartyPopper,
  Gift,
  Heart,
  Send,
  Calendar,
  Loader2,
  Star,
  ChevronRight,
  Plus,
} from "lucide-react";
import { apiGet, apiPost } from "@/api/client";
import { getUser } from "@/lib/auth-store";
import { cn, formatDate, getInitials } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CelebrationItem {
  id: string;
  organization_id: number;
  user_id: number;
  type: string;
  title: string;
  description: string | null;
  celebration_date: string;
  metadata: Record<string, any> | null;
  is_auto_generated: boolean;
  created_at: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  designation?: string;
  wish_count?: number;
}

interface CelebrationWish {
  id: string;
  celebration_id: string;
  user_id: number;
  message: string;
  created_at: string;
  first_name?: string;
  last_name?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCelebrationIcon(type: string) {
  switch (type) {
    case "birthday":
      return Cake;
    case "work_anniversary":
      return Trophy;
    case "promotion":
      return Star;
    case "new_joiner":
      return Gift;
    default:
      return PartyPopper;
  }
}

function getCelebrationStyle(type: string) {
  switch (type) {
    case "birthday":
      return {
        bg: "bg-pink-50",
        border: "border-pink-200",
        iconBg: "bg-pink-100",
        iconColor: "text-pink-600",
        accent: "text-pink-700",
        badge: "bg-pink-100 text-pink-700",
      };
    case "work_anniversary":
      return {
        bg: "bg-amber-50",
        border: "border-amber-300",
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
        accent: "text-amber-700",
        badge: "bg-amber-100 text-amber-700",
      };
    case "promotion":
      return {
        bg: "bg-purple-50",
        border: "border-purple-200",
        iconBg: "bg-purple-100",
        iconColor: "text-purple-600",
        accent: "text-purple-700",
        badge: "bg-purple-100 text-purple-700",
      };
    default:
      return {
        bg: "bg-blue-50",
        border: "border-blue-200",
        iconBg: "bg-blue-100",
        iconColor: "text-blue-600",
        accent: "text-blue-700",
        badge: "bg-blue-100 text-blue-700",
      };
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case "birthday":
      return "Birthday";
    case "work_anniversary":
      return "Work Anniversary";
    case "promotion":
      return "Promotion";
    case "new_joiner":
      return "New Joiner";
    default:
      return "Celebration";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CelebrationPage() {
  const user = getUser();
  const [todayCelebrations, setTodayCelebrations] = useState<CelebrationItem[]>([]);
  const [upcomingCelebrations, setUpcomingCelebrations] = useState<CelebrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishInputs, setWishInputs] = useState<Record<string, string>>({});
  const [expandedWishes, setExpandedWishes] = useState<Set<string>>(new Set());
  const [wishesMap, setWishesMap] = useState<Record<string, CelebrationWish[]>>({});
  const [sendingWish, setSendingWish] = useState<string | null>(null);

  const fetchCelebrations = useCallback(async () => {
    setLoading(true);
    try {
      const [todayRes, upcomingRes] = await Promise.all([
        apiGet<CelebrationItem[]>("/celebrations/today"),
        apiGet<CelebrationItem[]>("/celebrations/upcoming"),
      ]);
      if (todayRes.success && todayRes.data) {
        setTodayCelebrations(todayRes.data);
      }
      if (upcomingRes.success && upcomingRes.data) {
        setUpcomingCelebrations(upcomingRes.data);
      }
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCelebrations();
  }, [fetchCelebrations]);

  const fetchWishes = async (celebrationId: string) => {
    try {
      const res = await apiGet<{ celebration: any; wishes: CelebrationWish[] }>(
        `/celebrations/${celebrationId}`,
      );
      if (res.success && res.data) {
        setWishesMap((prev) => ({ ...prev, [celebrationId]: res.data!.wishes || [] }));
      }
    } catch {
      // silent
    }
  };

  const toggleWishes = (celebrationId: string) => {
    setExpandedWishes((prev) => {
      const next = new Set(prev);
      if (next.has(celebrationId)) {
        next.delete(celebrationId);
      } else {
        next.add(celebrationId);
        if (!wishesMap[celebrationId]) {
          fetchWishes(celebrationId);
        }
      }
      return next;
    });
  };

  const handleSendWish = async (celebrationId: string) => {
    const message = wishInputs[celebrationId]?.trim();
    if (!message) return;

    setSendingWish(celebrationId);
    try {
      await apiPost(`/celebrations/${celebrationId}/wish`, { message });
      setWishInputs((prev) => ({ ...prev, [celebrationId]: "" }));
      await fetchWishes(celebrationId);
      // Re-fetch to update wish counts
      fetchCelebrations();
    } catch {
      // silent
    } finally {
      setSendingWish(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Celebrations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Birthdays, work anniversaries, and special moments across your organization.
        </p>
      </div>

      {/* Today's Celebrations — Hero Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <PartyPopper className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900">Today</h2>
          {todayCelebrations.length > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              {todayCelebrations.length}
            </span>
          )}
        </div>

        {todayCelebrations.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <Calendar className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No celebrations today.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {todayCelebrations.map((celebration) => {
              const style = getCelebrationStyle(celebration.type);
              const Icon = getCelebrationIcon(celebration.type);
              const wishes = wishesMap[celebration.id] || [];
              const isExpanded = expandedWishes.has(celebration.id);

              return (
                <div
                  key={celebration.id}
                  className={cn(
                    "rounded-xl border-2 p-5 transition-shadow hover:shadow-md",
                    style.bg,
                    style.border,
                  )}
                >
                  {/* Icon + Type Badge */}
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-full",
                        style.iconBg,
                      )}
                    >
                      <Icon className={cn("h-6 w-6", style.iconColor)} />
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        style.badge,
                      )}
                    >
                      {getTypeLabel(celebration.type)}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className={cn("font-semibold text-base", style.accent)}>
                    {celebration.title}
                  </h3>

                  {/* User info */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-xs font-semibold text-gray-700">
                      {getInitials(
                        `${celebration.first_name || ""} ${celebration.last_name || ""}`,
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {celebration.first_name} {celebration.last_name}
                      </p>
                      {celebration.designation && (
                        <p className="text-xs text-gray-500">{celebration.designation}</p>
                      )}
                    </div>
                  </div>

                  {celebration.description && (
                    <p className="mt-2 text-sm text-gray-600">{celebration.description}</p>
                  )}

                  {/* Anniversary years */}
                  {celebration.type === "work_anniversary" && celebration.metadata && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/60 px-2.5 py-1 text-xs font-medium text-amber-800">
                        <Trophy className="h-3 w-3" />
                        {celebration.metadata.years} year
                        {celebration.metadata.years !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}

                  {/* Wish count + toggle */}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => toggleWishes(celebration.id)}
                      className="inline-flex items-center gap-1 rounded-full bg-white/60 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white/80 transition-colors"
                    >
                      <Heart className="h-3.5 w-3.5" />
                      {celebration.wish_count || 0} wish
                      {(celebration.wish_count || 0) !== 1 ? "es" : ""}
                      <ChevronRight
                        className={cn(
                          "h-3 w-3 transition-transform",
                          isExpanded && "rotate-90",
                        )}
                      />
                    </button>
                  </div>

                  {/* Wishes section */}
                  {isExpanded && (
                    <div className="mt-3 space-y-2 border-t border-white/50 pt-3">
                      {wishes.length === 0 && (
                        <p className="text-xs text-gray-400">
                          No wishes yet. Be the first!
                        </p>
                      )}
                      {wishes.map((wish) => (
                        <div key={wish.id} className="flex items-start gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-xs font-medium text-gray-600">
                            {getInitials(
                              `${wish.first_name || ""} ${wish.last_name || "U"}`,
                            )}
                          </div>
                          <div>
                            <p className="text-xs">
                              <span className="font-medium text-gray-800">
                                {wish.first_name} {wish.last_name}
                              </span>{" "}
                              <span className="text-gray-600">{wish.message}</span>
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {formatDate(wish.created_at)}
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Send wish input */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Send a wish..."
                          value={wishInputs[celebration.id] || ""}
                          onChange={(e) =>
                            setWishInputs((prev) => ({
                              ...prev,
                              [celebration.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSendWish(celebration.id);
                          }}
                          className="flex-1 rounded-lg border border-white/50 bg-white/60 px-3 py-1.5 text-xs placeholder:text-gray-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                        <button
                          onClick={() => handleSendWish(celebration.id)}
                          disabled={sendingWish === celebration.id}
                          className="rounded-lg bg-white/80 p-1.5 text-amber-600 hover:bg-white transition-colors disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Upcoming Celebrations — Timeline */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900">Upcoming (Next 7 Days)</h2>
          {upcomingCelebrations.length > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {upcomingCelebrations.length}
            </span>
          )}
        </div>

        {upcomingCelebrations.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <Calendar className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">
              No upcoming celebrations in the next 7 days.
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-amber-200" />

            <div className="space-y-4">
              {upcomingCelebrations.map((celebration) => {
                const style = getCelebrationStyle(celebration.type);
                const Icon = getCelebrationIcon(celebration.type);

                return (
                  <div key={celebration.id} className="relative flex items-start gap-4 pl-2">
                    {/* Timeline dot */}
                    <div
                      className={cn(
                        "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-sm",
                        style.iconBg,
                      )}
                    >
                      <Icon className={cn("h-4 w-4", style.iconColor)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 rounded-lg border border-gray-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                              style.badge,
                            )}
                          >
                            {getTypeLabel(celebration.type)}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDate(celebration.celebration_date)}
                          </span>
                        </div>
                      </div>
                      <h4 className="mt-1 text-sm font-medium text-gray-900">
                        {celebration.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                          {getInitials(
                            `${celebration.first_name || ""} ${celebration.last_name || ""}`,
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {celebration.first_name} {celebration.last_name}
                          {celebration.designation ? ` - ${celebration.designation}` : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
