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
} from "lucide-react";
import { apiGet } from "@/api/client";
import { getUser } from "@/lib/auth-store";
import { cn, formatDate, getInitials } from "@/lib/utils";

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
      iconClass: "bg-blue-50 text-blue-600 ring-blue-100",
      to: "/kudos?tab=sent",
      ariaLabel: "View kudos you have sent",
    },
    {
      label: "Kudos Received",
      value: kudosReceivedCount,
      icon: Heart,
      iconClass: "bg-pink-50 text-pink-600 ring-pink-100",
      to: "/kudos?tab=received",
      ariaLabel: "View kudos you have received",
    },
    {
      label: "Badges Earned",
      value: myBadgeCount,
      icon: Award,
      iconClass: "bg-purple-50 text-purple-600 ring-purple-100",
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Welcome back, {user?.firstName || "there"}!
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Here's your recognition overview and activity summary.
          </p>
        </div>
        <button
          onClick={() => navigate("/kudos/send")}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-amber-500/30 transition hover:bg-amber-600 hover:shadow-amber-500/40"
        >
          <Heart className="h-4 w-4" />
          Send Kudos
        </button>
      </div>

      {/* ── Top row: points hero + stat cards ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Points hero — the celebratory centerpiece */}
        <Link
          to="/rewards"
          aria-label="View rewards you can redeem with your points"
          className="group relative col-span-1 overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 p-6 text-white shadow-lg shadow-amber-500/30 transition hover:shadow-xl hover:shadow-amber-500/40 lg:col-span-5"
        >
          {/* Decorative coins */}
          <Coins className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 text-white/10" />
          <Sparkles className="pointer-events-none absolute right-6 bottom-5 h-6 w-6 text-white/30" />

          <div className="relative">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-50">
              <Trophy className="h-4 w-4" />
              Points Balance
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-5xl font-extrabold leading-none tracking-tight">
                {(balance?.current_balance ?? 0).toLocaleString()}
              </span>
              <span className="mb-1 text-lg font-semibold text-amber-50">pts</span>
            </div>

            {balance && (
              <div className="mt-5 flex items-center gap-5 text-sm">
                <span className="inline-flex items-center gap-1.5 text-amber-50">
                  <TrendingUp className="h-4 w-4" />
                  <span className="font-semibold">{Number(balance.total_earned).toLocaleString()}</span>
                  <span className="text-amber-100/80">earned</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-amber-50">
                  <TrendingDown className="h-4 w-4" />
                  <span className="font-semibold">{Number(balance.total_redeemed).toLocaleString()}</span>
                  <span className="text-amber-100/80">spent</span>
                </span>
              </div>
            )}

            <div className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold backdrop-blur-sm transition group-hover:bg-white/25">
              <Gift className="h-4 w-4" />
              Redeem rewards
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </div>
          </div>
        </Link>

        {/* Stat cards */}
        <div className="col-span-1 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-7">
          {statCards.map((stat) => (
            <Link
              key={stat.label}
              to={stat.to}
              aria-label={stat.ariaLabel}
              className="group flex flex-col justify-between rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <div
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-xl ring-4",
                  stat.iconClass,
                )}
              >
                <stat.icon className="h-5 w-5" />
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold tracking-tight text-gray-900">
                  {stat.value.toLocaleString()}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-500">
                  {stat.label}
                  <ArrowRight className="h-3 w-3 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recent activity ────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Sparkles className="h-4 w-4" />
            </span>
            Recent Activity
          </h2>
          <button
            onClick={() => navigate("/feed")}
            className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 transition hover:text-amber-700"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {recentKudos.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
              <Gift className="h-6 w-6 text-amber-400" />
            </div>
            <p className="mt-3 text-sm text-gray-500">
              No activity yet. Start by sending kudos to a teammate!
            </p>
            <button
              onClick={() => navigate("/kudos/send")}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600"
            >
              <Heart className="h-4 w-4" />
              Send Your First Kudos
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recentKudos.map((kudos) => (
              <li key={kudos.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/kudos/${kudos.id}`)}
                  className="flex w-full items-start gap-3 px-6 py-4 text-left transition hover:bg-amber-50/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-amber-200 text-sm font-semibold text-amber-700">
                    {kudos.is_anonymous
                      ? "?"
                      : getInitials(kudos.sender_name || `User ${kudos.sender_id}`)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900">
                      <span className="font-semibold">
                        {kudos.is_anonymous
                          ? "Anonymous"
                          : kudos.sender_name || `User #${kudos.sender_id}`}
                      </span>
                      <span className="text-gray-500"> recognized </span>
                      <span className="font-semibold">
                        {kudos.receiver_name || `User #${kudos.receiver_id}`}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-sm text-gray-500">{kudos.message}</p>
                    <p className="mt-1 text-xs text-gray-400">{formatDate(kudos.created_at)}</p>
                  </div>
                  {kudos.points > 0 && (
                    <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
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
