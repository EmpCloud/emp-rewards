import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Award, Users, Gift, Target } from "lucide-react";
import {
  LineChart, Line, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { apiGet } from "@/api/client";

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

const PIE_COLORS = ["#f59e0b", "#d97706", "#b45309", "#92400e", "#78350f", "#fbbf24", "#fcd34d", "#fde68a"];

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900">{typeof value === "number" ? value.toLocaleString() : value}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
  const [departments, setDepartments] = useState<DeptParticipation[]>([]);
  const [topRecognizers, setTopRecognizers] = useState<TopUser[]>([]);
  const [topRecognized, setTopRecognized] = useState<TopUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [ov, tr, cat, dept, recognizers, recognized] = await Promise.allSettled([
        apiGet<Overview>("/analytics/overview"),
        apiGet<TrendPoint[]>("/analytics/trends"),
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">Recognition trends, engagement metrics, and reports.</p>
      </div>

      {/* Stat cards */}
      {overview && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard icon={BarChart3} label="Total Kudos" value={overview.totalKudos} color="bg-amber-500" />
          <StatCard icon={TrendingUp} label="Points Distributed" value={overview.pointsDistributed} color="bg-amber-600" />
          <StatCard icon={Award} label="Badges Awarded" value={overview.badgesAwarded} color="bg-amber-700" />
          <StatCard icon={Target} label="Active Programs" value={overview.activePrograms} color="bg-orange-500" />
          <StatCard icon={Gift} label="Redemptions" value={overview.totalRedemptions} color="bg-orange-600" />
          <StatCard icon={TrendingUp} label="Points Redeemed" value={overview.pointsRedeemed} color="bg-orange-700" />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Kudos Trends Line Chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Kudos Trends</h3>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                />
                <Line
                  type="monotone"
                  dataKey="kudos_count"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: "#f59e0b", r: 4 }}
                  name="Kudos"
                />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">
              No trend data available
            </div>
          )}
        </div>

        {/* Category Breakdown Pie Chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Kudos by Category</h3>
          {categories.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categories}
                  dataKey="kudos_count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ strokeWidth: 1, stroke: "#9ca3af" }}
                >
                  {categories.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">
              No category data available
            </div>
          )}
        </div>
      </div>

      {/* Department Participation Bar Chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Department Participation</h3>
        {departments.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={departments} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" domain={[0, 100]} unit="%" />
              <YAxis dataKey="department_name" type="category" width={120} tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                formatter={(value: any) => `${value}%`}
              />
              <Bar dataKey="participationRate" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Participation Rate" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-sm text-gray-400">
            No department data available
          </div>
        )}
      </div>

      {/* Top Recognizers & Recognized */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Recognizers */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Top Recognizers</h3>
            <p className="text-xs text-gray-500">Most active kudos senders</p>
          </div>
          <div className="divide-y divide-gray-100">
            {topRecognizers.map((user, idx) => (
              <div key={user.user_id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.designation}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-amber-700">{user.kudos_count}</p>
                  <p className="text-[10px] text-gray-400">kudos sent</p>
                </div>
              </div>
            ))}
            {topRecognizers.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No data yet</p>
            )}
          </div>
        </div>

        {/* Top Recognized */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Top Recognized</h3>
            <p className="text-xs text-gray-500">Most recognized employees</p>
          </div>
          <div className="divide-y divide-gray-100">
            {topRecognized.map((user, idx) => (
              <div key={user.user_id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.designation}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-amber-700">{user.kudos_count}</p>
                  <p className="text-[10px] text-gray-400">kudos received</p>
                </div>
              </div>
            ))}
            {topRecognized.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No data yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
