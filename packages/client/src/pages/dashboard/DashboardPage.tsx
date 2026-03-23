import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  Trophy,
  Award,
  Gift,
  ThumbsUp,
  ArrowRight,
  Loader2,
  TrendingUp,
  Send,
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
          // Count sent/received for current user
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

  const statCards = [
    {
      label: "Points Balance",
      value: balance?.current_balance ?? 0,
      icon: Trophy,
      color: "bg-amber-50 text-amber-600",
      borderColor: "border-amber-200",
    },
    {
      label: "Kudos Sent",
      value: kudosSentCount,
      icon: Send,
      color: "bg-blue-50 text-blue-600",
      borderColor: "border-blue-200",
    },
    {
      label: "Kudos Received",
      value: kudosReceivedCount,
      icon: Heart,
      color: "bg-pink-50 text-pink-600",
      borderColor: "border-pink-200",
    },
    {
      label: "Badges Earned",
      value: myBadgeCount,
      icon: Award,
      color: "bg-purple-50 text-purple-600",
      borderColor: "border-purple-200",
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.firstName || "there"}!
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Here is your recognition overview and activity summary.
          </p>
        </div>
        <button
          onClick={() => navigate("/kudos/send")}
          className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition-colors"
        >
          <Heart className="h-4 w-4" />
          Send Kudos
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className={cn("rounded-lg border bg-white p-6", stat.borderColor)}
          >
            <div className={cn("inline-flex rounded-lg p-2.5", stat.color)}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-2xl font-bold text-gray-900">
              {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
            </p>
            <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Points summary */}
      {balance && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Points Summary</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-xl font-bold text-green-700">
                {Number(balance.total_earned).toLocaleString()}
              </p>
              <p className="text-xs text-green-600 mt-1">Total Earned</p>
            </div>
            <div className="rounded-lg bg-red-50 p-4 text-center">
              <p className="text-xl font-bold text-red-700">
                {Number(balance.total_redeemed).toLocaleString()}
              </p>
              <p className="text-xs text-red-600 mt-1">Total Spent</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-4 text-center">
              <p className="text-xl font-bold text-amber-700">
                {Number(balance.current_balance).toLocaleString()}
              </p>
              <p className="text-xs text-amber-600 mt-1">Current Balance</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent kudos feed */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <button
            onClick={() => navigate("/feed")}
            className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {recentKudos.length === 0 ? (
          <div className="py-8 text-center">
            <Gift className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">
              No activity yet. Start by sending kudos to a teammate!
            </p>
            <button
              onClick={() => navigate("/kudos/send")}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
            >
              <Heart className="h-4 w-4" />
              Send Your First Kudos
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {recentKudos.map((kudos) => (
              <div
                key={kudos.id}
                className="flex items-start gap-3 rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/kudos/${kudos.id}`)}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                  {kudos.is_anonymous
                    ? "?"
                    : getInitials(kudos.sender_name || `User ${kudos.sender_id}`)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">
                      {kudos.is_anonymous ? "Anonymous" : kudos.sender_name || `User #${kudos.sender_id}`}
                    </span>
                    {" recognized "}
                    <span className="font-medium">
                      {kudos.receiver_name || `User #${kudos.receiver_id}`}
                    </span>
                  </p>
                  <p className="text-sm text-gray-500 truncate">{kudos.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{formatDate(kudos.created_at)}</span>
                    {kudos.points > 0 && (
                      <span className="text-xs text-amber-600 font-medium">+{kudos.points} pts</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
