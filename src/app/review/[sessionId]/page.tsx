"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2, GitBranch, Filter, Brain, Square, Terminal, Gamepad2, CheckCircle2 } from "lucide-react";
import ReviewItemCard from "@/components/review/ReviewItemCard";
import GoblinRunner from "@/components/review/GoblinRunner";
import type { Session, ReviewItemWithRating, PRComment } from "@/lib/types";
import type { PRInfo } from "@/components/review/ReviewItemCard";

const REVIEW_QUIPS = [
  "Judging your variable names...",
  "Counting nested ternaries...",
  "Searching for TODOs you forgot about...",
  "Wondering why this function is 200 lines...",
  "Appreciating your semicolons...",
  "Looking for off-by-one errors... or was it off-by-two?",
  "Checking if you remembered to remove console.logs...",
  "Admiring your commit message creativity...",
  "Questioning your use of 'any'...",
  "Reviewing naming conventions... camelCase? snake_case? yOLOcAsE?",
  "Scanning for magic numbers...",
  "Making sure you didn't just copy from Stack Overflow...",
  "Analyzing your bracket style choices...",
  "Pondering your dependency tree...",
  "Looking for that one missing null check...",
  "Whispering sweet nothings to the AST...",
  "Performing mass therapy on your spaghetti code...",
  "This code has... personality...",
  "Counting the layers of abstraction... still counting...",
  "Googling what this regex does...",
  "Found a switch statement. Sending thoughts and prayers...",
  "Your git blame is going to be interesting after this...",
  "Pretending to understand your architecture...",
  "Questioning every life choice that led to this diff...",
  "Is this a design pattern or a cry for help?",
  "Reading your code like it's cursed literature...",
  "This function has more side effects than a pharmaceutical ad...",
  "Trying to figure out if this is clever or unhinged...",
  "Your future self is going to have questions about this...",
  "Detecting mass extinction event in error handling...",
  "Somewhere, a CS professor just felt a disturbance...",
  "The technical debt is gaining sentience...",
  "I've seen things you wouldn't believe... like this nested callback...",
  "Running the code through a Ouija board for good measure...",
  "This try-catch is doing a lot of emotional labor...",
  "Ah yes, the classic 'it works on my machine' architecture...",
  "Submitting your variable names to a poetry contest...",
  "Briefing the AI on why tabs are superior... or was it spaces?",
  "Locating the load-bearing console.log...",
  "Your code is valid. Morally? That's another question...",
];

type FilterSeverity = "all" | "critical" | "blocking" | "suggestion" | "nit";
type FilterRating = "all" | "rated" | "unrated";
type FilterViewed = "all" | "viewed" | "unviewed";

