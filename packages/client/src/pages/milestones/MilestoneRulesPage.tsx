import { useState, useEffect } from "react";
import { Target, Plus, Trash2, Edit3, Loader2 } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/api/client";
import { getUser } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

interface MilestoneRule {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_value: number;
  reward_points: number;
  reward_badge_id: string | null;
  is_active: boolean;
  created_at: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  work_anniversary: "Work Anniversary",
  kudos_count: "Kudos Received",
  points_total: "Total Points",
  badges_count: "Badges Earned",
  referral_hired: "Referrals Hired",
  first_kudos: "First Kudos Sent",
};

const TRIGGER_DESCRIPTIONS: Record<string, string> = {
  work_anniversary: "years of service",
  kudos_count: "kudos received",
  points_total: "total points earned",
  badges_count: "badges earned",
  referral_hired: "referrals hired",
  first_kudos: "kudos sent",
};

export function MilestoneRulesPage() {
  const user = getUser();
  const isAdmin = user?.role === "hr_admin" || user?.role === "org_admin" || user?.role === "super_admin";
  const [rules, setRules] = useState<MilestoneRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    trigger_type: "kudos_count",
    trigger_value: 10,
    reward_points: 50,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRules();
  }, []);

  async function fetchRules() {
    setLoading(true);
    try {
      const res = await apiGet<MilestoneRule[]>("/milestones/rules");
      if (res.success && res.data) {
        setRules(Array.isArray(res.data) ? res.data : []);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId) {
        await apiPut(`/milestones/rules/${editingId}`, {
          ...form,
          trigger_value: Number(form.trigger_value),
          reward_points: Number(form.reward_points),
        });
      } else {
        await apiPost("/milestones/rules", {
          ...form,
          trigger_value: Number(form.trigger_value),
          reward_points: Number(form.reward_points),
        });
      }
      resetForm();
      fetchRules();
    } catch {
      // error
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiDelete(`/milestones/rules/${id}`);
      fetchRules();
    } catch {
      // error
    }
  }

  function startEdit(rule: MilestoneRule) {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      description: rule.description || "",
      trigger_type: rule.trigger_type,
      trigger_value: rule.trigger_value,
      reward_points: rule.reward_points,
      is_active: rule.is_active,
    });
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", description: "", trigger_type: "kudos_count", trigger_value: 10, reward_points: 50, is_active: true });
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Milestone Rules</h1>
          <p className="mt-1 text-sm text-gray-500">Configure automated milestone rewards for your organization.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            New Rule
          </button>
        )}
      </div>

      {/* Create/Edit form */}
      {showForm && isAdmin && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {editingId ? "Edit Rule" : "Create Rule"}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Kudos Champion"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Type</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.trigger_type}
                onChange={(e) => setForm({ ...form, trigger_type: e.target.value })}
              >
                {Object.entries(TRIGGER_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trigger Value ({TRIGGER_DESCRIPTIONS[form.trigger_type]})
              </label>
              <input
                type="number"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.trigger_value}
                onChange={(e) => setForm({ ...form, trigger_value: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reward Points</label>
              <input
                type="number"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.reward_points}
                onChange={(e) => setForm({ ...form, reward_points: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded border-gray-300 text-brand-600"
              />
              <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={resetForm}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Update Rule" : "Create Rule"}
            </button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {rules.length > 0 ? (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                "rounded-xl border bg-white p-5",
                rule.is_active ? "border-gray-200" : "border-gray-200 opacity-60",
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                    <Target className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{rule.name}</h3>
                    {rule.description && (
                      <p className="text-sm text-gray-500">{rule.description}</p>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(rule)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                  {TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {rule.trigger_value} {TRIGGER_DESCRIPTIONS[rule.trigger_type]}
                </span>
                {rule.reward_points > 0 && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    +{rule.reward_points} pts
                  </span>
                )}
                {!rule.is_active && (
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-600">
                    Inactive
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Target className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No milestone rules configured yet.</p>
          {isAdmin && (
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="mt-4 text-sm text-brand-600 underline"
            >
              Create your first rule
            </button>
          )}
        </div>
      )}
    </div>
  );
}
