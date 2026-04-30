"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, ThumbsUp, ThumbsDown, RefreshCw } from "lucide-react";
import type { SessionWithStats } from "@/lib/types";

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reviews?limit=50")
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
      <h1 className="text-2xl font-bold mb-6">Review History</h1>

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
              <button
                key={s.id}
                onClick={() => router.push(`/review/${s.id}`)}
                className="w-full text-left bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-4 hover:border-[var(--accent)]/50 transition-colors"
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
            );
          })}
        </div>
      )}
    </div>
  );
}
