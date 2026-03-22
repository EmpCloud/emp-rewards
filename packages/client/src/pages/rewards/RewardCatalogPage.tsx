import { useState, useEffect } from "react";
import { Gift, Search, ShoppingCart, Coins, Loader2, Plus, AlertCircle } from "lucide-react";
import { apiGet, apiPost } from "@/api/client";
import { useAuthStore } from "@/lib/auth-store";
import type { RewardCatalogItem, PointBalance, PaginatedResponse } from "@emp-rewards/shared";
import { REWARD_CATEGORIES } from "@emp-rewards/shared";

export function RewardCatalogPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "org_admin" || user?.role === "hr_admin" || user?.role === "super_admin";

  const [rewards, setRewards] = useState<RewardCatalogItem[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchRewards = async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { page, perPage: 12 };
      if (categoryFilter !== "all") params.category = categoryFilter;

      const res = await apiGet<PaginatedResponse<RewardCatalogItem>>("/rewards", params);
      if (res.data) {
        setRewards(res.data.data);
        setTotalPages(res.data.totalPages);
      }
    } catch {
      setError("Failed to load rewards");
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async () => {
    try {
      const res = await apiGet<{ current_balance: number }>("/points/balance");
      if (res.data) {
        setBalance(res.data.current_balance);
      }
    } catch {
      // Balance endpoint may not exist yet — default to 0
    }
  };

  useEffect(() => {
    fetchRewards();
    fetchBalance();
  }, [page, categoryFilter]);

  const handleRedeem = async (rewardId: string, rewardName: string) => {
    if (!confirm(`Redeem "${rewardName}"? Points will be deducted from your balance.`)) return;

    setRedeemingId(rewardId);
    setError(null);
    setSuccess(null);

    try {
      await apiPost(`/rewards/${rewardId}/redeem`);
      setSuccess(`Successfully redeemed "${rewardName}"!`);
      fetchBalance();
      fetchRewards();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to redeem reward");
    } finally {
      setRedeemingId(null);
    }
  };

  const filteredRewards = rewards.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(search.toLowerCase()))
  );

  const getCategoryLabel = (cat: string) =>
    REWARD_CATEGORIES.find((c) => c.value === cat)?.label || cat;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reward Catalog</h1>
          <p className="mt-1 text-sm text-gray-500">Browse and redeem rewards with your points.</p>
        </div>
        {isAdmin && (
          <button className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors">
            <Plus className="h-4 w-4" />
            Add Reward
          </button>
        )}
      </div>

      {/* Points Balance Banner */}
      <div className="rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 p-6 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-white/20 p-3">
            <Coins className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-amber-100">Your Point Balance</p>
            <p className="text-3xl font-bold">{balance.toLocaleString()} pts</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <ShoppingCart className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search rewards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          <option value="all">All Categories</option>
          {REWARD_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Rewards Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      ) : filteredRewards.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Gift className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            {search || categoryFilter !== "all"
              ? "No rewards match your filters."
              : "No rewards available yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredRewards.map((reward) => {
            const canAfford = balance >= reward.points_cost;
            const outOfStock = reward.quantity_available !== null && reward.quantity_available <= 0;
            const isRedeeming = redeemingId === reward.id;

            return (
              <div
                key={reward.id}
                className="group rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md overflow-hidden"
              >
                {/* Image */}
                <div className="relative h-40 bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center">
                  {reward.image_url ? (
                    <img
                      src={reward.image_url}
                      alt={reward.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Gift className="h-16 w-16 text-amber-300" />
                  )}
                  <span className="absolute top-2 right-2 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    {getCategoryLabel(reward.category)}
                  </span>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 truncate">{reward.name}</h3>
                  {reward.description && (
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                      {reward.description}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Coins className="h-4 w-4 text-amber-500" />
                      <span className="text-lg font-bold text-amber-600">
                        {reward.points_cost.toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-400">pts</span>
                    </div>
                    {reward.quantity_available !== null && (
                      <span
                        className={`text-xs font-medium ${
                          reward.quantity_available <= 0
                            ? "text-red-500"
                            : reward.quantity_available <= 5
                              ? "text-amber-500"
                              : "text-gray-400"
                        }`}
                      >
                        {reward.quantity_available <= 0
                          ? "Out of stock"
                          : `${reward.quantity_available} left`}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleRedeem(reward.id, reward.name)}
                    disabled={!canAfford || outOfStock || isRedeeming}
                    className={`mt-4 w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      !canAfford || outOfStock
                        ? "cursor-not-allowed bg-gray-100 text-gray-400"
                        : "bg-amber-600 text-white hover:bg-amber-700"
                    }`}
                  >
                    {isRedeeming ? (
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    ) : outOfStock ? (
                      "Out of Stock"
                    ) : !canAfford ? (
                      "Insufficient Points"
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <ShoppingCart className="h-4 w-4" />
                        Redeem
                      </span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
