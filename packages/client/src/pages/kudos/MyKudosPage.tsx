import { useState, useEffect, useCallback } from "react";
import { Heart, ThumbsUp, Award, MessageSquare, Loader2 } from "lucide-react";
import { apiGet, apiPost, apiDelete } from "@/api/client";
import { getUser } from "@/lib/auth-store";
import { cn, formatDate, getInitials } from "@/lib/utils";

interface KudosItem {
  id: string;
  sender_id: number;
  receiver_id: number;
  message: string;
  points: number;
  visibility: string;
  is_anonymous: boolean;
  created_at: string;
  sender_name?: string;
  receiver_name?: string;
  category_name?: string;
  category_color?: string;
}

interface Reaction {
  id: string;
  kudos_id: string;
  user_id: number;
  reaction_type: string;
}

const REACTION_ICONS: Record<string, { icon: typeof Heart; label: string }> = {
  like: { icon: ThumbsUp, label: "Like" },
  clap: { icon: Award, label: "Clap" },
  heart: { icon: Heart, label: "Heart" },
};

type Tab = "received" | "sent";

export function MyKudosPage() {
  const user = getUser();
  const [tab, setTab] = useState<Tab>("received");
  const [kudosList, setKudosList] = useState<KudosItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [reactionsMap, setReactionsMap] = useState<Record<string, Reaction[]>>({});

  const fetchKudos = useCallback(async (t: Tab, p: number) => {
    setLoading(true);
    try {
      // Fetch all kudos and filter client-side by sender/receiver
      // In production, the API would support filtering by sender_id/receiver_id
      const res = await apiGet<any>("/kudos", { page: p, perPage: 50 });
      if (res.success && res.data) {
        const allKudos: KudosItem[] = res.data.data || [];
        const userId = user?.empcloudUserId;
        const filtered = allKudos.filter((k) =>
          t === "received" ? k.receiver_id === userId : k.sender_id === userId,
        );
        setKudosList(filtered);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, [user?.empcloudUserId]);

  useEffect(() => {
    setPage(1);
    fetchKudos(tab, 1);
  }, [tab, fetchKudos]);

  useEffect(() => {
    fetchKudos(tab, page);
  }, [page, tab, fetchKudos]);

  const fetchReactions = async (kudosId: string) => {
    try {
      const res = await apiGet<any>(`/kudos/${kudosId}`);
      if (res.success && res.data) {
        setReactionsMap((prev) => ({ ...prev, [kudosId]: res.data.reactions || [] }));
      }
    } catch {
      // silent
    }
  };

  const handleReaction = async (kudosId: string, reactionType: string) => {
    if (!reactionsMap[kudosId]) {
      await fetchReactions(kudosId);
    }

    const reactions = reactionsMap[kudosId] || [];
    const existing = reactions.find(
      (r) => r.user_id === user?.empcloudUserId && r.reaction_type === reactionType,
    );

    try {
      if (existing) {
        await apiDelete(`/kudos/${kudosId}/reactions/${reactionType}`);
      } else {
        await apiPost(`/kudos/${kudosId}/reactions`, { reaction_type: reactionType });
      }
      await fetchReactions(kudosId);
    } catch {
      // silent
    }
  };

  const getReactionCounts = (kudosId: string) => {
    const reactions = reactionsMap[kudosId] || [];
    const counts: Record<string, number> = {};
    const userReacted: Record<string, boolean> = {};
    for (const r of reactions) {
      counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1;
      if (r.user_id === user?.empcloudUserId) {
        userReacted[r.reaction_type] = true;
      }
    }
    return { counts, userReacted };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Kudos</h1>
        <p className="mt-1 text-sm text-gray-500">View kudos you have sent and received.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab("received")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
            tab === "received"
              ? "border-amber-500 text-amber-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          )}
        >
          Received
        </button>
        <button
          onClick={() => setTab("sent")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
            tab === "sent"
              ? "border-amber-500 text-amber-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          )}
        >
          Sent
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : kudosList.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Heart className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            {tab === "received"
              ? "No kudos received yet."
              : "No kudos sent yet. Go send some recognition!"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {kudosList.map((kudos) => {
            const { counts, userReacted } = getReactionCounts(kudos.id);
            return (
              <div
                key={kudos.id}
                className="rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-sm font-semibold">
                      {tab === "received"
                        ? kudos.is_anonymous
                          ? "?"
                          : getInitials(kudos.sender_name || `User ${kudos.sender_id}`)
                        : getInitials(kudos.receiver_name || `User ${kudos.receiver_id}`)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {tab === "received" ? (
                          <>
                            <span className="font-semibold">
                              {kudos.is_anonymous ? "Anonymous" : kudos.sender_name || `User #${kudos.sender_id}`}
                            </span>
                            <span className="text-gray-500"> sent you kudos</span>
                          </>
                        ) : (
                          <>
                            <span className="text-gray-500">You recognized </span>
                            <span className="font-semibold">
                              {kudos.receiver_name || `User #${kudos.receiver_id}`}
                            </span>
                          </>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(kudos.created_at)}</p>
                    </div>
                  </div>
                  {kudos.points > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      <Award className="h-3 w-3" />
                      +{kudos.points} pts
                    </span>
                  )}
                </div>

                <p className="mt-3 text-sm text-gray-700 leading-relaxed">{kudos.message}</p>

                {/* Reactions */}
                <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
                  {Object.entries(REACTION_ICONS).map(([type, { icon: Icon, label }]) => {
                    const count = counts[type] || 0;
                    const active = userReacted[type] || false;
                    return (
                      <button
                        key={type}
                        onClick={() => handleReaction(kudos.id, type)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                          active
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-50 text-gray-500 hover:bg-gray-100",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {count > 0 ? count : label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
