import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Crown,
  Award,
  Plus,
  Loader2,
  AlertCircle,
  Calendar,
  Users,
  Coins,
  Edit,
  ChevronRight,
} from "lucide-react";
import { apiGet, apiPost, apiPut } from "@/api/client";
import { useAuthStore } from "@/lib/auth-store";
import type { NominationProgram, PaginatedResponse, NominationFrequency } from "@emp-rewards/shared";

const FREQUENCY_LABELS: Record<string, string> = {
  one_time: "One-time",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

export function NominationProgramsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin =
    user?.role === "org_admin" || user?.role === "hr_admin" || user?.role === "super_admin";

  const [programs, setPrograms] = useState<NominationProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<NominationProgram | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    frequency: "monthly" as string,
    nominations_per_user: 1,
    points_awarded: 100,
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    is_active: true,
  });

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      const res = await apiGet<PaginatedResponse<NominationProgram>>("/nominations/programs");
      if (res.data) {
        setPrograms(res.data.data);
      }
    } catch {
      setError("Failed to load programs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      frequency: "monthly",
      nominations_per_user: 1,
      points_awarded: 100,
      start_date: new Date().toISOString().split("T")[0],
      end_date: "",
      is_active: true,
    });
  };

  const openCreate = () => {
    resetForm();
    setEditingProgram(null);
    setShowCreateModal(true);
  };

  const openEdit = (program: NominationProgram) => {
    setFormData({
      name: program.name,
      description: program.description || "",
      frequency: program.frequency,
      nominations_per_user: program.nominations_per_user,
      points_awarded: program.points_awarded,
      start_date: program.start_date,
      end_date: program.end_date || "",
      is_active: program.is_active,
    });
    setEditingProgram(program);
    setShowCreateModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate end date >= start date
    if (formData.end_date && formData.start_date && formData.end_date < formData.start_date) {
      setError("End date cannot be before start date");
      return;
    }

    setFormLoading(true);
    setError(null);

    const payload = {
      ...formData,
      description: formData.description || null,
      end_date: formData.end_date || null,
    };

    try {
      if (editingProgram) {
        await apiPut(`/nominations/programs/${editingProgram.id}`, payload);
      } else {
        await apiPost("/nominations/programs", payload);
      }
      setShowCreateModal(false);
      resetForm();
      fetchPrograms();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to save program");
    } finally {
      setFormLoading(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nomination Programs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Browse active nomination and award programs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/nominations/list"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            View Nominations
            <ChevronRight className="h-4 w-4" />
          </Link>
          {isAdmin && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Program
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Programs Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      ) : programs.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Crown className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No nomination programs yet.</p>
          {isAdmin && (
            <button
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              <Plus className="h-4 w-4" />
              Create First Program
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <div
              key={program.id}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50">
                  <Crown className="h-6 w-6 text-amber-500" />
                </div>
                <div className="flex items-center gap-2">
                  {!program.is_active && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      Inactive
                    </span>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => openEdit(program)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <h3 className="mt-4 text-lg font-semibold text-gray-900">{program.name}</h3>
              {program.description && (
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">{program.description}</p>
              )}

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span>{FREQUENCY_LABELS[program.frequency] || program.frequency}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span>{program.nominations_per_user} nomination(s) per person</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Coins className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-amber-600">
                    {program.points_awarded.toLocaleString()} pts awarded
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>
                    {formatDate(program.start_date)}
                    {program.end_date ? ` - ${formatDate(program.end_date)}` : " - Ongoing"}
                  </span>
                </div>
              </div>

              {program.is_active && (
                <Link
                  to={`/nominations/submit?programId=${program.id}`}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
                >
                  <Award className="h-4 w-4" />
                  Nominate
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingProgram ? "Edit Program" : "Create Nomination Program"}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="Employee of the Month"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="Recognize outstanding employees..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Frequency</label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Noms per User</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.nominations_per_user}
                    onChange={(e) => setFormData({ ...formData, nominations_per_user: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Points Awarded to Winner</label>
                <input
                  type="number"
                  min={0}
                  value={formData.points_awarded}
                  onChange={(e) => setFormData({ ...formData, points_awarded: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Date (optional)</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    min={formData.start_date || undefined}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  {formData.start_date && formData.end_date && formData.end_date < formData.start_date && (
                    <p className="mt-1 text-xs text-red-500">End date must be on or after start date</p>
                  )}
                </div>
              </div>

              {editingProgram && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {formLoading ? "Saving..." : editingProgram ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
