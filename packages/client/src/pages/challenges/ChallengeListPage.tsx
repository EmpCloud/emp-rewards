import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Swords, Users, Clock, Trophy, Plus, Loader2 } from "lucide-react";
import { apiGet, apiPost } from "@/api/client";
import { getUser } from "@/lib/auth-store";
import { cn, formatDate } from "@/lib/utils";

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  type: "individual" | "team" | "department";
  metric: string;
  target_value: number;
  start_date: string;
  end_date: string;
  reward_points: number;
  status: "upcoming" | "active" | "completed" | "cancelled";
  created_at: string;
}

const STATUS_TABS = [
  { key: "active", label: "Active" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
] as const;

const METRIC_LABELS: Record<string, string> = {
  kudos_sent: "Kudos Sent",
  kudos_received: "Kudos Received",
  points_earned: "Points Earned",
  badges_earned: "Badges Earned",
};

const TYPE_ICONS: Record<string, string> = {
  individual: "Solo",
  team: "Team",
  department: "Department",
};

function daysRemaining(endDate: string): number {
  const end = new Date(endDate);
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export function ChallengeListPage() {
  const user = getUser();
  const isAdmin = user?.role === "hr_admin" || user?.role === "org_admin" || user?.role === "super_admin";
  const [tab, setTab] = useState<string>("active");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "individual",
    metric: "kudos_sent",
    target_value: 10,
    start_date: "",
    end_date: "",
    reward_points: 100,
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchChallenges();
  }, [tab]);

  async function fetchChallenges() {
    setLoading(true);
    try {
      const res = await apiGet<any>(`/challenges?status=${tab}`);
      if (res.success && res.data) {
        setChallenges(Array.isArray(res.data.data) ? res.data.data : Array.isArray(res.data) ? res.data : []);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      await apiPost("/challenges", {
        ...form,
        target_value: Number(form.target_value),
        reward_points: Number(form.reward_points),
      });
      setShowCreate(false);
      setForm({ title: "", description: "", type: "individual", metric: "kudos_sent", target_value: 10, start_date: "", end_date: "", reward_points: 100 });
      fetchChallenges();
    } catch {
      // error handled by interceptor
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Challenges</h1>
          <p className="mt-1 text-sm text-gray-500">Compete with colleagues and earn rewards.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            New Challenge
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Create Challenge</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Challenge title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="individual">Individual</option>
                <option value="team">Team</option>
                <option value="department">Department</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Metric</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.metric}
                onChange={(e) => setForm({ ...form, metric: e.target.value })}
              >
                <option value="kudos_sent">Kudos Sent</option>
                <option value="kudos_received">Kudos Received</option>
                <option value="points_earned">Points Earned</option>
                <option value="badges_earned">Badges Earned</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Value</label>
              <input
                type="number"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.target_value}
                onChange={(e) => setForm({ ...form, target_value: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !form.title || !form.start_date || !form.end_date}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Challenge"}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </div>
      )}

      {/* Challenge cards */}
      {!loading && challenges.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((c) => {
            const days = daysRemaining(c.end_date);
            return (
              <Link
                key={c.id}
                to={`/challenges/${c.id}`}
                className="block rounded-xl border border-gray-200 bg-white p-5 hover:border-brand-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                    <Swords className="h-5 w-5 text-brand-600" />
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      c.status === "active" && "bg-green-100 text-green-700",
                      c.status === "upcoming" && "bg-blue-100 text-blue-700",
                      c.status === "completed" && "bg-gray-100 text-gray-600",
                    )}
                  >
                    {c.status}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-gray-900">{c.title}</h3>
                {c.description && (
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">{c.description}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                    <Users className="h-3 w-3" />
                    {TYPE_ICONS[c.type] || c.type}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                    Target: {c.target_value} {METRIC_LABELS[c.metric] || c.metric}
                  </span>
                  {c.reward_points > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                      <Trophy className="h-3 w-3" />
                      {c.reward_points} pts
                    </span>
                  )}
                </div>
                {c.status === "active" && (
                  <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    {days} day{days !== 1 ? "s" : ""} remaining
                  </div>
                )}
                <div className="mt-2 text-xs text-gray-400">
                  {formatDate(c.start_date)} - {formatDate(c.end_date)}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && challenges.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Swords className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            No {tab} challenges found.
          </p>
        </div>
      )}
    </div>
  );
}
