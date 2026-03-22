import { useState, useEffect } from "react";
import { Trophy, Medal, Crown, ChevronDown, User } from "lucide-react";
import { apiGet } from "@/api/client";

interface LeaderboardEntry {
  user_id: number;
  rank: number;
  total_points: number;
  kudos_received: number;
  kudos_sent: number;
  badges_earned: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  designation?: string;
  department_id?: number | null;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

const PERIODS = [
  { value: "weekly", label: "This Week" },
  { value: "monthly", label: "This Month" },
  { value: "quarterly", label: "This Quarter" },
  { value: "yearly", label: "This Year" },
  { value: "all_time", label: "All Time" },
];

function PodiumCard({
  entry,
  place,
}: {
  entry: LeaderboardEntry;
  place: 1 | 2 | 3;
}) {
  const colors = {
    1: { bg: "bg-amber-50", border: "border-amber-400", icon: "text-amber-500", ring: "ring-amber-400" },
    2: { bg: "bg-gray-50", border: "border-gray-400", icon: "text-gray-400", ring: "ring-gray-300" },
    3: { bg: "bg-orange-50", border: "border-orange-400", icon: "text-orange-400", ring: "ring-orange-300" },
  };
  const c = colors[place];
  const heights = { 1: "h-36", 2: "h-28", 3: "h-24" };
  const name = entry.first_name
    ? `${entry.first_name} ${entry.last_name || ""}`
    : entry.email || `User #${entry.user_id}`;

  return (
    <div className={`flex flex-col items-center ${place === 1 ? "order-2" : place === 2 ? "order-1" : "order-3"}`}>
      <div className="relative mb-2">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${c.bg} border-2 ${c.border} ring-2 ${c.ring}`}>
          <User className="h-8 w-8 text-gray-400" />
        </div>
        {place === 1 && (
          <Crown className="absolute -top-3 left-1/2 h-6 w-6 -translate-x-1/2 text-amber-500" />
        )}
        <div className={`absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full ${c.bg} border ${c.border} text-xs font-bold`}>
          {place}
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-900 text-center max-w-[120px] truncate">{name}</p>
      {entry.designation && (
        <p className="text-xs text-gray-500 truncate max-w-[120px]">{entry.designation}</p>
      )}
      <div className={`mt-2 flex ${heights[place]} w-24 flex-col items-center justify-end rounded-t-lg ${c.bg} border ${c.border} p-2`}>
        <Trophy className={`h-5 w-5 ${c.icon} mb-1`} />
        <span className="text-lg font-bold text-gray-900">{entry.total_points.toLocaleString()}</span>
        <span className="text-[10px] text-gray-500">points</span>
      </div>
    </div>
  );
}

export function LeaderboardPage() {
  const [period, setPeriod] = useState("monthly");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [myRank, setMyRank] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchLeaderboard();
    fetchMyRank();
  }, [period, page]);

  async function fetchLeaderboard() {
    setLoading(true);
    try {
      const res = await apiGet<LeaderboardData>("/leaderboard", { period, page, perPage: 20 });
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch {
      // Use demo data on error
      setData(getDemoData());
    } finally {
      setLoading(false);
    }
  }

  async function fetchMyRank() {
    try {
      const res = await apiGet<any>("/leaderboard/my-rank", { period });
      if (res.success && res.data) {
        setMyRank(res.data);
      }
    } catch {
      setMyRank({ rank: 4, total_points: 890, kudos_received: 32, kudos_sent: 18, badges_earned: 3, totalParticipants: 45 });
    }
  }

  const entries = data?.entries || [];
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leaderboard</h1>
          <p className="mt-1 text-sm text-gray-500">Top recognized employees by period.</p>
        </div>
        <div className="relative">
          <select
            value={period}
            onChange={(e) => { setPeriod(e.target.value); setPage(1); }}
            className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-9 text-sm font-medium text-gray-700 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* My rank card */}
      {myRank && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <Medal className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Your Rank</p>
                <p className="text-xs text-gray-500">
                  #{myRank.rank} of {myRank.totalParticipants} participants
                </p>
              </div>
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-lg font-bold text-amber-700">{myRank.total_points?.toLocaleString()}</p>
                <p className="text-[10px] text-gray-500 uppercase">Points</p>
              </div>
              <div>
                <p className="text-lg font-bold text-amber-700">{myRank.kudos_received}</p>
                <p className="text-[10px] text-gray-500 uppercase">Received</p>
              </div>
              <div>
                <p className="text-lg font-bold text-amber-700">{myRank.kudos_sent}</p>
                <p className="text-[10px] text-gray-500 uppercase">Sent</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Podium */}
          {top3.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex items-end justify-center gap-4 pb-2">
                {top3.length > 1 && <PodiumCard entry={top3[1]} place={2} />}
                {top3.length > 0 && <PodiumCard entry={top3[0]} place={1} />}
                {top3.length > 2 && <PodiumCard entry={top3[2]} place={3} />}
              </div>
            </div>
          )}

          {/* Ranked table */}
          {rest.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">Rank</th>
                    <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500">Employee</th>
                    <th className="px-4 py-3 text-xs font-medium uppercase text-gray-500 text-right">Points</th>
                    <th className="hidden px-4 py-3 text-xs font-medium uppercase text-gray-500 text-right sm:table-cell">Kudos Received</th>
                    <th className="hidden px-4 py-3 text-xs font-medium uppercase text-gray-500 text-right md:table-cell">Kudos Sent</th>
                    <th className="hidden px-4 py-3 text-xs font-medium uppercase text-gray-500 text-right md:table-cell">Badges</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rest.map((entry) => {
                    const name = entry.first_name
                      ? `${entry.first_name} ${entry.last_name || ""}`
                      : entry.email || `User #${entry.user_id}`;
                    return (
                      <tr key={entry.user_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
                            {entry.rank}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{name}</p>
                          {entry.designation && (
                            <p className="text-xs text-gray-500">{entry.designation}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-amber-700">
                          {entry.total_points.toLocaleString()}
                        </td>
                        <td className="hidden px-4 py-3 text-right text-gray-600 sm:table-cell">
                          {entry.kudos_received}
                        </td>
                        <td className="hidden px-4 py-3 text-right text-gray-600 md:table-cell">
                          {entry.kudos_sent}
                        </td>
                        <td className="hidden px-4 py-3 text-right text-gray-600 md:table-cell">
                          {entry.badges_earned}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {((page - 1) * 20) + 1}--{Math.min(page * 20, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page >= data.totalPages}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {entries.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
              <Trophy className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">No leaderboard data for this period yet.</p>
              <p className="mt-1 text-xs text-gray-400">Start sending kudos to populate the leaderboard!</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Demo data fallback
// ---------------------------------------------------------------------------
function getDemoData(): LeaderboardData {
  const names = [
    { first_name: "Ananya", last_name: "Sharma", designation: "Engineering Manager" },
    { first_name: "Rahul", last_name: "Patel", designation: "Senior Developer" },
    { first_name: "Priya", last_name: "Nair", designation: "Product Designer" },
    { first_name: "Vikram", last_name: "Singh", designation: "DevOps Lead" },
    { first_name: "Sneha", last_name: "Gupta", designation: "QA Engineer" },
    { first_name: "Arjun", last_name: "Menon", designation: "Frontend Developer" },
    { first_name: "Divya", last_name: "Krishnan", designation: "Data Analyst" },
    { first_name: "Karthik", last_name: "Iyer", designation: "Backend Developer" },
    { first_name: "Meera", last_name: "Joshi", designation: "HR Manager" },
    { first_name: "Sanjay", last_name: "Reddy", designation: "Tech Lead" },
  ];
  return {
    entries: names.map((n, i) => ({
      user_id: i + 1,
      rank: i + 1,
      total_points: 1200 - i * 85,
      kudos_received: 45 - i * 3,
      kudos_sent: 30 - i * 2,
      badges_earned: Math.max(1, 7 - i),
      ...n,
    })),
    total: 10,
    page: 1,
    perPage: 20,
    totalPages: 1,
  };
}