export default function ReviewSessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<ReviewItemWithRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState({ chunksCompleted: 0, chunksTotal: 0, itemsFound: 0 });
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>("all");
  const [filterRating, setFilterRating] = useState<FilterRating>("all");
  const [filterViewed, setFilterViewed] = useState<FilterViewed>("all");
  const [learningStatus, setLearningStatus] = useState("");
  const [isLearningActive, setIsLearningActive] = useState(false);
  const [learningState, setLearningState] = useState<{
    hasRatings: boolean;
    hasLearnings: boolean;
    needsLearning: boolean;
  } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [quipIndex, setQuipIndex] = useState(() => Math.floor(Math.random() * REVIEW_QUIPS.length));
  const [activityLog, setActivityLog] = useState<{ tool: string; input: string }[]>([]);
  const [showActivity, setShowActivity] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [prInfo, setPrInfo] = useState<PRInfo | null>(null);
  const [prLoading, setPrLoading] = useState(false);
  const activityEndRef = useRef<HTMLDivElement | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const learningPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/reviews/${sessionId}`);
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
        setItems(data.items || []);
      }
    } catch {
      // will retry via SSE
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (!session) return;
    setPrLoading(true);
    fetch(`/api/github/pr-info?repoPath=${encodeURIComponent(session.repo_path)}&branch=${session.branch}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.pr) setPrInfo(data.pr);
      })
      .catch(() => {})
      .finally(() => setPrLoading(false));
  }, [session?.repo_path, session?.branch]);

  useEffect(() => {
    if (!session || session.status === "completed" || session.status === "failed" || session.status === "cancelled") return;

    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    const es = new EventSource(`/api/reviews/${sessionId}/stream`);
    eventSourceRef.current = es;

    es.addEventListener("status", (e) => {
      const data = JSON.parse(e.data);
      setStatus(data.message || "");
    });

    es.addEventListener("item", (e) => {
      const newItem = JSON.parse(e.data);
      setItems((prev) => [
        ...prev,
        { ...newItem, rating: null, comments: [], prComment: null, viewed: false, created_at: new Date().toISOString() } as ReviewItemWithRating,
      ]);
    });

    es.addEventListener("progress", (e) => {
      setProgress(JSON.parse(e.data));
    });

    es.addEventListener("activity", (e) => {
      const data = JSON.parse(e.data);
      setActivityLog((prev) => [...prev.slice(-49), data]);
    });

    es.addEventListener("complete", () => {
      setSession((prev) => prev ? { ...prev, status: "completed" } : prev);
      es.close();
      if (Notification.permission === "granted") {
        new Notification("Review Complete", {
          body: "Your code review has finished.",
        });
      }
    });

    es.addEventListener("cancelled", () => {
      setSession((prev) => prev ? { ...prev, status: "cancelled" } : prev);
      setCancelling(false);
      es.close();
    });

    es.addEventListener("error", (e) => {
      if (e instanceof MessageEvent) {
        const data = JSON.parse(e.data);
        setStatus(`Error: ${data.message}`);
      }
      setSession((prev) => prev ? { ...prev, status: "failed" } : prev);
      es.close();
    });

    return () => es.close();
  }, [session?.status, sessionId]);

  useEffect(() => {
    if (showActivity && activityEndRef.current) {
      activityEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activityLog, showActivity]);

  useEffect(() => {
    if (!session || (session.status !== "pending" && session.status !== "running")) return;
    const interval = setInterval(() => {
      setQuipIndex((prev) => {
        let next = prev;
        while (next === prev) next = Math.floor(Math.random() * REVIEW_QUIPS.length);
        return next;
      });
    }, 3500);
    return () => clearInterval(interval);
  }, [session?.status]);

  const startLearningPoll = useCallback(() => {
    if (learningPollRef.current) clearInterval(learningPollRef.current);
    learningPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/learn/status?sessionId=${sessionId}`);
        const data = await res.json();
        if (!data.isLearning) {
          if (learningPollRef.current) clearInterval(learningPollRef.current);
          learningPollRef.current = null;
          setIsLearningActive(false);
          setLearningStatus("");
        }
      } catch { /* ignore */ }
    }, 2000);
  }, [sessionId]);

  const fetchLearningState = useCallback(async () => {
    try {
      const res = await fetch(`/api/learn/status?sessionId=${sessionId}`);
      const data = await res.json();
      setLearningState({
        hasRatings: data.hasRatings,
        hasLearnings: data.hasLearnings,
        needsLearning: data.needsLearning,
      });
      return data;
    } catch { return null; }
  }, [sessionId]);

  useEffect(() => {
    const checkLearningStatus = async () => {
      const data = await fetchLearningState();
      if (data?.isLearning) {
        setIsLearningActive(true);
        setLearningStatus("Learning from your feedback...");
        startLearningPoll();
      }
    };
    checkLearningStatus();
    return () => {
      if (learningPollRef.current) clearInterval(learningPollRef.current);
    };
  }, [sessionId, startLearningPoll, fetchLearningState]);

  const handleRate = async (itemId: number, rating: 1 | -1) => {
    try {
      await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewItemId: itemId, rating }),
      });
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                rating: {
                  id: 0,
                  review_item_id: itemId,
                  rating,
                  comment: null,
                  created_at: new Date().toISOString(),
                },
              }
            : item
        )
      );

      fetchLearningState();
    } catch {
      // silently fail — rating will be retried on next interaction
    }
  };

  const handleAddComment = async (itemId: number, text: string) => {
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewItemId: itemId, text }),
      });
      const { comment } = await res.json();
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, comments: [...item.comments, comment] }
            : item
        )
      );
    } catch {
      // silently fail
    }
  };

  const handleDeleteComment = async (itemId: number, commentId: number) => {
    try {
      await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, comments: item.comments.filter((c) => c.id !== commentId) }
            : item
        )
      );
    } catch {
      // silently fail
    }
  };

  const handleToggleViewed = async (itemId: number, viewed: boolean) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, viewed } : item
      )
    );
    try {
      await fetch(`/api/review-items/${itemId}/viewed`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewed }),
      });
    } catch {
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, viewed: !viewed } : item
        )
      );
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await fetch(`/api/reviews/${sessionId}/cancel`, { method: "POST" });
    } catch {
      setCancelling(false);
    }
  };

  const handlePRCommentPosted = (itemId: number, prComment: PRComment) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, prComment } : item
      )
    );
  };

  const triggerLearning = async () => {
    setIsLearningActive(true);
    setLearningStatus("Learning from your feedback...");
    try {
      const res = await fetch("/api/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: parseInt(sessionId) }),
      });
      if (res.status === 409) {
        startLearningPoll();
        return;
      }
      const data = await res.json();
      const parts: string[] = [];
      if (data.rulesCreated > 0) parts.push(`Created ${data.rulesCreated} new rule(s)`);
      if (data.rulesMerged > 0) parts.push(`merged ${data.rulesMerged} similar rules`);
      if (parts.length > 0) {
        setLearningStatus(parts.join(", "));
      } else {
        setLearningStatus(data.message || "");
      }
      await fetchLearningState();
      setTimeout(() => setLearningStatus(""), 5000);
    } catch {
      setLearningStatus("");
    }
    setIsLearningActive(false);
  };

  const filteredItems = items.filter((item) => {
    if (filterSeverity !== "all" && item.severity !== filterSeverity) return false;
    if (filterRating === "rated" && !item.rating) return false;
    if (filterRating === "unrated" && item.rating) return false;
    if (filterViewed === "viewed" && !item.viewed) return false;
    if (filterViewed === "unviewed" && item.viewed) return false;
    return true;
  });

  const ratedCount = items.filter((i) => i.rating).length;
  const thumbsUp = items.filter((i) => i.rating?.rating === 1).length;
  const thumbsDown = items.filter((i) => i.rating?.rating === -1).length;
  const viewedCount = items.filter((i) => i.viewed).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-8 text-center text-[var(--muted)]">Session not found</div>
    );
  }

  const isRunning = session.status === "pending" || session.status === "running";

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <GitBranch className="w-5 h-5 text-[var(--muted)]" />
            <h1 className="text-xl font-bold font-mono">{session.branch}</h1>
            <span className="text-sm text-[var(--muted)]">vs {session.base_branch}</span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                session.status === "completed"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : session.status === "failed"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : session.status === "cancelled"
                      ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
              }`}
            >
              {session.status}
            </span>
            {prLoading ? (
              <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
                <Loader2 className="w-3 h-3 animate-spin" />
                Checking PR...
              </span>
            ) : prInfo ? (
              <a
                href={prInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
              >
                PR #{prInfo.number}
              </a>
            ) : (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500">
                No PR
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--muted)]">
            {session.repo_path}
          </p>
        </div>

        {/* Error message for failed reviews */}
        {session.status === "failed" && session.error_message && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">
            {session.error_message}
          </div>
        )}

        {/* Progress bar during review */}
        {isRunning && (
          <div className="mb-6 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
              <span className="text-sm flex-1">{status || "Preparing review..."}</span>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
              >
                <Square className="w-3 h-3" />
                {cancelling ? "Stopping..." : "Stop"}
              </button>
            </div>
            {progress.chunksTotal > 0 && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-[var(--accent)] h-2 rounded-full transition-all"
                  style={{
                    width: `${(progress.chunksCompleted / progress.chunksTotal) * 100}%`,
                  }}
                />
              </div>
            )}
            <p className="text-xs text-[var(--muted)] mt-1">
              {progress.chunksCompleted}/{progress.chunksTotal} chunks | {progress.itemsFound} findings so far
            </p>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs italic text-[var(--muted)] transition-opacity duration-300">
                {REVIEW_QUIPS[quipIndex]}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowActivity(!showActivity)}
                  className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <Terminal className="w-3 h-3" />
                  {showActivity ? "Hide" : "Show"} activity
                </button>
                <button
                  onClick={() => setShowGame(!showGame)}
                  className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <Gamepad2 className="w-3 h-3" />
                  {showGame ? "Hide" : "Play"} game
                </button>
              </div>
            </div>
            {showActivity && (
              <div className="mt-2 bg-gray-900 rounded-md p-3 max-h-48 overflow-y-auto font-mono text-xs">
                {activityLog.length === 0 ? (
                  <div className="text-gray-500 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Waiting for Claude to start...
                  </div>
                ) : (
                  activityLog.map((entry, i) => (
                    <div key={i} className="flex gap-2 py-0.5">
                      <span className="text-blue-400 shrink-0 w-12">{entry.tool}</span>
                      <span className="text-gray-300 truncate">{entry.input}</span>
                    </div>
                  ))
                )}
                <div ref={activityEndRef} />
              </div>
            )}
          </div>
        )}

        {isRunning && showGame && <GoblinRunner />}

        {/* Learning notification */}
        {learningStatus && (
          <div className="mb-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300">
            <Brain className="w-4 h-4" />
            {learningStatus}
          </div>
        )}

        {/* Filters */}
        {items.length > 0 && !isRunning && (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Filter className="w-4 h-4 text-[var(--muted)]" />
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as FilterSeverity)}
              className="px-2 py-1 text-xs border rounded bg-[var(--card-bg)] border-[var(--card-border)]"
            >
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="blocking">Blocking</option>
              <option value="suggestion">Suggestion</option>
              <option value="nit">Nit</option>
            </select>
            <select
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value as FilterRating)}
              className="px-2 py-1 text-xs border rounded bg-[var(--card-bg)] border-[var(--card-border)]"
            >
              <option value="all">All ratings</option>
              <option value="rated">Rated</option>
              <option value="unrated">Unrated</option>
            </select>
            <select
              value={filterViewed}
              onChange={(e) => setFilterViewed(e.target.value as FilterViewed)}
              className="px-2 py-1 text-xs border rounded bg-[var(--card-bg)] border-[var(--card-border)]"
            >
              <option value="all">All items</option>
              <option value="viewed">Viewed</option>
              <option value="unviewed">Unviewed</option>
            </select>
            <span className="text-xs text-[var(--muted)]">
              {filteredItems.length} of {items.length} items
            </span>
          </div>
        )}

        {/* Review items */}
        <div>
          {filteredItems.map((item) => (
            <ReviewItemCard
              key={item.id}
              item={item}
              onRate={handleRate}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
              onToggleViewed={handleToggleViewed}
              prInfo={prInfo}
              repoPath={session.repo_path}
              onPRCommentPosted={handlePRCommentPosted}
            />
          ))}
        </div>

        {items.length === 0 && !isRunning && (
          <div className="text-center text-[var(--muted)] py-12">
            No review findings.
          </div>
        )}
      </div>

      {/* Stats sidebar */}
      {items.length > 0 && (
        <div className="w-56 shrink-0 border-l border-[var(--card-border)] p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold mb-4">Stats</h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-[var(--muted)] text-xs">Total Findings</p>
              <p className="font-semibold text-lg">{items.length}</p>
            </div>
            <div>
              <p className="text-[var(--muted)] text-xs">Rated</p>
              <p className="font-semibold">
                {ratedCount}/{items.length}
              </p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                <div
                  className="bg-[var(--accent)] h-1.5 rounded-full transition-all"
                  style={{
                    width: items.length > 0 ? `${(ratedCount / items.length) * 100}%` : "0%",
                  }}
                />
              </div>
            </div>
            <div>
              <p className="text-[var(--muted)] text-xs">Viewed</p>
              <p className="font-semibold">
                {viewedCount}/{items.length}
              </p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all"
                  style={{
                    width: items.length > 0 ? `${(viewedCount / items.length) * 100}%` : "0%",
                  }}
                />
              </div>
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-[var(--muted)] text-xs">Good</p>
                <p className="font-semibold text-green-600 dark:text-green-400">{thumbsUp}</p>
              </div>
              <div>
                <p className="text-[var(--muted)] text-xs">Bad</p>
                <p className="font-semibold text-red-600 dark:text-red-400">{thumbsDown}</p>
              </div>
            </div>
            <div>
              <p className="text-[var(--muted)] text-xs">By Severity</p>
              <div className="space-y-1 mt-1">
                {["critical", "blocking", "suggestion", "nit"].map((sev) => {
                  const count = items.filter((i) => i.severity === sev).length;
                  if (count === 0) return null;
                  return (
                    <div key={sev} className="flex justify-between text-xs">
                      <span className="capitalize">{sev}</span>
                      <span className="font-mono">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {ratedCount >= 1 && (() => {
            const isUpToDate = learningState?.hasLearnings && !learningState?.needsLearning;
            const buttonText = isLearningActive
              ? "Learning..."
              : isUpToDate
                ? "Knowledge up to date"
                : learningState?.hasLearnings
                  ? "Re-learn from Ratings"
                  : "Learn from Ratings";
            return (
              <button
                onClick={triggerLearning}
                disabled={isLearningActive || !!isUpToDate}
                className={`mt-6 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isUpToDate
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50"
                }`}
              >
                {isLearningActive ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isUpToDate ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Brain className="w-3.5 h-3.5" />
                )}
                {buttonText}
              </button>
            );
          })()}
        </div>
      )}
    </div>
  );
}
