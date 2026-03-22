import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ShoppingCart,
  Loader2,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Package,
  Clock,
  AlertCircle,
  Gift,
  Coins,
  User,
} from "lucide-react";
import { apiGet, apiPut } from "@/api/client";
import { useAuthStore } from "@/lib/auth-store";
import type { RewardRedemption, RewardCatalogItem } from "@emp-rewards/shared";

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: "text-amber-600", bg: "bg-amber-100", label: "Pending Review" },
  approved: { icon: CheckCircle, color: "text-blue-600", bg: "bg-blue-100", label: "Approved" },
  rejected: { icon: XCircle, color: "text-red-600", bg: "bg-red-100", label: "Rejected" },
  fulfilled: { icon: Package, color: "text-green-600", bg: "bg-green-100", label: "Fulfilled" },
  cancelled: { icon: XCircle, color: "text-gray-500", bg: "bg-gray-100", label: "Cancelled" },
};

const TIMELINE_STEPS = ["pending", "approved", "fulfilled"];

export function RedemptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const isAdmin =
    user?.role === "org_admin" ||
    user?.role === "hr_admin" ||
    user?.role === "hr_manager" ||
    user?.role === "super_admin";

  const [redemption, setRedemption] = useState<RewardRedemption | null>(null);
  const [reward, setReward] = useState<RewardCatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiGet<RewardRedemption>(`/redemptions/${id}`);
      if (res.data) {
        setRedemption(res.data);
        // Fetch the associated reward
        try {
          const rewardRes = await apiGet<RewardCatalogItem>(`/rewards/${res.data.reward_id}`);
          if (rewardRes.data) setReward(rewardRes.data);
        } catch {
          // Reward may have been deleted
        }
      }
    } catch {
      setError("Failed to load redemption details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const handleAction = async (action: "approve" | "reject" | "fulfill" | "cancel") => {
    setActionLoading(true);
    setError(null);
    try {
      await apiPut(`/redemptions/${id}/${action}`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || `Failed to ${action}`);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!redemption) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <ShoppingCart className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-3 text-sm text-gray-500">Redemption not found.</p>
        <Link to="/redemptions" className="mt-4 inline-block text-sm text-amber-600 hover:text-amber-700">
          Back to redemptions
        </Link>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[redemption.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const isTerminal = redemption.status === "rejected" || redemption.status === "cancelled";

  // Determine timeline progress
  const currentStepIndex = isTerminal
    ? -1
    : TIMELINE_STEPS.indexOf(redemption.status);

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        to="/redemptions"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to redemptions
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Redemption Detail</h1>
          <p className="mt-1 text-sm text-gray-500">
            ID: {redemption.id.slice(0, 8)}...
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${statusConfig.bg} ${statusConfig.color}`}
        >
          <StatusIcon className="h-4 w-4" />
          {statusConfig.label}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Reward Info Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Reward Information</h2>
            <div className="flex gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                {reward?.image_url ? (
                  <img src={reward.image_url} alt={reward.name} className="h-full w-full rounded-lg object-cover" />
                ) : (
                  <Gift className="h-10 w-10 text-amber-400" />
                )}
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{reward?.name || "Reward"}</h3>
                {reward?.description && (
                  <p className="mt-1 text-sm text-gray-500">{reward.description}</p>
                )}
                <div className="mt-2 flex items-center gap-1.5">
                  <Coins className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-bold text-amber-600">
                    {redemption.points_spent.toLocaleString()} pts
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Status Timeline</h2>
            <div className="space-y-0">
              {TIMELINE_STEPS.map((step, idx) => {
                const isCompleted = currentStepIndex >= idx;
                const isCurrent = currentStepIndex === idx;

                return (
                  <div key={step} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                          isCompleted
                            ? "border-amber-500 bg-amber-500 text-white"
                            : "border-gray-300 bg-white text-gray-400"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <span className="text-xs font-medium">{idx + 1}</span>
                        )}
                      </div>
                      {idx < TIMELINE_STEPS.length - 1 && (
                        <div
                          className={`h-8 w-0.5 ${
                            isCompleted && !isCurrent ? "bg-amber-500" : "bg-gray-200"
                          }`}
                        />
                      )}
                    </div>
                    <div className="pb-6">
                      <p
                        className={`text-sm font-medium capitalize ${
                          isCompleted ? "text-gray-900" : "text-gray-400"
                        }`}
                      >
                        {step}
                      </p>
                      {isCurrent && (
                        <p className="text-xs text-amber-600 mt-0.5">Current status</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {isTerminal && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-red-400 bg-red-400 text-white">
                      <XCircle className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium capitalize text-red-600">
                      {redemption.status}
                    </p>
                    {redemption.review_note && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Reason: {redemption.review_note}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* User Info */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Requestor</h2>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <User className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">User #{redemption.user_id}</p>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Dates</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Requested</dt>
                <dd className="font-medium text-gray-900">{formatDate(redemption.created_at)}</dd>
              </div>
              {redemption.updated_at && redemption.updated_at !== redemption.created_at && (
                <div>
                  <dt className="text-gray-500">Last Updated</dt>
                  <dd className="font-medium text-gray-900">{formatDate(redemption.updated_at)}</dd>
                </div>
              )}
              {redemption.fulfilled_at && (
                <div>
                  <dt className="text-gray-500">Fulfilled</dt>
                  <dd className="font-medium text-green-700">{formatDate(redemption.fulfilled_at)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Action Buttons */}
          {(!isTerminal && redemption.status !== "fulfilled") && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Actions</h2>
              <div className="space-y-2">
                {isAdmin && redemption.status === "pending" && (
                  <>
                    <button
                      onClick={() => handleAction("approve")}
                      disabled={actionLoading}
                      className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading ? "Processing..." : "Approve"}
                    </button>
                    <button
                      onClick={() => handleAction("reject")}
                      disabled={actionLoading}
                      className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading ? "Processing..." : "Reject"}
                    </button>
                  </>
                )}
                {isAdmin && redemption.status === "approved" && (
                  <button
                    onClick={() => handleAction("fulfill")}
                    disabled={actionLoading}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? "Processing..." : "Mark as Fulfilled"}
                  </button>
                )}
                {!isAdmin && redemption.status === "pending" && (
                  <button
                    onClick={() => handleAction("cancel")}
                    disabled={actionLoading}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? "Processing..." : "Cancel Redemption"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Review Note */}
          {redemption.review_note && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Review Note</h2>
              <p className="text-sm text-gray-600">{redemption.review_note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
