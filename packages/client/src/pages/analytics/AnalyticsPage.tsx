import { useState, useEffect } from "react";
import {
  BarChart3, TrendingUp, Award, Gift, Target, Coins,
  Heart, Sparkles, Trophy, Crown, Medal,
} from "lucide-react";
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { apiGet } from "@/api/client";
import { tr } from "@/lib/i18n";
import { activeLocale } from "@/lib/utils";

interface Overview {
  totalKudos: number;
  pointsDistributed: number;
  badgesAwarded: number;
  activePrograms: number;
  totalRedemptions: number;
  pointsRedeemed: number;
}

interface TrendPoint {
  period: string;
  kudos_count: number;
  points_total: number;
}

interface CategoryBreakdown {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  kudos_count: number;
  points_total: number;
}

interface DeptParticipation {
  department_name: string;
  total_employees: number;
  active_senders: number;
  active_receivers: number;
  total_kudos: number;
  participationRate: number;
}

interface TopUser {
  user_id: number;
  first_name: string;
  last_name: string;
  designation: string;
  kudos_count: number;
  points_given?: number;
  points_earned?: number;
}

// Per-category palette for the pie chart. Distinct hues read better than the
// monochrome amber gradient that was here before — categories are visually
// distinguishable at a glance.
const PIE_COLORS = [
  "#f59e0b", // amber
  "#6366f1", // indigo
  "#10b981", // emerald
  "#ef4444", // red
  "#06b6d4", // cyan
  "#8b5cf6", // violet
  "#f97316", // orange
  "#14b8a6", // teal
];

type StatTone = "amber" | "indigo" | "emerald" | "violet" | "rose" | "sky";

const STAT_TONES: Record<StatTone, { bg: string; ring: string; icon: string; value: string }> = {
  amber:   { bg: "bg-amber-50",   ring: "ring-amber-100",   icon: "bg-amber-500 text-white",   value: "text-amber-700" },
  indigo:  { bg: "bg-indigo-50",  ring: "ring-indigo-100",  icon: "bg-indigo-500 text-white",  value: "text-indigo-700" },
  emerald: { bg: "bg-emerald-50", ring: "ring-emerald-100", icon: "bg-emerald-500 text-white", value: "text-emerald-700" },
  violet:  { bg: "bg-violet-50",  ring: "ring-violet-100",  icon: "bg-violet-500 text-white",  value: "text-violet-700" },
  rose:    { bg: "bg-rose-50",    ring: "ring-rose-100",    icon: "bg-rose-500 text-white",    value: "text-rose-700" },
  sky:     { bg: "bg-sky-50",     ring: "ring-sky-100",     icon: "bg-sky-500 text-white",     value: "text-sky-700" },
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  tone: StatTone;
}) {
  const t = STAT_TONES[tone];
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-4 ring-1 ${t.ring} transition-shadow hover:shadow-sm`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${t.value}`}>
            {typeof value === "number" ? value.toLocaleString(activeLocale()) : value}
          </p>
          {sub && <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>}
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// Gold / silver / bronze for the top-3 entries on the recognizer & recognized
// lists. Past 3 falls through to a neutral chip.
function rankStyle(idx: number) {
  if (idx === 0) return { wrap: "bg-amber-100 text-amber-700", icon: Crown };
  if (idx === 1) return { wrap: "bg-gray-200 text-gray-700", icon: Medal };
  if (idx === 2) return { wrap: "bg-orange-100 text-orange-700", icon: Medal };
  return { wrap: "bg-gray-100 text-gray-500", icon: null as null | typeof Crown };
}

function initials(first: string, last: string) {
  return `${(first || "").charAt(0)}${(last || "").charAt(0)}`.toUpperCase() || "?";
}

// Distinct soft-color rotation for avatar initials so the lists aren't a
// single block of amber.
const AVATAR_PALETTE = [
  "bg-amber-100 text-amber-700",
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
];

// Stable color by user id so the same person always gets the same avatar tone.
function avatarTone(userId: number) {
  return AVATAR_PALETTE[Math.abs(userId) % AVATAR_PALETTE.length];
}

