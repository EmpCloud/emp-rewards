import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Crown,
  Award,
  Loader2,
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Eye,
} from "lucide-react";
import { apiGet, apiPut } from "@/api/client";
import { useAuthStore } from "@/lib/auth-store";
import type { Nomination, NominationProgram, PaginatedResponse } from "@emp-rewards/shared";

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-amber-50 text-amber-700 border-amber-200",
  under_review: "bg-blue-50 text-blue-700 border-blue-200",
  selected: "bg-green-50 text-green-700 border-green-200",
  not_selected: "bg-gray-50 text-gray-500 border-gray-200",
};

const STATUS_ICONS: Record<string, typeof Clock> = {
  submitted: Clock,
  under_review: Eye,
  selected: CheckCircle,
  not_selected: XCircle,
};

const STATUS_TABS = [
  { label: "All", value: "all" },
  { label: "Submitted", value: "submitted" },
  { label: "Under Review", value: "under_review" },
  { label: "Selected", value: "selected" },
  { label: "Not Selected", value: "not_selected" },
];

export function NominationListPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin =
    user?.role === "org_admin" || user?.role === "hr_admin" || user?.role === "super_admin";

  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [programs, setPrograms] = useState<NominationProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPrograms = async () => {
    try {
      const res = await apiGet<PaginatedResponse<NominationProgram>>("/nominations/programs", { perPage: 100 });
      if (res.data) setPrograms(res.data.data);
    } catch {
      // Non-critical
    }
  };

  const fetchNominations = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page, perPage: 20 };
      if (activeTab !== "all") params.status = activeTab;
      if (programFilter !== "all") params.programId = programFilter;

      const res = await apiGet<PaginatedResponse<Nomination>>("/nominations", params);
      if (res.data) {
        setNominations(res.data.data);
        setTotalPages(res.data.totalPages);
        setTotal(res.data.total);
      }
    } catch {
      setError("Failed to load nominations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  useEffect(() => {
    fetchNominations();
  }, [page, activeTab, programFilter]);

  const handleReview = async (id: string, status: "selected" | "not_selected") => {
    setActionLoading(id);
    setError(null);
    setSuccess(null);
    try {
      await apiPut(`/nominations/${id}/review`, { status });
      setSuccess(
        status === "selected"
          ? "Nomination approved! Points have been awarded."
          : "Nomination marked as not selected.",
      );
      fetchNominations();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to review nomination");
    } finally {
      setActionLoading(null);
    }
  };

  const getProgramName = (programId: string) =>
    programs.find((p) => p.id === programId)?.name || programId.slice(0, 8) + "...";

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              to="/nominations"
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Nominations</h1>
              <p className="mt-1 text-sm text-gray-500">
                {isAdmin
                  ? "Review and manage nominations across all programs."
                  : "Track nominations you have submitted."}
              </p>
            </div>
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
          <CheckCircle className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        {/* Status Tabs */}
        <div className="flex-1 border-b border-gray-200">
          <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
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
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Program Filter */}
        {programs.length > 0 && (
          <select
            value={programFilter}
            onChange={(e) => { setProgramFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="all">All Programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      ) : nominations.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Crown className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No nominations found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Program
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Nominator
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Nominee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  {isAdmin && (
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {nominations.map((nom) => {
                  const StatusIcon = STATUS_ICONS[nom.status] || Clock;
                  const isReviewable =
                    isAdmin &&
                    (nom.status === "submitted" || nom.status === "under_review");

                  return (
                    <tr key={nom.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">
                          {getProgramName(nom.program_id)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        User #{nom.nominator_id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        User #{nom.nominee_id}
                      </td>
                      <td className="max-w-xs px-6 py-4">
                        <p className="truncate text-sm text-gray-600">{nom.reason}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                            STATUS_STYLES[nom.status] || STATUS_STYLES.submitted
                          }`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {nom.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(nom.created_at)}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          {isReviewable && (
                            <div className="flex items-center justify-end gap-2">
                              {actionLoading === nom.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleReview(nom.id, "selected")}
                                    className="rounded bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                                    title="Select"
                                  >
                                    <span className="flex items-center gap-1">
                                      <Award className="h-3 w-3" />
                                      Select
                                    </span>
                                  </button>
                                  <button
                                    onClick={() => handleReview(nom.id, "not_selected")}
                                    className="rounded bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                                    title="Not Selected"
                                  >
                                    Decline
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                          {nom.review_note && (
                            <p className="mt-1 text-xs text-gray-400 truncate max-w-[150px]">
                              {nom.review_note}
                            </p>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Pagination */}
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3">
            <p className="text-sm text-gray-500">
              Showing {nominations.length} of {total} nominations
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-white disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-white disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
