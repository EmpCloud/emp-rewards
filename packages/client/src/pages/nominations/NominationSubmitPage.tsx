import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  Crown,
  Star,
  Search,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Coins,
  Users,
  Calendar,
} from "lucide-react";
import { apiGet, apiPost } from "@/api/client";
import { getUser } from "@/lib/auth-store";
import type { NominationProgram, Nomination, PaginatedResponse } from "@emp-rewards/shared";

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  designation: string | null;
}

const FREQUENCY_LABELS: Record<string, string> = {
  one_time: "One-time",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

const REASON_MAX = 2000;

export function NominationSubmitPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = getUser();
  const myUserId = user?.empcloudUserId;

  // Programs
  const [programs, setPrograms] = useState<NominationProgram[]>([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [selectedProgramId, setSelectedProgramId] = useState(searchParams.get("programId") || "");

  // Nominee picker
  const [nomineeSearch, setNomineeSearch] = useState("");
  const [nominees, setNominees] = useState<Employee[]>([]);
  const [selectedNominee, setSelectedNominee] = useState<Employee | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // My usage for the selected program (UX hint — the server enforces the
  // real limit on submit).
  const [myUsedCount, setMyUsedCount] = useState<number | null>(null);

  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selectedProgram = programs.find((p) => p.id === selectedProgramId) || null;

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<PaginatedResponse<NominationProgram>>("/nominations/programs", {
          perPage: 100,
        });
        if (res.success && res.data) {
          const active = res.data.data.filter((p) => p.is_active);
          setPrograms(active);
          // Drop a stale/inactive programId from the URL so the selector
          // doesn't point at a program that can't accept nominations.
          const fromUrl = searchParams.get("programId");
          if (fromUrl && !active.some((p) => p.id === fromUrl)) {
            setSelectedProgramId("");
            setSearchParams({}, { replace: true });
            setError(
              "That program is no longer accepting nominations — please choose another.",
            );
          }
        }
      } catch {
        setError("Failed to load nomination programs");
      } finally {
        setProgramsLoading(false);
      }
    })();
  }, []);

  // Debounced employee search (same /users/search endpoint the kudos form
  // uses — org-scoped, excludes the caller). The stale flag also discards
  // in-flight responses that would otherwise land out of order.
  useEffect(() => {
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const res = await apiGet<any>("/users/search", { q: nomineeSearch.trim(), limit: 20 });
        if (!stale) setNominees(res.success && Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!stale) setNominees([]);
      }
    }, 200);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [nomineeSearch]);

  // Count how many nominations I've already submitted for this program.
  // The server filters by nominator, so the paginated `total` is exact.
  useEffect(() => {
    setMyUsedCount(null);
    if (!selectedProgramId || !myUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<PaginatedResponse<Nomination>>("/nominations", {
          programId: selectedProgramId,
          nominatorId: myUserId,
          perPage: 1,
        });
        if (!cancelled && res.success && res.data) {
          setMyUsedCount(res.data.total);
        }
      } catch {
        if (!cancelled) setMyUsedCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProgramId, myUserId]);

  const limitReached =
    selectedProgram !== null &&
    myUsedCount !== null &&
    myUsedCount >= selectedProgram.nominations_per_user;

  const handleProgramChange = (id: string) => {
    setSelectedProgramId(id);
    setError(null);
    setSearchParams(id ? { programId: id } : {}, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProgramId) {
      setError("Please select a nomination program");
      return;
    }
    if (!selectedNominee) {
      setError("Please select a colleague to nominate");
      return;
    }
    if (!reason.trim()) {
      setError("Please describe why you are nominating them");
      return;
    }

    setSubmitting(true);
    try {
      await apiPost("/nominations", {
        program_id: selectedProgramId,
        nominee_id: selectedNominee.id,
        reason: reason.trim(),
      });
      setSuccess(true);
      setTimeout(() => navigate("/nominations/list"), 1500);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to submit nomination");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (success) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Star className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-gray-900">Nomination Submitted!</h2>
          <p className="mt-1 text-sm text-gray-500">
            {selectedNominee?.first_name} {selectedNominee?.last_name} has been nominated
            {selectedProgram ? ` for ${selectedProgram.name}` : ""}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submit Nomination</h1>
          <p className="mt-1 text-sm text-gray-500">Nominate a colleague for an award.</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {programsLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      ) : programs.length === 0 ? (
        !error && (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <Crown className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">
              There are no active nomination programs right now.
            </p>
            <Link
              to="/nominations"
              className="mt-4 inline-block text-sm font-medium text-amber-600 hover:text-amber-700"
            >
              View all programs
            </Link>
          </div>
        )
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 overflow-visible"
        >
          {/* Program */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Program</label>
            <select
              value={selectedProgramId}
              onChange={(e) => handleProgramChange(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            >
              <option value="">Select a program...</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Selected program details */}
            {selectedProgram && (
              <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                    <Crown className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{selectedProgram.name}</p>
                    {selectedProgram.description && (
                      <p className="mt-0.5 text-xs text-gray-600">{selectedProgram.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <Coins className="h-3.5 w-3.5 text-amber-500" />
                        <span className="font-medium text-amber-700">
                          {selectedProgram.points_awarded.toLocaleString()} pts
                        </span>
                        to the winner
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        {FREQUENCY_LABELS[selectedProgram.frequency] || selectedProgram.frequency}
                        {" · "}
                        {formatDate(selectedProgram.start_date)}
                        {selectedProgram.end_date
                          ? ` - ${formatDate(selectedProgram.end_date)}`
                          : " - Ongoing"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-gray-400" />
                        {myUsedCount !== null
                          ? `${myUsedCount} of ${selectedProgram.nominations_per_user} nomination(s) used`
                          : `${selectedProgram.nominations_per_user} nomination(s) per person`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {limitReached && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0" />
                You have used all your nominations for this program.
              </div>
            )}
          </div>

          {/* Nominee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nominee</label>
            {selectedNominee ? (
              <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {selectedNominee.first_name} {selectedNominee.last_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {[selectedNominee.designation, selectedNominee.email]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNominee(null);
                    setNomineeSearch("");
                  }}
                  className="text-xs font-medium text-amber-600 hover:text-amber-700"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative z-10">
                <Search className="absolute left-3 top-[13px] h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search colleagues by name or email..."
                  value={nomineeSearch}
                  onChange={(e) => {
                    setNomineeSearch(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                {showDropdown && nominees.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {nominees.map((emp) => (
                      <li key={emp.id}>
                        <button
                          type="button"
                          className="w-full px-4 py-2 text-left text-sm hover:bg-amber-50"
                          onMouseDown={() => {
                            setSelectedNominee(emp);
                            setShowDropdown(false);
                          }}
                        >
                          <span className="font-medium text-gray-900">
                            {emp.first_name} {emp.last_name}
                          </span>
                          {emp.designation && (
                            <span className="ml-2 text-xs text-gray-500">{emp.designation}</span>
                          )}
                          {emp.email && (
                            <span className="ml-2 text-xs text-gray-400">{emp.email}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {showDropdown && nomineeSearch.length > 0 && nominees.length === 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-lg">
                    No matching employees found.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Reason</label>
              <span className="text-xs text-gray-400">
                {reason.length}/{REASON_MAX}
              </span>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
              rows={5}
              placeholder="Describe what makes them deserving of this award — specific contributions, impact, and examples help reviewers."
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Link
              to="/nominations"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || limitReached}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Submitting..." : "Submit Nomination"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
