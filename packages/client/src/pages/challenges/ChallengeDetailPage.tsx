import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Swords, Trophy, Clock, Users, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { apiGet, apiPost } from "@/api/client";
import { getUser } from "@/lib/auth-store";
import { cn, formatDate } from "@/lib/utils";

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  type: string;
  metric: string;
  target_value: number;
  start_date: string;
  end_date: string;
  reward_points: number;
  reward_badge_id: string | null;
  status: string;
  created_by: number;
}

interface Participant {
  id: string;
  challenge_id: string;
  user_id: number;
  current_value: number;
  rank: number | null;
  completed: boolean;
  completed_at: string | null;
  first_name?: string;
  last_name?: string;
  designation?: string;
}

const METRIC_LABELS: Record<string, string> = {
  kudos_sent: "Kudos Sent",
  kudos_received: "Kudos Received",
  points_earned: "Points Earned",
  badges_earned: "Badges Earned",
};

export function ChallengeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = getUser();
  const isAdmin = user?.role === "hr_admin" || user?.role === "org_admin" || user?.role === "super_admin";
  const userId = user?.empcloudUserId;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const hasJoined = participants.some((p) => p.user_id === userId);
  const myProgress = participants.find((p) => p.user_id === userId);

  useEffect(() => {
    fetchChallenge();
  }, [id]);

  async function fetchChallenge() {
    setLoading(true);
    try {
      const res = await apiGet<any>(`/challenges/${id}`);
      if (res.success && res.data) {
        setChallenge(res.data.challenge);
        setParticipants(res.data.participants || []);
        setParticipantCount(res.data.participantCount || 0);
      }
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    setJoining(true);
    try {
      await apiPost(`/challenges/${id}/join`);
      await fetchChallenge();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || "Failed to join challenge");
    } finally {
      setJoining(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await apiPost(`/challenges/${id}/refresh-progress`);
      await fetchChallenge();
    } catch (err: any) {
      console.error("Failed to refresh progress:", err);
      alert(err.response?.data?.error?.message || "Failed to refresh progress. Please try again.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleComplete() {
    try {
      await apiPost(`/challenges/${id}/complete`);
      fetchChallenge();
    } catch {
      // error
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Challenge not found.</p>
        <Link to="/challenges" className="mt-2 text-brand-600 text-sm underline">
          Back to Challenges
        </Link>
      </div>
    );
  }

  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(challenge.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link to="/challenges" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" />
        Back to Challenges
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
              <Swords className="h-6 w-6 text-brand-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{challenge.title}</h1>
              <p className="text-sm text-gray-500">{challenge.description}</p>
            </div>
          </div>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              challenge.status === "active" && "bg-green-100 text-green-700",
              challenge.status === "upcoming" && "bg-blue-100 text-blue-700",
              challenge.status === "completed" && "bg-gray-100 text-gray-600",
              challenge.status === "cancelled" && "bg-red-100 text-red-700",
            )}
          >
            {challenge.status}
          </span>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-lg font-bold text-gray-900">{challenge.target_value}</p>
            <p className="text-xs text-gray-500">{METRIC_LABELS[challenge.metric] || challenge.metric}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-lg font-bold text-gray-900">{participantCount}</p>
            <p className="text-xs text-gray-500">Participants</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-lg font-bold text-amber-600">{challenge.reward_points}</p>
            <p className="text-xs text-gray-500">Reward Points</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-lg font-bold text-gray-900">{daysLeft}</p>
            <p className="text-xs text-gray-500">Days Left</p>
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-400">
          {formatDate(challenge.start_date)} - {formatDate(challenge.end_date)}
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          {(challenge.status === "active" || challenge.status === "upcoming") && !hasJoined && (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {joining ? "Joining..." : "Join Challenge"}
            </button>
          )}
          {hasJoined && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm font-medium text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              Joined
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Refresh Progress"}
          </button>
          {isAdmin && challenge.status === "active" && (
            <button
              onClick={handleComplete}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              Complete Challenge
            </button>
          )}
        </div>
      </div>

      {/* Your progress */}
      {myProgress && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-5">
          <h3 className="text-sm font-semibold text-brand-800">Your Progress</h3>
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-brand-700">
                {myProgress.current_value} / {challenge.target_value}
              </span>
              <span className="text-sm text-brand-600">
                {Math.min(100, Math.round((myProgress.current_value / challenge.target_value) * 100))}%
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-brand-100">
              <div
                className="h-3 rounded-full bg-brand-500 transition-all"
                style={{
                  width: `${Math.min(100, (myProgress.current_value / challenge.target_value) * 100)}%`,
                }}
              />
            </div>
            {myProgress.completed && (
              <p className="mt-2 text-sm font-medium text-green-700">
                Completed {myProgress.completed_at ? formatDate(myProgress.completed_at) : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Leaderboard</h3>
          <p className="text-xs text-gray-500">{participantCount} participants</p>
        </div>
        <div className="divide-y divide-gray-100">
          {participants.map((p, idx) => {
            const progress = Math.min(100, Math.round((p.current_value / challenge.target_value) * 100));
            const isMe = p.user_id === userId;
            return (
              <div
                key={p.id}
                className={cn("flex items-center gap-3 px-5 py-3", isMe && "bg-brand-50/50")}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                    idx === 0 && "bg-amber-100 text-amber-700",
                    idx === 1 && "bg-gray-200 text-gray-600",
                    idx === 2 && "bg-orange-100 text-orange-700",
                    idx > 2 && "bg-gray-100 text-gray-500",
                  )}
                >
                  {p.rank || idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium truncate", isMe ? "text-brand-700" : "text-gray-900")}>
                    {p.first_name} {p.last_name}
                    {isMe && " (you)"}
                  </p>
                  <p className="text-xs text-gray-500">{p.designation}</p>
                </div>
                <div className="w-32 hidden sm:block">
                  <div className="h-2 rounded-full bg-gray-100">
                    <div
                      className={cn("h-2 rounded-full transition-all", p.completed ? "bg-green-500" : "bg-brand-500")}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <div className="text-right min-w-[60px]">
                  <p className="text-sm font-semibold text-gray-900">{p.current_value}</p>
                  <p className="text-[10px] text-gray-400">/ {challenge.target_value}</p>
                </div>
                {p.completed && (
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                )}
              </div>
            );
          })}
          {participants.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-gray-400">No participants yet. Be the first to join!</p>
          )}
        </div>
      </div>
    </div>
  );
}
