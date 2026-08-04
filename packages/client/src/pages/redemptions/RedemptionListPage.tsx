import { useState, useEffect } from "react";
import { ShoppingCart, Loader2, CheckCircle, XCircle, Package, Clock, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { apiGet, apiPut } from "@/api/client";
import { useAuthStore } from "@/lib/auth-store";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { RewardRedemption, PaginatedResponse, RedemptionStatus } from "@emp-rewards/shared";
import { tr } from "@/lib/i18n";
import { activeLocale } from "@/lib/utils";

const STATUS_TABS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Fulfilled", value: "fulfilled" },
  { label: "Cancelled", value: "cancelled" },
];

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  fulfilled: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-gray-50 text-gray-500 border-gray-200",
};

const STATUS_ICONS: Record<string, typeof Clock> = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  fulfilled: Package,
  cancelled: XCircle,
};

export function RedemptionListPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin =
    user?.role === "org_admin" ||
    user?.role === "hr_admin" ||
    user?.role === "hr_manager" ||
    user?.role === "super_admin";

  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRedemptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page, perPage: 20 };
      if (activeTab !== "all") params.status = activeTab;

      const endpoint = isAdmin ? "/redemptions" : "/redemptions/my";
      const res = await apiGet<PaginatedResponse<RewardRedemption>>(endpoint, params);
      if (res.data) {
        setRedemptions(res.data.data);
        setTotalPages(res.data.totalPages);
        setTotal(res.data.total);
      }
    } catch {
      setError(tr("Failed to load redemptions"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRedemptions();
  }, [page, activeTab]);

  const handleAction = async (id: string, action: "approve" | "reject" | "fulfill") => {
    setActionLoading(id);
    setError(null);
    try {
      await apiPut(`/redemptions/${id}/${action}`);
      fetchRedemptions();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || `Failed to ${action} redemption`);
    } finally {
      setActionLoading(null);
    }
  };

  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const handleCancel = async (id: string) => {
    setConfirmCancelId(null);
    setActionLoading(id);
    setError(null);
    try {
      await apiPut(`/redemptions/${id}/cancel`);
      fetchRedemptions();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to cancel redemption");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(activeLocale(), {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {isAdmin ? tr("Redemptions") : tr("My Redemptions")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isAdmin
            ? tr("Manage and review reward redemption requests.")
            : tr("Track your reward redemption requests.")}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label={tr("Tabs")}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setActiveTab(tab.value); setPage(1); }}
              className={`whitespace-nowrap border-b-2 pb-3 pt-1 text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? "border-amber-500 text-amber-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tr(tab.label)}
            </button>
          ))}
        </nav>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      ) : redemptions.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <ShoppingCart className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            {activeTab !== "all"
              ? `No ${activeTab} redemptions found.`
              : tr("No redemptions yet.")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">

                    {tr("Redemption")}
                  </th>
                  {isAdmin && (
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">

                      {tr("User")}
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">

                    {tr("Points")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">

                    {tr("Status")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">

                    {tr("Date")}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">

                    {tr("Actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {redemptions.map((r) => {
                  const StatusIcon = STATUS_ICONS[r.status] || Clock;
                  const isActionLoading = actionLoading === r.id;

                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <Link
                          to={`/redemptions/${r.id}`}
                          className="text-sm font-medium text-amber-600 hover:text-amber-700"
                        >
                          {r.reward_id.slice(0, 8)}...
                        </Link>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-sm text-gray-700">

                          {tr("User #")}{r.user_id}
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {r.points_spent.toLocaleString(activeLocale())}  {tr("pts")}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                            STATUS_STYLES[r.status] || STATUS_STYLES.pending
                          }`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {(() => {
                          // Which actions, if any, are available for this row.
                          const canReview = isAdmin && r.status === "pending";
                          const canFulfill = isAdmin && r.status === "approved";
                          const canCancel = !isAdmin && r.status === "pending";
                          const hasAction = canReview || canFulfill || canCancel;
                          if (isActionLoading) {
                            return (
                              <div className="flex items-center justify-end">
                                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                              </div>
                            );
                          }
                          if (!hasAction) {
                            // Terminal/no-op state (cancelled, rejected,
                            // fulfilled, or an admin-only action) — show a
                            // dash so the cell doesn't look empty/broken.
                            return <span className="text-sm text-gray-300">—</span>;
                          }
                          return (
                            <div className="flex items-center justify-end gap-2">
                              {canReview && (
                                <>
                                  <button
                                    onClick={() => handleAction(r.id, "approve")}
                                    className="rounded bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                                  >

                                    {tr("Approve")}
                                  </button>
                                  <button
                                    onClick={() => handleAction(r.id, "reject")}
                                    className="rounded bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
                                  >

                                    {tr("Reject")}
                                  </button>
                                </>
                              )}
                              {canFulfill && (
                                <button
                                  onClick={() => handleAction(r.id, "fulfill")}
                                  className="rounded bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                                >

                                  {tr("Fulfill")}
                                </button>
                              )}
                              {canCancel && (
                                <button
                                  onClick={() => setConfirmCancelId(r.id)}
                                  className="rounded bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                                >

                                  {tr("Cancel")}
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Pagination */}
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3">
            <p className="text-sm text-gray-500">

              {tr("Showing")} {redemptions.length}  {tr("of")} {total}  {tr("redemptions")}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-white disabled:opacity-50"
                >

                  {tr("Previous")}
                </button>
                <span className="text-sm text-gray-500">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-white disabled:opacity-50"
                >

                  {tr("Next")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmCancelId}
        title={tr("Cancel Redemption?")}
        message="This redemption will be cancelled and your points refunded to your balance."
        confirmLabel="Cancel Redemption"
        cancelLabel="Keep It"
        tone="danger"
        onConfirm={() => confirmCancelId && handleCancel(confirmCancelId)}
        onCancel={() => setConfirmCancelId(null)}
      />
    </div>
  );
}
