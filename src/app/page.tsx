"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Play, Loader2, FolderOpen, Clock, ShieldAlert } from "lucide-react";
import type { SessionWithStats } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [repoPath, setRepoPath] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [branch, setBranch] = useState("");
  const [baseBranch, setBaseBranch] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [error, setError] = useState("");
  const [recentSessions, setRecentSessions] = useState<SessionWithStats[]>([]);
  const [savedRepos, setSavedRepos] = useState<string[]>([]);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [showItarModal, setShowItarModal] = useState(false);

  useEffect(() => {
    fetch("/api/reviews?limit=5")
      .then((r) => r.json())
      .then((data) => {
        setRecentSessions(data.sessions || []);
        setSavedRepos(data.repos || []);
      })
      .catch(() => {});
  }, []);

  const selectRepo = (path: string) => {
    setRepoPath(path);
    setBranches([]);
    setBranch("");
    setBaseBranch("");
    setError("");
    fetchBranches(path);
  };

  const fetchBranches = async (path: string) => {
    if (!path.trim()) return;
    setLoadingBranches(true);
    setError("");
    try {
      const res = await fetch(
        `/api/git/info?repo=${encodeURIComponent(path)}`
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setBranches(data.branches || []);
      setBranch(data.currentBranch || "");
      setBaseBranch(data.defaultBranch || "main");
      setDefaultBranch(data.defaultBranch || "main");
      setRemoteUrl(data.remoteUrl || "");
    } catch {
      setError("Failed to connect to git repository");
    } finally {
      setLoadingBranches(false);
    }
  };

  const doStartReview = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoPath, branch, baseBranch }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }
      router.push(`/review/${data.sessionId}`);
    } catch {
      setError("Failed to start review");
      setLoading(false);
    }
  };

  const startReview = () => {
    if (!repoPath || !branch || !baseBranch) return;
    if (remoteUrl.includes("github-sec.washington.palantircloud.com")) {
      setShowItarModal(true);
      return;
    }
    doStartReview();
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">New Review</h1>

      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Repository Path</label>

          {savedRepos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {savedRepos.map((repo) => (
                <button
                  key={repo}
                  onClick={() => selectRepo(repo)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    repoPath === repo
                      ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                      : "bg-[var(--card-bg)] border-[var(--card-border)] hover:border-[var(--accent)] text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <FolderOpen className="inline w-3 h-3 mr-1 -mt-0.5" />
                  {repo.split("/").slice(-2).join("/")}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input
                type="text"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                onBlur={() => fetchBranches(repoPath)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchBranches(repoPath);
                }}
                placeholder="/path/to/your/repo"
                className="w-full pl-10 pr-3 py-2 border rounded-md bg-[var(--card-bg)] border-[var(--card-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 text-sm"
              />
            </div>
            <button
              onClick={() => fetchBranches(repoPath)}
              disabled={loadingBranches || !repoPath}
              className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {loadingBranches ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Load"
              )}
            </button>
          </div>
        </div>

        {branches.length > 0 && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">
                <GitBranch className="inline w-3.5 h-3.5 mr-1" />
                Branch to Review
              </label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-[var(--card-bg)] border-[var(--card-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 text-sm"
              >
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Base Branch (diff against)
              </label>
              <select
                value={baseBranch}
                onChange={(e) => setBaseBranch(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-[var(--card-bg)] border-[var(--card-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 text-sm"
              >
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b} {b === defaultBranch ? "(default)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={startReview}
              disabled={loading || !branch || !baseBranch || branch === baseBranch}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-50 font-medium text-sm transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting Review...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Review
                </>
              )}
            </button>
          </>
        )}

        {error && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}
      </div>

      {recentSessions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-[var(--muted)] mb-3 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Recent Reviews
          </h2>
          <div className="space-y-2">
            {recentSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/review/${s.id}`)}
                className="w-full text-left bg-[var(--card-bg)] border border-[var(--card-border)] rounded-md p-3 hover:border-[var(--accent)]/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm min-w-0">
                    <GitBranch className="w-3.5 h-3.5 shrink-0 text-[var(--muted)]" />
                    <span className="font-mono font-medium truncate">{s.branch}</span>
                    <span className="text-[var(--muted)] shrink-0">
                      {s.repo_path.split("/").pop()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--muted)] shrink-0">
                    <span
                      className={`px-1.5 py-0.5 rounded whitespace-nowrap ${
                        s.status === "completed"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : s.status === "failed"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}
                    >
                      {s.status}
                    </span>
                    <span>{s.total_items} items</span>
                    <span>
                      {s.rated_items}/{s.total_items} rated
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      {showItarModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold">ITAR Repository Detected</h2>
            </div>
            <p className="text-sm text-[var(--muted)] mb-6">
              This repository is hosted on <span className="font-mono text-[var(--foreground)]">github-sec</span> and
              may contain ITAR-controlled content. Is your Claude Code configured for ITAR mode?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowItarModal(false);
                  setError("Please switch Claude Code to ITAR mode before reviewing this repository.");
                }}
                className="flex-1 px-4 py-2 text-sm border border-[var(--card-border)] rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                No, cancel
              </button>
              <button
                onClick={() => {
                  setShowItarModal(false);
                  doStartReview();
                }}
                className="flex-1 px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] transition-colors font-medium"
              >
                Yes, ITAR mode is active
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
