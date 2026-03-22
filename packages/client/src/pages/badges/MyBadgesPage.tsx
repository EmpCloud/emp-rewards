import { useState, useEffect } from "react";
import { Award, Star, Trophy, Lock, Loader2 } from "lucide-react";
import { apiGet } from "@/api/client";
import { getUser } from "@/lib/auth-store";
import { cn, formatDate } from "@/lib/utils";

interface BadgeDefinition {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  criteria_type: string;
  criteria_value: number | null;
  points_awarded: number;
}

interface UserBadge {
  id: string;
  badge_id: string;
  awarded_reason: string | null;
  created_at: string;
}

const CRITERIA_LABELS: Record<string, string> = {
  manual: "Manual Award",
  auto_kudos_count: "kudos received",
  auto_tenure: "months of tenure",
  auto_points: "points earned",
  auto_kudos_streak: "day streak",
};

const BADGE_ICONS = [
  { icon: Award, earnedColor: "bg-amber-100 text-amber-600", lockedColor: "bg-gray-100 text-gray-400" },
  { icon: Star, earnedColor: "bg-purple-100 text-purple-600", lockedColor: "bg-gray-100 text-gray-400" },
  { icon: Trophy, earnedColor: "bg-blue-100 text-blue-600", lockedColor: "bg-gray-100 text-gray-400" },
];

export function MyBadgesPage() {
  const user = getUser();
  const [allBadges, setAllBadges] = useState<BadgeDefinition[]>([]);
  const [myBadges, setMyBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [badgesRes, myRes] = await Promise.all([
          apiGet<any>("/badges"),
          apiGet<any>("/badges/my"),
        ]);

        if (badgesRes.success && badgesRes.data) {
          setAllBadges(Array.isArray(badgesRes.data) ? badgesRes.data : []);
        }
        if (myRes.success && myRes.data) {
          setMyBadges(Array.isArray(myRes.data) ? myRes.data : []);
        }
      } catch {
        // handled by interceptor
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const earnedBadgeIds = new Set(myBadges.map((b) => b.badge_id));
  const earnedMap = new Map(myBadges.map((b) => [b.badge_id, b]));

  const earned = allBadges.filter((b) => earnedBadgeIds.has(b.id));
  const locked = allBadges.filter((b) => !earnedBadgeIds.has(b.id));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Badges</h1>
        <p className="mt-1 text-sm text-gray-500">Badges and achievements you have earned.</p>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 rounded-lg border border-gray-200 bg-white px-6 py-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-amber-600">{earned.length}</p>
          <p className="text-xs text-gray-500">Earned</p>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-400">{locked.length}</p>
          <p className="text-xs text-gray-500">Locked</p>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{allBadges.length}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
      </div>

      {/* Earned badges */}
      {earned.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Earned Badges</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {earned.map((badge, idx) => {
              const iconSet = BADGE_ICONS[idx % BADGE_ICONS.length];
              const IconComp = iconSet.icon;
              const userBadge = earnedMap.get(badge.id);

              return (
                <div
                  key={badge.id}
                  className="rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm"
                >
                  <div className={cn("flex h-14 w-14 items-center justify-center rounded-xl", iconSet.earnedColor)}>
                    <IconComp className="h-7 w-7" />
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-gray-900">{badge.name}</h3>
                  {badge.description && (
                    <p className="mt-1 text-sm text-gray-500">{badge.description}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    {badge.points_awarded > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        +{badge.points_awarded} pts
                      </span>
                    )}
                    {userBadge && (
                      <span className="text-xs text-gray-400">
                        Earned {formatDate(userBadge.created_at)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Locked badges */}
      {locked.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Locked Badges</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locked.map((badge, idx) => {
              const iconSet = BADGE_ICONS[idx % BADGE_ICONS.length];

              return (
                <div
                  key={badge.id}
                  className="rounded-lg border border-gray-200 bg-gray-50/50 p-5 opacity-75"
                >
                  <div className={cn("flex h-14 w-14 items-center justify-center rounded-xl", iconSet.lockedColor)}>
                    <Lock className="h-6 w-6" />
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-gray-500">{badge.name}</h3>
                  {badge.description && (
                    <p className="mt-1 text-sm text-gray-400">{badge.description}</p>
                  )}
                  {badge.criteria_type !== "manual" && badge.criteria_value && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">
                          {badge.criteria_value} {CRITERIA_LABELS[badge.criteria_type] || badge.criteria_type} needed
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-200">
                        <div
                          className="h-1.5 rounded-full bg-gray-400 transition-all"
                          style={{ width: "0%" }}
                        />
                      </div>
                    </div>
                  )}
                  {badge.criteria_type === "manual" && (
                    <p className="mt-3 text-xs text-gray-400">Awarded by admins</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {allBadges.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Award className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No badges available yet.</p>
        </div>
      )}
    </div>
  );
}
