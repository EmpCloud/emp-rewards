import { useState, useEffect } from "react";
import { Award, Plus, Edit2, Trash2, Loader2, Star, Trophy } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/api/client";
import { getUser } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  criteria_type: string;
  criteria_value: number | null;
  points_awarded: number;
  is_active: boolean;
  created_at: string;
}

const CRITERIA_LABELS: Record<string, string> = {
  manual: "Manual Award",
  auto_kudos_count: "Kudos Received",
  auto_tenure: "Tenure",
  auto_points: "Points Earned",
  auto_kudos_streak: "Kudos Streak",
};

const BADGE_ICONS = [
  { icon: Award, color: "bg-amber-100 text-amber-600" },
  { icon: Star, color: "bg-purple-100 text-purple-600" },
  { icon: Trophy, color: "bg-blue-100 text-blue-600" },
];

export function BadgeListPage() {
  const user = getUser();
  const isAdmin = ["super_admin", "org_admin", "hr_admin"].includes(user?.role || "");
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCriteriaType, setFormCriteriaType] = useState("manual");
  const [formCriteriaValue, setFormCriteriaValue] = useState<number>(0);
  const [formPointsAwarded, setFormPointsAwarded] = useState<number>(0);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchBadges = async () => {
    setLoading(true);
    try {
      const res = await apiGet<any>("/badges");
      if (res.success && res.data) {
        setBadges(Array.isArray(res.data) ? res.data : []);
      }
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBadges();
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormCriteriaType("manual");
    setFormCriteriaValue(0);
    setFormPointsAwarded(0);
    setFormError(null);
    setEditingBadge(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (badge: Badge) => {
    setEditingBadge(badge);
    setFormName(badge.name);
    setFormDescription(badge.description || "");
    setFormCriteriaType(badge.criteria_type);
    setFormCriteriaValue(badge.criteria_value || 0);
    setFormPointsAwarded(badge.points_awarded);
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError("Name is required");
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        criteria_type: formCriteriaType,
        criteria_value: formCriteriaType !== "manual" ? formCriteriaValue : null,
        points_awarded: formPointsAwarded,
      };

      if (editingBadge) {
        await apiPut(`/badges/${editingBadge.id}`, payload);
      } else {
        await apiPost("/badges", payload);
      }

      setShowForm(false);
      resetForm();
      await fetchBadges();
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || "Failed to save badge");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this badge?")) return;
    try {
      await apiDelete(`/badges/${id}`);
      await fetchBadges();
    } catch {
      // silent
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Badges</h1>
          <p className="mt-1 text-sm text-gray-500">
            Browse all available badges and achievements.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Badge
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && isAdmin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingBadge ? "Edit Badge" : "Create New Badge"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  maxLength={100}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  placeholder="e.g., Team Player"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Points Awarded</label>
                <input
                  type="number"
                  value={formPointsAwarded}
                  onChange={(e) => setFormPointsAwarded(parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                maxLength={500}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
                placeholder="What does this badge represent?"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Criteria Type</label>
                <select
                  value={formCriteriaType}
                  onChange={(e) => setFormCriteriaType(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  <option value="manual">Manual Award</option>
                  <option value="auto_kudos_count">Auto: Kudos Received Count</option>
                  <option value="auto_points">Auto: Points Earned</option>
                  <option value="auto_kudos_streak">Auto: Kudos Streak (days)</option>
                  <option value="auto_tenure">Auto: Tenure (months)</option>
                </select>
              </div>
              {formCriteriaType !== "manual" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Criteria Value</label>
                  <input
                    type="number"
                    value={formCriteriaValue}
                    onChange={(e) => setFormCriteriaValue(parseInt(e.target.value) || 0)}
                    min={0}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder={
                      formCriteriaType === "auto_kudos_count"
                        ? "Number of kudos"
                        : formCriteriaType === "auto_points"
                          ? "Points threshold"
                          : formCriteriaType === "auto_kudos_streak"
                            ? "Consecutive days"
                            : "Months"
                    }
                  />
                </div>
              )}
            </div>

            {formError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={formSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {formSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingBadge ? "Save Changes" : "Create Badge"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Badge Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : badges.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Award className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No badges defined yet.</p>
          {isAdmin && (
            <button
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
            >
              <Plus className="h-4 w-4" />
              Create First Badge
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((badge, idx) => {
            const iconSet = BADGE_ICONS[idx % BADGE_ICONS.length];
            const IconComp = iconSet.icon;

            return (
              <div
                key={badge.id}
                className="rounded-lg border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", iconSet.color)}>
                    <IconComp className="h-6 w-6" />
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(badge)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(badge.id)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="mt-3 text-base font-semibold text-gray-900">{badge.name}</h3>
                {badge.description && (
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">{badge.description}</p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                    {CRITERIA_LABELS[badge.criteria_type] || badge.criteria_type}
                    {badge.criteria_value ? `: ${badge.criteria_value}` : ""}
                  </span>
                  {badge.points_awarded > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                      <Trophy className="h-3 w-3" />
                      +{badge.points_awarded} pts
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
