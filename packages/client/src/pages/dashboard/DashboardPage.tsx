import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Heart,
  Trophy,
  Award,
  Gift,
  ArrowRight,
  Loader2,
  TrendingUp,
  TrendingDown,
  Send,
  Coins,
  Sparkles,
  Swords,
  UserPlus,
  Crown,
} from "lucide-react";
import { apiGet } from "@/api/client";
import { getUser } from "@/lib/auth-store";
import { cn, formatDate, getInitials, activeLocale } from "@/lib/utils";
import { tr } from "@/lib/i18n";

interface KudosItem {
  id: string;
  sender_id: number;
  receiver_id: number;
  message: string;
  points: number;
  is_anonymous: boolean;
  created_at: string;
  sender_name?: string;
  receiver_name?: string;
}

interface PointBalance {
  current_balance: number;
  total_earned: number;
  total_redeemed: number;
}

// Presentational reward tiers based on lifetime points earned. Purely a
// client-side gamification layer — no backend field drives this, so the
// thresholds live here and can be tuned freely.
const TIERS = [
  { name: "Bronze", min: 0, next: 500, chip: "bg-orange-100 text-orange-700" },
  { name: "Silver", min: 500, next: 1500, chip: "bg-gray-200 text-gray-700" },
  { name: "Gold", min: 1500, next: 4000, chip: "bg-amber-100 text-amber-700" },
  { name: "Platinum", min: 4000, next: Infinity, chip: "bg-violet-100 text-violet-700" },
];

function tierFor(earned: number) {
  const idx = TIERS.reduce((acc, t, i) => (earned >= t.min ? i : acc), 0);
  const tier = TIERS[idx];
  const span = tier.next === Infinity ? 0 : tier.next - tier.min;
  const progress = tier.next === Infinity ? 100 : Math.min(100, Math.round(((earned - tier.min) / span) * 100));
  const toNext = tier.next === Infinity ? 0 : Math.max(0, tier.next - earned);
  const nextName = TIERS[idx + 1]?.name ?? null;
  return { ...tier, progress, toNext, nextName, isMax: tier.next === Infinity };
}

// Distinct soft-color rotation for feed avatars so the list isn't one amber block.
const AVATAR_PALETTE = [
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
];
function avatarTone(seed: number) {
  return AVATAR_PALETTE[Math.abs(seed) % AVATAR_PALETTE.length];
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  org_admin: "Org Admin",
  hr_admin: "HR Admin",
  hr_manager: "HR Manager",
  employee: "Employee",
};

