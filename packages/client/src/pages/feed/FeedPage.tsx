import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Heart,
  ThumbsUp,
  Award,
  Send,
  Plus,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trash2,
} from "lucide-react";
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
  category_id: string | null;
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

interface Comment {
  id: string;
  kudos_id: string;
  user_id: number;
  content: string;
  created_at: string;
  user_name?: string;
}

const REACTION_ICONS: Record<string, { icon: typeof Heart; label: string }> = {
  like: { icon: ThumbsUp, label: "Like" },
  clap: { icon: Award, label: "Clap" },
  heart: { icon: Heart, label: "Heart" },
};

export function FeedPage() {
  const navigate = useNavigate();
  const user = getUser();
  const [kudosList, setKudosList] = useState<KudosItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [reactionsMap, setReactionsMap] = useState<Record<string, Reaction[]>>({});
  const [commentsMap, setCommentsMap] = useState<Record<string, Comment[]>>({});
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const fetchFeed = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await apiGet<any>("/kudos", { page: p, perPage: 20 });
      if (res.success && res.data) {
        setKudosList(res.data.data || []);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed(page);
  }, [page, fetchFeed]);

  const fetchKudosDetail = async (kudosId: string) => {
    try {
      const res = await apiGet<any>(`/kudos/${kudosId}`);
      if (res.success && res.data) {
        setReactionsMap((prev) => ({ ...prev, [kudosId]: res.data.reactions || [] }));
        setCommentsMap((prev) => ({ ...prev, [kudosId]: res.data.comments || [] }));
      }
    } catch {
      // silent
    }
  };

  const toggleComments = (kudosId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(kudosId)) {
        next.delete(kudosId);
      } else {
        next.add(kudosId);
        if (!commentsMap[kudosId]) {
          fetchKudosDetail(kudosId);
        }
      }
      return next;
    });
    // Also fetch reactions if not loaded
    if (!reactionsMap[kudosId]) {
      fetchKudosDetail(kudosId);
    }
  };

  const handleReaction = async (kudosId: string, reactionType: string) => {
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
      await fetchKudosDetail(kudosId);
    } catch {
      // silent
    }
  };

  const handleAddComment = async (kudosId: string) => {
    const content = commentInputs[kudosId]?.trim();
    if (!content) return;

    try {
      await apiPost(`/kudos/${kudosId}/comments`, { content });
      setCommentInputs((prev) => ({ ...prev, [kudosId]: "" }));
      await fetchKudosDetail(kudosId);
    } catch {
      // silent
    }
  };

  const handleDeleteComment = async (kudosId: string, commentId: string) => {
    try {
      await apiDelete(`/kudos/${kudosId}/comments/${commentId}`);
      await fetchKudosDetail(kudosId);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recognition Feed</h1>
          <p className="mt-1 text-sm text-gray-500">
            See all public kudos and recognitions across your organization.
          </p>
        </div>
        <button
          onClick={() => navigate("/kudos/send")}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Send Kudos
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : kudosList.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <MessageSquare className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No recognitions yet. Be the first to send kudos!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {kudosList.map((kudos) => {
            const { counts, userReacted } = getReactionCounts(kudos.id);
            const comments = commentsMap[kudos.id] || [];
            const isExpanded = expandedComments.has(kudos.id);

            return (
              <div
                key={kudos.id}
                className="rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-sm"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-sm font-semibold">
                      {kudos.is_anonymous ? "?" : getInitials(kudos.sender_name || `User ${kudos.sender_id}`)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        <span className="font-semibold">
                          {kudos.is_anonymous ? "Anonymous" : kudos.sender_name || `User #${kudos.sender_id}`}
                        </span>
                        <span className="text-gray-500"> recognized </span>
                        <span className="font-semibold">
                          {kudos.receiver_name || `User #${kudos.receiver_id}`}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(kudos.created_at)}</p>
                    </div>
                  </div>
                  {kudos.category_name && (
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: `${kudos.category_color || "#f59e0b"}20`,
                        color: kudos.category_color || "#d97706",
                      }}
                    >
                      {kudos.category_name}
                    </span>
                  )}
                </div>

                {/* Message */}
                <p className="mt-3 text-sm text-gray-700 leading-relaxed">{kudos.message}</p>

                {/* Points badge */}
                {kudos.points > 0 && (
                  <div className="mt-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      <Award className="h-3 w-3" />
                      +{kudos.points} points
                    </span>
                  </div>
                )}

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
                        {count > 0 && count}
                        {count === 0 && label}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => toggleComments(kudos.id)}
                    className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Comments
                    {isExpanded ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </div>

                {/* Comments section */}
                {isExpanded && (
                  <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                    {comments.length === 0 && (
                      <p className="text-xs text-gray-400">No comments yet.</p>
                    )}
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex items-start gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                          {getInitials(comment.user_name || `U${comment.user_id}`)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs">
                            <span className="font-medium text-gray-900">
                              {comment.user_name || `User #${comment.user_id}`}
                            </span>{" "}
                            <span className="text-gray-600">{comment.content}</span>
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatDate(comment.created_at)}</p>
                        </div>
                        {comment.user_id === user?.empcloudUserId && (
                          <button
                            onClick={() => handleDeleteComment(kudos.id, comment.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Add comment */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Add a comment..."
                        value={commentInputs[kudos.id] || ""}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({ ...prev, [kudos.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddComment(kudos.id);
                        }}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs placeholder:text-gray-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                      <button
                        onClick={() => handleAddComment(kudos.id)}
                        className="rounded-lg bg-amber-500 p-1.5 text-white hover:bg-amber-600 transition-colors"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating Send Kudos button (mobile) */}
      <button
        onClick={() => navigate("/kudos/send")}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 transition-colors lg:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
