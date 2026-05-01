"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, ThumbsUp, ThumbsDown, Trash2 } from "lucide-react";
import type { SessionWithStats } from "@/lib/types";

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  useEffect(() => {
    fetch("/api/reviews?limit=50")
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const deleteOne = async (id: number) => {
    await fetch(`/api/reviews?id=${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const deleteAll = async () => {
    await fetch("/api/reviews?id=all", { method: "DELETE" });
    setSessions([]);
    setConfirmDeleteAll(false);
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Review History</h1>
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Review History</h1>
        {sessions.length > 0 && (
          <div className="flex items-center gap-2">
            {confirmDeleteAll ? (
              <>
                <span className="text-xs text-[var(--danger)]">Delete all {sessions.length} sessions?</span>
                <button
                  onClick={deleteAll}
                  className="px-3 py-1.5 text-xs bg-[var(--danger)] text-white rounded-md hover:opacity-90 cursor-pointer"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDeleteAll(false)}
                  className="px-3 py-1.5 text-xs border border-[var(--card-border)] rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-[var(--danger)] border border-[var(--card-border)] rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Delete All
              </button>
            )}
          </div>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="text-[var(--muted)]">No reviews yet. Start one from the home page.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const accuracy =
              s.rated_items > 0
                ? Math.round((s.thumbs_up / s.rated_items) * 100)
                : null;

            return (
              <div
                key={s.id}
                className="flex items-stretch bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg hover:border-[var(--accent)]/50 transition-colors"
              >
                <button
                  onClick={() => router.push(`/review/${s.id}`)}
                  className="flex-1 text-left p-4 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-[var(--muted)]" />
                      <span className="font-mono font-semibold text-sm">{s.branch}</span>
                      <span className="text-xs text-[var(--muted)]">vs {s.base_branch}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        s.status === "completed"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : s.status === "failed"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
                    <span>{s.repo_path.split("/").pop()}</span>
                    <span>{s.total_items} findings</span>
                    <span>
                      {s.rated_items}/{s.total_items} rated
                    </span>
                    {s.rated_items > 0 && (
                      <>
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <ThumbsUp className="w-3 h-3" /> {s.thumbs_up}
                        </span>
                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                          <ThumbsDown className="w-3 h-3" /> {s.thumbs_down}
                        </span>
                        {accuracy !== null && (
                          <span className="font-medium">
                            {accuracy}% useful
                          </span>
                        )}
                      </>
                    )}
                    <span className="ml-auto">
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteOne(s.id);
                  }}
                  className="px-3 flex items-center text-[var(--muted)] hover:text-[var(--danger)] transition-colors border-l border-[var(--card-border)] cursor-pointer"
                  title="Delete this review"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
