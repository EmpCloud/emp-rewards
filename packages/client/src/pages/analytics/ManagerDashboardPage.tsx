import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Users, Heart, TrendingUp, BarChart3, ArrowLeft, Loader2, AlertTriangle,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { apiGet } from "@/api/client";
import { getUser } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

interface ManagerDashboard {
  teamSize: number;
  kudosGivenThisMonth: number;
  teamKudosReceived: number;
  engagementScore: number;
  orgAverageEngagement: number;
  teamMembers: TeamMember[];
  trends: TrendPoint[];
}

interface TeamMember {
  user_id: number;
  first_name: string;
  last_name: string;
  designation: string;
  kudos_sent: number;
  kudos_received: number;
}

interface TrendPoint {
  period: string;
  kudos_count: number;
}

interface ManagerComparison {
  manager_id: number;
  first_name: string;
  last_name: string;
  designation: string;
  team_size: number;
  team_kudos_3m: number;
  engagementScore: number;
  rank: number;
}

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

export function ManagerDashboardPage() {
  const { managerId } = useParams<{ managerId: string }>();
  const user = getUser();
  const [dashboard, setDashboard] = useState<ManagerDashboard | null>(null);
  const [managers, setManagers] = useState<ManagerComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"dashboard" | "comparison">(
    managerId ? "dashboard" : "comparison",
  );

  useEffect(() => {
    if (managerId) {
      fetchDashboard(parseInt(managerId));
    } else {
      fetchComparison();
    }
  }, [managerId]);

  async function fetchDashboard(id: number) {
    setLoading(true);
    try {
      const res = await apiGet<ManagerDashboard>(`/analytics/manager/${id}`);
      if (res.success && res.data) {
        setDashboard(res.data);
      }
    } catch {
      // fallback demo data
      setDashboard({
        teamSize: 8,
        kudosGivenThisMonth: 12,
        teamKudosReceived: 24,
        engagementScore: 4.2,
        orgAverageEngagement: 3.5,
        teamMembers: [
          { user_id: 1, first_name: "Rahul", last_name: "Patel", designation: "Senior Developer", kudos_sent: 5, kudos_received: 8 },
          { user_id: 2, first_name: "Sneha", last_name: "Gupta", designation: "QA Engineer", kudos_sent: 3, kudos_received: 6 },
          { user_id: 3, first_name: "Arjun", last_name: "Menon", designation: "Frontend Developer", kudos_sent: 4, kudos_received: 4 },
          { user_id: 4, first_name: "Divya", last_name: "Krishnan", designation: "Data Analyst", kudos_sent: 2, kudos_received: 3 },
          { user_id: 5, first_name: "Kiran", last_name: "Reddy", designation: "Backend Developer", kudos_sent: 1, kudos_received: 2 },
        ],
        trends: [
          { period: "2025-10", kudos_count: 18 },
          { period: "2025-11", kudos_count: 22 },
          { period: "2025-12", kudos_count: 25 },
          { period: "2026-01", kudos_count: 20 },
          { period: "2026-02", kudos_count: 28 },
          { period: "2026-03", kudos_count: 24 },
        ],
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchComparison() {
    setLoading(true);
    try {
      const res = await apiGet<ManagerComparison[]>("/analytics/managers");
      if (res.success && res.data) {
        setManagers(Array.isArray(res.data) ? res.data : []);
      }
    } catch {
      // fallback demo data
      setManagers([
        { manager_id: 1, first_name: "Ananya", last_name: "Sharma", designation: "Engineering Manager", team_size: 8, team_kudos_3m: 72, engagementScore: 4.5, rank: 1 },
        { manager_id: 2, first_name: "Meera", last_name: "Joshi", designation: "Product Manager", team_size: 6, team_kudos_3m: 45, engagementScore: 3.8, rank: 2 },
        { manager_id: 3, first_name: "Vikram", last_name: "Singh", designation: "Design Lead", team_size: 4, team_kudos_3m: 28, engagementScore: 3.5, rank: 3 },
        { manager_id: 4, first_name: "Sanjay", last_name: "Reddy", designation: "QA Manager", team_size: 5, team_kudos_3m: 20, engagementScore: 2.7, rank: 4 },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  // Comparison view (all managers)
  if (!managerId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manager Comparison</h1>
          <p className="mt-1 text-sm text-gray-500">Team engagement scores across all managers.</p>
        </div>

        {/* Bar chart comparison */}
        {managers.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Engagement Score by Manager</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={managers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis
                  dataKey={(d) => `${d.first_name} ${d.last_name}`}
                  type="category"
                  width={150}
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                />
                <Bar dataKey="engagementScore" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Engagement Score" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Rankings</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {managers.map((m) => (
              <Link
                key={m.manager_id}
                to={`/analytics/manager/${m.manager_id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                    m.rank === 1 && "bg-amber-100 text-amber-700",
                    m.rank === 2 && "bg-gray-200 text-gray-600",
                    m.rank === 3 && "bg-orange-100 text-orange-700",
                    m.rank > 3 && "bg-gray-100 text-gray-500",
                  )}
                >
                  {m.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {m.first_name} {m.last_name}
                  </p>
                  <p className="text-xs text-gray-500">{m.designation}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-amber-700">{m.engagementScore}</p>
                  <p className="text-[10px] text-gray-400">{m.team_size} team members</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Single manager dashboard
  if (!dashboard) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Dashboard data not available.</p>
      </div>
    );
  }

  const engagementDiff = dashboard.orgAverageEngagement > 0
    ? Math.round(((dashboard.engagementScore - dashboard.orgAverageEngagement) / dashboard.orgAverageEngagement) * 100)
    : 0;

  const comparisonData = [
    { name: "Your Team", score: dashboard.engagementScore },
    { name: "Org Average", score: dashboard.orgAverageEngagement },
  ];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link to="/analytics/managers" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" />
        All Managers
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Team recognition and engagement overview.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Team Size" value={dashboard.teamSize} color="bg-blue-500" />
        <StatCard icon={Heart} label="Kudos Given (Month)" value={dashboard.kudosGivenThisMonth} color="bg-pink-500" />
        <StatCard icon={Heart} label="Team Received (Month)" value={dashboard.teamKudosReceived} color="bg-amber-500" />
        <StatCard
          icon={TrendingUp}
          label="Engagement Score"
          value={dashboard.engagementScore}
          sub={`Org avg: ${dashboard.orgAverageEngagement}`}
          color="bg-green-500"
        />
      </div>

      {/* Recommendation */}
      {engagementDiff < -10 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Your team's recognition is {Math.abs(engagementDiff)}% below the organization average.
            </p>
            <p className="mt-1 text-sm text-amber-700">
              Consider sending more kudos to your team members and encouraging peer recognition.
            </p>
          </div>
        </div>
      )}
      {engagementDiff >= 10 && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-5 py-4 flex items-start gap-3">
          <TrendingUp className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800">
              Great job! Your team's recognition is {engagementDiff}% above the organization average.
            </p>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Engagement comparison */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Engagement vs Org Average</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
              <Bar dataKey="score" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Score" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trend chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Team Engagement Trend</h3>
          {dashboard.trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dashboard.trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                <Line
                  type="monotone"
                  dataKey="kudos_count"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: "#f59e0b", r: 4 }}
                  name="Team Kudos"
                />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">
              No trend data available
            </div>
          )}
        </div>
      </div>

      {/* Team members table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Team Members</h3>
          <p className="text-xs text-gray-500">Individual recognition stats this month</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase text-gray-500">
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3 text-center">Kudos Sent</th>
                <th className="px-5 py-3 text-center">Kudos Received</th>
                <th className="px-5 py-3 text-center">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dashboard.teamMembers.map((m) => (
                <tr key={m.user_id} className="text-sm">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{m.first_name} {m.last_name}</p>
                    <p className="text-xs text-gray-500">{m.designation}</p>
                  </td>
                  <td className="px-5 py-3 text-center text-gray-700">{m.kudos_sent}</td>
                  <td className="px-5 py-3 text-center text-gray-700">{m.kudos_received}</td>
                  <td className="px-5 py-3 text-center font-semibold text-amber-700">
                    {m.kudos_sent + m.kudos_received}
                  </td>
                </tr>
              ))}
              {dashboard.teamMembers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-400">
                    No team members found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