function EmptyChart({ icon: Icon, title, hint }: { icon: any; title: string; hint?: string }) {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-medium text-gray-700">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

// Time range options for the Kudos Trends chart. The stat cards above are
// cumulative totals (they don't have a natural "last 30 days" framing), so
// the range only retunes the trends fetch — see RANGE_TO_TRENDS_PARAMS below.
type Range = "7d" | "30d" | "90d" | "all";
const RANGE_LABELS: Record<Range, string> = { "7d": "7d", "30d": "30d", "90d": "90d", all: "All" };

const RANGE_TO_TRENDS_PARAMS: Record<Range, { interval: "day" | "week" | "month"; months: number }> = {
  "7d":  { interval: "day",   months: 1 },   // server clamps to ~30 days; "day" bucket gives 7+ points
  "30d": { interval: "day",   months: 1 },
  "90d": { interval: "week",  months: 3 },
  all:   { interval: "month", months: 12 },
};

export function AnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
  const [departments, setDepartments] = useState<DeptParticipation[]>([]);
  const [topRecognizers, setTopRecognizers] = useState<TopUser[]>([]);
  const [topRecognized, setTopRecognized] = useState<TopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [range, setRange] = useState<Range>("90d");

  // Full page load — runs once.
  useEffect(() => {
    fetchAll();
  }, []);

  // Re-fetch only the trends series when the range chip changes. Stat cards,
  // categories, departments, and top-user lists stay put (they aren't
  // semantically scoped to a time window).
  useEffect(() => {
    // Skip the initial mount — fetchAll() already pulled trends with the
    // default range's params.
    if (loading) return;
    fetchTrends(range);
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchTrends(r: Range) {
    setTrendsLoading(true);
    try {
      const params = RANGE_TO_TRENDS_PARAMS[r];
      const res = await apiGet<TrendPoint[]>("/analytics/trends", params);
      if (res.success && Array.isArray(res.data)) setTrends(res.data);
    } catch {
      // silent — trends just stay on the previous value
    } finally {
      setTrendsLoading(false);
    }
  }

  async function fetchAll() {
    setLoading(true);
    try {
      const initialTrendsParams = RANGE_TO_TRENDS_PARAMS[range];
      const [ov, tr, cat, dept, recognizers, recognized] = await Promise.allSettled([
        apiGet<Overview>("/analytics/overview"),
        apiGet<TrendPoint[]>("/analytics/trends", initialTrendsParams),
        apiGet<CategoryBreakdown[]>("/analytics/categories"),
        apiGet<DeptParticipation[]>("/analytics/departments"),
        apiGet<TopUser[]>("/analytics/top-recognizers"),
        apiGet<TopUser[]>("/analytics/top-recognized"),
      ]);

      if (ov.status === "fulfilled" && ov.value.data) setOverview(ov.value.data);
      if (tr.status === "fulfilled" && tr.value.data) setTrends(tr.value.data);
      if (cat.status === "fulfilled" && cat.value.data) setCategories(cat.value.data);
      if (dept.status === "fulfilled" && dept.value.data) setDepartments(dept.value.data);
      if (recognizers.status === "fulfilled" && recognizers.value.data) setTopRecognizers(recognizers.value.data);
      if (recognized.status === "fulfilled" && recognized.value.data) setTopRecognized(recognized.value.data);
    } catch {
      // Load demo data
      loadDemoData();
    } finally {
      setLoading(false);
    }
  }

  function loadDemoData() {
    setOverview({ totalKudos: 1247, pointsDistributed: 38450, badgesAwarded: 89, activePrograms: 3, totalRedemptions: 56, pointsRedeemed: 12800 });
    setTrends([
      { period: "2026-W01", kudos_count: 42, points_total: 1260 },
      { period: "2026-W02", kudos_count: 55, points_total: 1650 },
      { period: "2026-W03", kudos_count: 48, points_total: 1440 },
      { period: "2026-W04", kudos_count: 63, points_total: 1890 },
      { period: "2026-W05", kudos_count: 71, points_total: 2130 },
      { period: "2026-W06", kudos_count: 58, points_total: 1740 },
      { period: "2026-W07", kudos_count: 67, points_total: 2010 },
      { period: "2026-W08", kudos_count: 82, points_total: 2460 },
    ]);
    setCategories([
      { id: "1", name: "Teamwork", icon: null, color: "#f59e0b", kudos_count: 320, points_total: 9600 },
      { id: "2", name: "Innovation", icon: null, color: "#d97706", kudos_count: 245, points_total: 7350 },
      { id: "3", name: "Leadership", icon: null, color: "#b45309", kudos_count: 198, points_total: 5940 },
      { id: "4", name: "Customer Focus", icon: null, color: "#92400e", kudos_count: 156, points_total: 4680 },
      { id: "5", name: "Quality", icon: null, color: "#78350f", kudos_count: 128, points_total: 3840 },
    ]);
    setDepartments([
      { department_name: "Engineering", total_employees: 45, active_senders: 38, active_receivers: 42, total_kudos: 520, participationRate: 89 },
      { department_name: "Product", total_employees: 12, active_senders: 10, active_receivers: 11, total_kudos: 180, participationRate: 88 },
      { department_name: "Design", total_employees: 8, active_senders: 7, active_receivers: 8, total_kudos: 145, participationRate: 94 },
      { department_name: "Marketing", total_employees: 15, active_senders: 10, active_receivers: 12, total_kudos: 110, participationRate: 73 },
      { department_name: "Sales", total_employees: 20, active_senders: 12, active_receivers: 14, total_kudos: 95, participationRate: 65 },
    ]);
    setTopRecognizers([
      { user_id: 1, first_name: "Ananya", last_name: "Sharma", designation: "Engineering Manager", kudos_count: 45, points_given: 1350 },
      { user_id: 2, first_name: "Meera", last_name: "Joshi", designation: "HR Manager", kudos_count: 38, points_given: 1140 },
      { user_id: 3, first_name: "Vikram", last_name: "Singh", designation: "DevOps Lead", kudos_count: 32, points_given: 960 },
      { user_id: 4, first_name: "Priya", last_name: "Nair", designation: "Product Designer", kudos_count: 28, points_given: 840 },
      { user_id: 5, first_name: "Sanjay", last_name: "Reddy", designation: "Tech Lead", kudos_count: 25, points_given: 750 },
    ]);
    setTopRecognized([
      { user_id: 6, first_name: "Rahul", last_name: "Patel", designation: "Senior Developer", kudos_count: 52, points_earned: 1560 },
      { user_id: 7, first_name: "Sneha", last_name: "Gupta", designation: "QA Engineer", kudos_count: 41, points_earned: 1230 },
      { user_id: 3, first_name: "Vikram", last_name: "Singh", designation: "DevOps Lead", kudos_count: 36, points_earned: 1080 },
      { user_id: 8, first_name: "Arjun", last_name: "Menon", designation: "Frontend Developer", kudos_count: 30, points_earned: 900 },
      { user_id: 9, first_name: "Divya", last_name: "Krishnan", designation: "Data Analyst", kudos_count: 27, points_earned: 810 },
    ]);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tr("Analytics")}</h1>
          <p className="mt-1 text-sm text-gray-500">{tr("Recognition trends, engagement metrics, and reports.")}</p>
        </div>
        {/* Range chips — drive the Kudos Trends fetch. Stat cards, top-user
            lists, etc. stay cumulative since they don't have a natural
            time-range scoping. A short caption under the group makes that
            clear. */}
        <div className="text-right">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-xs font-medium">
            {(Object.keys(RANGE_LABELS) as Range[]).map((r) => {
              const active = range === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  aria-pressed={active}
                  className={
                    "px-2.5 py-1 rounded-md transition-colors " +
                    (active
                      ? "bg-amber-500 text-white shadow-sm"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-700")
                  }
                >
                  {tr(RANGE_LABELS[r])}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-gray-400">{tr("Filters the trends chart")}</p>
        </div>
      </div>

      {/* Stat cards — distinct tone per metric, value sized up, icon shrunk
          and pinned right so the number reads first. */}
      {overview && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard icon={Heart}        tone="amber"   label={tr("Total Kudos")}        value={overview.totalKudos} />
          <StatCard icon={Coins}        tone="indigo"  label={tr("Points Distributed")} value={overview.pointsDistributed} />
          <StatCard icon={Award}        tone="emerald" label={tr("Badges Awarded")}     value={overview.badgesAwarded} />
          <StatCard icon={Target}       tone="violet"  label={tr("Active Programs")}    value={overview.activePrograms} />
          <StatCard icon={Gift}         tone="rose"    label={tr("Redemptions")}        value={overview.totalRedemptions} />
          <StatCard icon={TrendingUp}   tone="sky"     label={tr("Points Redeemed")}    value={overview.pointsRedeemed} />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Kudos Trends — Area chart with gradient fill reads as a higher-
            value summary than a bare line. Headline shows the period total
            so the chart isn't the only signal of magnitude. */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 relative">
          {trendsLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-[1px]">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            </div>
          )}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{tr("Kudos Trends")}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {range === "7d" ? tr("Daily recognition volume — last 7 days")
                  : range === "30d" ? tr("Daily recognition volume — last 30 days")
                  : range === "90d" ? tr("Weekly recognition volume — last 90 days")
                  : tr("Monthly recognition volume — all time")}
              </p>
            </div>
            {trends.length > 0 && (
              <div className="text-right">
                <p className="text-xs text-gray-400">{tr("Period total")}</p>
                <p className="text-base font-bold text-amber-700">
                  {trends.reduce((s, t) => s + t.kudos_count, 0).toLocaleString(activeLocale())}
                </p>
              </div>
            )}
          </div>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trends} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="kudosGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#9ca3af" tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                />
                <Area
                  type="monotone"
                  dataKey="kudos_count"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  fill="url(#kudosGradient)"
                  dot={{ fill: "#fff", stroke: "#f59e0b", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Kudos"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart
              icon={TrendingUp}
              title={tr("No trend data yet")}
              hint={tr("Once your team starts sending kudos, weekly volume will plot here.")}
            />
          )}
        </div>

        {/* Category Breakdown — donut with center total and a colored legend
            on the right so categories are scannable even without slice
            labels at small widths. */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900">{tr("Kudos by Category")}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{tr("Where recognition is flowing")}</p>
          </div>
          {categories.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="relative shrink-0">
                <ResponsiveContainer width={220} height={220}>
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="kudos_count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={2}
                    >
                      {categories.map((c, idx) => (
                        <Cell key={idx} fill={c.color || PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {categories.reduce((s, c) => s + c.kudos_count, 0).toLocaleString(activeLocale())}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">{tr("Kudos")}</p>
                </div>
              </div>
              <ul className="flex-1 space-y-2 min-w-0">
                {categories.slice(0, 6).map((c, idx) => {
                  const total = categories.reduce((s, x) => s + x.kudos_count, 0);
                  const pct = total > 0 ? Math.round((c.kudos_count / total) * 100) : 0;
                  return (
                    <li key={c.id} className="flex items-center gap-2 text-sm">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: c.color || PIE_COLORS[idx % PIE_COLORS.length] }}
                      />
                      <span className="flex-1 truncate text-gray-700">{c.name}</span>
                      <span className="text-xs text-gray-500">{pct}%</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <EmptyChart
              icon={Sparkles}
              title={tr("No category breakdown yet")}
              hint={tr("Send kudos with a category attached and they'll show up grouped here.")}
            />
          )}
        </div>
      </div>

      {/* Department Participation — gradient bar fill, no axis labels on
          the right edge to maximise the bar area. */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900">{tr("Department Participation")}</h3>
          <p className="text-xs text-gray-500 mt-0.5">

            {tr("Share of employees per department who have sent or received kudos")}
          </p>
        </div>
        {departments.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={departments} layout="vertical" margin={{ top: 10, right: 30, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="deptGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                stroke="#9ca3af"
                tickLine={false}
                domain={[0, 100]}
                unit="%"
              />
              <YAxis
                dataKey="department_name"
                type="category"
                width={120}
                tick={{ fontSize: 12, fill: "#374151" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(245, 158, 11, 0.06)" }}
                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                formatter={(value: any) => [`${value}%`, tr("Participation")]}
              />
              <Bar
                dataKey="participationRate"
                fill="url(#deptGradient)"
                radius={[0, 6, 6, 0]}
                background={{ fill: "#f9fafb", radius: 6 }}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart
            icon={BarChart3}
            title={tr("No department data yet")}
            hint={tr("Once kudos flow across departments, participation rates plot here.")}
          />
        )}
      </div>

      {/* Top Recognizers & Recognized — podium styling on top-3 (gold /
          silver / bronze chips), avatar initials with stable color per
          user, and per-user designation under the name. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TopUserList
          title={tr("Top Recognizers")}
          subtitle="Most active kudos senders"
          icon={Trophy}
          users={topRecognizers}
          metricKey="kudos_count"
          metricLabel="kudos sent"
        />
        <TopUserList
          title={tr("Top Recognized")}
          subtitle="Most recognized employees"
          icon={Heart}
          users={topRecognized}
          metricKey="kudos_count"
          metricLabel="kudos received"
        />
      </div>
    </div>
  );
}

function TopUserList({
  title,
  subtitle,
  icon: HeadingIcon,
  users,
  metricKey,
  metricLabel,
}: {
  title: string;
  subtitle: string;
  icon: any;
  users: TopUser[];
  metricKey: "kudos_count";
  metricLabel: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <HeadingIcon className="h-4 w-4" />
        </div>
      </div>
      {users.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-gray-400">{tr("No data yet")}</p>
      ) : (
        <ol className="divide-y divide-gray-100">
          {users.map((user, idx) => {
            const rs = rankStyle(idx);
            const RankIcon = rs.icon;
            return (
              <li key={user.user_id} className="flex items-center gap-3 px-5 py-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${rs.wrap}`}
                  title={`Rank ${idx + 1}`}
                >
                  {RankIcon ? <RankIcon className="h-3.5 w-3.5" /> : idx + 1}
                </span>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTone(user.user_id)}`}
                >
                  {initials(user.first_name, user.last_name)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.designation || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{user[metricKey]}</p>
                  <p className="text-[10px] text-gray-400">{metricLabel}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