// Quick actions — pure navigation, no data. Icon-forward buttons for the most
// common recognition tasks.
const QUICK_ACTIONS = [
  { label: "Send Kudos", icon: Heart, to: "/kudos/send", tone: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" },
  { label: "Redeem", icon: Gift, to: "/rewards", tone: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" },
  { label: "Leaderboard", icon: Trophy, to: "/leaderboard", tone: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400" },
  { label: "Join Challenge", icon: Swords, to: "/challenges", tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
  { label: "Nominate", icon: UserPlus, to: "/nominations/submit", tone: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400" },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const user = getUser();
  const [balance, setBalance] = useState<PointBalance | null>(null);
  const [recentKudos, setRecentKudos] = useState<KudosItem[]>([]);
  const [myBadgeCount, setMyBadgeCount] = useState(0);
  const [kudosSentCount, setKudosSentCount] = useState(0);
  const [kudosReceivedCount, setKudosReceivedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [balanceRes, kudosRes, badgesRes] = await Promise.all([
          apiGet<any>("/points/balance"),
          apiGet<any>("/kudos", { page: 1, perPage: 5 }),
          apiGet<any>("/badges/my"),
        ]);

        if (balanceRes.success && balanceRes.data) {
          setBalance(balanceRes.data);
        }

        if (kudosRes.success && kudosRes.data) {
          const allKudos: KudosItem[] = kudosRes.data.data || [];
          setRecentKudos(allKudos.slice(0, 5));
          const userId = user?.empcloudUserId;
          setKudosSentCount(allKudos.filter((k) => k.sender_id === userId).length);
          setKudosReceivedCount(allKudos.filter((k) => k.receiver_id === userId).length);
        }

        if (badgesRes.success && badgesRes.data) {
          setMyBadgeCount(Array.isArray(badgesRes.data) ? badgesRes.data.length : 0);
        }
      } catch {
        // handled by interceptor
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.empcloudUserId]);

  // Each card deep-links to the page that explains its number.
  const statCards = [
    {
      label: "Kudos Sent",
      value: kudosSentCount,
      icon: Send,
      iconClass: "bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-400 dark:ring-blue-500/10",
      to: "/kudos?tab=sent",
      ariaLabel: "View kudos you have sent",
    },
    {
      label: "Kudos Received",
      value: kudosReceivedCount,
      icon: Heart,
      iconClass: "bg-pink-50 text-pink-600 ring-pink-100 dark:bg-pink-500/15 dark:text-pink-400 dark:ring-pink-500/10",
      to: "/kudos?tab=received",
      ariaLabel: "View kudos you have received",
    },
    {
      label: "Badges Earned",
      value: myBadgeCount,
      icon: Award,
      iconClass: "bg-purple-50 text-purple-600 ring-purple-100 dark:bg-purple-500/15 dark:text-purple-400 dark:ring-purple-500/10",
      to: "/badges/mine",
      ariaLabel: "View badges you have earned",
    },
  ];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  const displayName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "there";
  const roleLabel = ROLE_LABELS[user?.role || "employee"] || "Employee";
  const tier = tierFor(Number(balance?.total_earned ?? 0));

  return (
    <div className="space-y-4">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-amber-50 via-white to-white px-5 py-4 dark:border-gray-800 dark:from-amber-500/10 dark:via-transparent">
        <Sparkles className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 text-amber-500/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-base font-bold text-white shadow-sm shadow-amber-500/30">
              {getInitials(displayName)}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900">
                {tr("Welcome back,")} {user?.firstName || "there"}!
              </h1>
              <p className="text-sm text-gray-500">
                {tr(roleLabel)} · {tr("Here's your recognition overview.")}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/kudos/send")}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-amber-500/30 transition hover:bg-amber-600 hover:shadow-amber-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Heart className="h-4 w-4" />
            {tr("Send Kudos")}
          </button>
        </div>
      </div>

      {/* ── Points hero + KPI cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Points balance — orange gradient centerpiece with tier + progress */}
        <Link
          to="/rewards"
          aria-label={tr("View rewards you can redeem with your points")}
          className="group relative col-span-1 overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 p-5 text-white shadow-lg shadow-amber-500/30 transition hover:shadow-xl hover:shadow-amber-500/40 lg:col-span-5"
        >
          <Coins className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 text-white/10" />
          <Sparkles className="pointer-events-none absolute right-5 bottom-4 h-5 w-5 text-white/30" />

          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-50">
                <Trophy className="h-4 w-4" />
                {tr("Points Balance")}
              </div>
              {/* Tier badge */}
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">
                <Crown className="h-3.5 w-3.5" />
                {tr(tier.name)}
              </span>
            </div>

            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-extrabold leading-none tracking-tight">
                {(balance?.current_balance ?? 0).toLocaleString(activeLocale())}
              </span>
              <span className="mb-0.5 text-base font-semibold text-amber-50">{tr("pts")}</span>
            </div>

            {balance && (
              <div className="mt-3 flex items-center gap-5 text-sm">
                <span className="inline-flex items-center gap-1.5 text-amber-50">
                  <TrendingUp className="h-4 w-4" />
                  <span className="font-semibold">{Number(balance.total_earned).toLocaleString(activeLocale())}</span>
                  <span className="text-amber-100/80">{tr("earned")}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-amber-50">
                  <TrendingDown className="h-4 w-4" />
                  <span className="font-semibold">{Number(balance.total_redeemed).toLocaleString(activeLocale())}</span>
                  <span className="text-amber-100/80">{tr("spent")}</span>
                </span>
              </div>
            )}

            {/* Progress toward next tier */}
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs text-amber-50/90">
                <span>{tier.isMax ? tr("Top tier reached") : `${tr("Next:")} ${tr(tier.nextName || "")}`}</span>
                {!tier.isMax && <span>{tier.toNext.toLocaleString(activeLocale())} {tr("pts to go")}</span>}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-white" style={{ width: `${tier.progress}%` }} />
              </div>
            </div>

            <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold backdrop-blur-sm transition group-hover:bg-white/25">
              <Gift className="h-4 w-4" />
              {tr("Redeem rewards")}
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </div>
          </div>
        </Link>

        {/* KPI cards — compact horizontal layout; auto-rows so they size to
            content instead of stretching to the tall points card. */}
        <div className="col-span-1 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-7 lg:content-start lg:auto-rows-min">
          {statCards.map((stat) => (
            <Link
              key={stat.label}
              to={stat.to}
              aria-label={stat.ariaLabel}
              className="group flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", stat.iconClass)}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold tracking-tight text-gray-900">
                  {stat.value.toLocaleString(activeLocale())}
                </p>
                <p className="flex items-center gap-1 text-sm text-gray-500">
                  {tr(stat.label)}
                  <ArrowRight className="h-3 w-3 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Quick Actions ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">{tr("Quick Actions")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className="group flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-3 text-center transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl transition group-hover:scale-105", a.tone)}>
                <a.icon className="h-[18px] w-[18px]" />
              </span>
              <span className="text-xs font-medium text-gray-700">{tr(a.label)}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recent activity ────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <Sparkles className="h-4 w-4" />
            </span>
            {tr("Recent Activity")}
          </h2>
          <button
            onClick={() => navigate("/feed")}
            className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 transition hover:text-amber-700"
          >
            {tr("View all")}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {recentKudos.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-500/15">
              <Gift className="h-7 w-7 text-amber-500 dark:text-amber-400" />
            </div>
            <p className="mt-4 text-sm font-medium text-gray-900">{tr("No recognition yet")}</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500">
              Kick things off by sending kudos to a teammate — it only takes a moment.
            </p>
            <button
              onClick={() => navigate("/kudos/send")}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600"
            >
              <Heart className="h-4 w-4" />
              {tr("Send your first kudos")}
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 p-2">
            {recentKudos.map((kudos) => (
              <li key={kudos.id} className="px-0">
                <button
                  type="button"
                  onClick={() => navigate(`/kudos/${kudos.id}`)}
                  className="flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-gray-50"
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      kudos.is_anonymous
                        ? "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300"
                        : avatarTone(kudos.sender_id),
                    )}
                  >
                    {kudos.is_anonymous ? "?" : getInitials(kudos.sender_name || `User ${kudos.sender_id}`)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900">
                      <span className="font-semibold">
                        {kudos.is_anonymous ? tr("Anonymous") : kudos.sender_name || `User #${kudos.sender_id}`}
                      </span>
                      <span className="text-gray-500"> {tr("recognized")} </span>
                      <span className="font-semibold">
                        {kudos.receiver_name || `User #${kudos.receiver_id}`}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-sm text-gray-500">{kudos.message}</p>
                    <p className="mt-1 text-xs text-gray-400">{formatDate(kudos.created_at)}</p>
                  </div>
                  {kudos.points > 0 && (
                    <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                      <Coins className="h-3 w-3" />
                      +{kudos.points}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
