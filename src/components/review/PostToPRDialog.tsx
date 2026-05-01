"use client";

import { useState } from "react";
import { Loader2, ExternalLink, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import type { ReviewItemWithRating, PRComment } from "@/lib/types";
import { formatReviewItemAsComment } from "@/lib/github/format";

interface PostToPRDialogProps {
  item: ReviewItemWithRating;
  prNumber: number;
  commitId: string;
  repoPath: string;
  onClose: () => void;
  onPosted: (prComment: PRComment) => void;
}

export default function PostToPRDialog({
  item,
  prNumber,
  commitId,
  repoPath,
  onClose,
  onPosted,
}: PostToPRDialogProps) {
  const [body, setBody] = useState(() => formatReviewItemAsComment(item));
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");

  const handlePost = async () => {
    setPosting(true);
    setError(null);

    try {
      const res = await fetch("/api/github/post-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewItemId: item.id,
          repoPath,
          prNumber,
          commitId,
          body,
          filePath: item.file_path,
          lineStart: item.line_start,
          lineEnd: item.line_end,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to post comment");
        return;
      }

      setSuccess(true);
      onPosted(data.prComment);
      setTimeout(onClose, 1500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  if (success) {
    return (
      <div className="mt-3 border border-green-300 dark:border-green-700 rounded-lg p-4 bg-green-50 dark:bg-green-900/20">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-medium">
          <Check className="w-4 h-4" />
          Comment posted to PR #{prNumber}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 border border-[var(--card-border)] rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-[var(--card-bg)] border-b border-[var(--card-border)] flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--muted)]">
          Post to PR #{prNumber}
          {item.file_path ? " (file comment)" : " (general comment)"}
        </span>
        <div className="flex rounded-md border border-[var(--card-border)] overflow-hidden">
          <button
            onClick={() => setActiveTab("write")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === "write"
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--card-bg)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            Write
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`px-3 py-1 text-xs font-medium border-l border-[var(--card-border)] transition-colors ${
              activeTab === "preview"
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--card-bg)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      <div className="p-2">
        {activeTab === "write" ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 text-sm font-mono border rounded-md bg-[var(--card-bg)] border-[var(--card-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 resize-y"
          />
        ) : (
          <div className="px-3 py-2 min-h-[15rem] border rounded-md bg-[var(--card-bg)] border-[var(--card-border)] overflow-y-auto prose prose-sm dark:prose-invert max-w-none
            prose-headings:mt-3 prose-headings:mb-1.5
            prose-p:my-1.5 prose-p:leading-relaxed
            prose-pre:my-2 prose-pre:rounded-md prose-pre:text-xs
            prose-code:text-xs prose-code:px-1 prose-code:py-0.5 prose-code:rounded
            prose-hr:my-3
            prose-strong:font-semibold
            [&_details]:my-3 [&_details]:border [&_details]:border-[var(--card-border)] [&_details]:rounded-md [&_details]:overflow-hidden
            [&_summary]:cursor-pointer [&_summary]:px-3 [&_summary]:py-2 [&_summary]:text-xs [&_summary]:font-medium [&_summary]:bg-gray-50 [&_summary]:dark:bg-gray-800/50 [&_summary]:select-none
            [&_details>pre]:m-0 [&_details>pre]:rounded-none [&_details>pre]:border-t [&_details>pre]:border-[var(--card-border)]
            [&_details[open]>summary]:border-b [&_details[open]>summary]:border-[var(--card-border)]
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{body}</ReactMarkdown>
          </div>
        )}

        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex items-center justify-end gap-2 mt-2">
          <button
            onClick={onClose}
            disabled={posting}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--card-border)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePost}
            disabled={posting || !body.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {posting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <ExternalLink className="w-3 h-3" />
                Post to PR
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
