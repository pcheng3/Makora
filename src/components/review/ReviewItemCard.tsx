"use client";

import { useState } from "react";
import { FileCode, ChevronDown, ChevronRight, GitPullRequest, ExternalLink, Check } from "lucide-react";
import SeverityBadge from "./SeverityBadge";
import RatingButtons, { CommentPanel } from "./RatingControls";
import DiffSnippet from "./DiffSnippet";
import PostToPRDialog from "./PostToPRDialog";
import type { ReviewItemWithRating, PRComment } from "@/lib/types";

export interface PRInfo {
  number: number;
  url: string;
  commitId: string;
}

interface ReviewItemCardProps {
  item: ReviewItemWithRating;
  onRate: (itemId: number, rating: 1 | -1) => void;
  onAddComment: (itemId: number, text: string) => void;
  onDeleteComment: (itemId: number, commentId: number) => void;
  onToggleViewed: (itemId: number, viewed: boolean) => void;
  prInfo?: PRInfo | null;
  repoPath?: string;
  onPRCommentPosted?: (itemId: number, prComment: PRComment) => void;
}

export default function ReviewItemCard({ item, onRate, onAddComment, onDeleteComment, onToggleViewed, prInfo, repoPath, onPRCommentPosted }: ReviewItemCardProps) {
  const [showFix, setShowFix] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showPostDialog, setShowPostDialog] = useState(false);

  const ratingValue = item.rating?.rating ?? null;
  const borderColor =
    ratingValue === 1
      ? "border-l-green-500"
      : ratingValue === -1
        ? "border-l-red-500"
        : "border-l-gray-300 dark:border-l-gray-600";

  if (item.title === "Review Summary") {
    return (
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-4 mb-3">
        <h3 className="text-sm font-semibold mb-2 text-[var(--muted)]">Summary</h3>
        <p className="text-sm leading-relaxed">{item.description}</p>
      </div>
    );
  }

  const handleRate = (rating: 1 | -1) => {
    onRate(item.id, rating);
    if (item.comments.length === 0 && !showComments) {
      setShowComments(true);
    }
  };

  return (
    <div
      className={`bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-4 mb-3 border-l-4 ${borderColor} transition-opacity ${item.viewed ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <SeverityBadge severity={item.severity} category={item.category} />
            <h3 className="text-sm font-semibold">{item.title}</h3>
          </div>

          {item.file_path && (
            <div className="flex items-center gap-1 text-xs text-[var(--muted)] mb-2">
              <FileCode className="w-3 h-3" />
              <span className="font-mono">
                {item.file_path}
                {item.line_start ? `:${item.line_start}` : ""}
                {item.line_end && item.line_end !== item.line_start
                  ? `-${item.line_end}`
                  : ""}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <label
            className={`flex items-center gap-1.5 cursor-pointer select-none px-2.5 py-1 rounded-full border transition-colors ${
              item.viewed
                ? "border-emerald-400/60 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-900/20"
                : "border-[var(--card-border)] hover:border-gray-400 dark:hover:border-gray-500"
            }`}
          >
            <input
              type="checkbox"
              checked={item.viewed}
              onChange={(e) => onToggleViewed(item.id, e.target.checked)}
              className="w-3.5 h-3.5 rounded-sm border-gray-300 text-emerald-600 focus:ring-emerald-500/50 cursor-pointer"
            />
            <span className={`text-xs font-medium ${
              item.viewed
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-[var(--muted)]"
            }`}>Viewed</span>
          </label>
          <RatingButtons
            currentRating={ratingValue as 1 | -1 | null}
            commentCount={item.comments.length}
            showComments={showComments}
            onToggleComments={() => setShowComments(!showComments)}
            onRate={handleRate}
          />
          {prInfo && (
            item.prComment ? (
              <a
                href={item.prComment.comment_url ?? prInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                title="View comment on GitHub"
              >
                <Check className="w-3 h-3" />
                Posted
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <button
                onClick={() => setShowPostDialog(!showPostDialog)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  showPostDialog
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                    : "text-[var(--muted)] hover:bg-gray-100 dark:hover:bg-gray-800 border border-[var(--card-border)]"
                }`}
                title={`Post to PR #${prInfo.number}`}
              >
                <GitPullRequest className="w-3.5 h-3.5" />
                Post to PR
              </button>
            )
          )}
        </div>
      </div>

      {showComments && (
        <CommentPanel
          comments={item.comments}
          onAddComment={(text) => onAddComment(item.id, text)}
          onDeleteComment={(commentId) => onDeleteComment(item.id, commentId)}
        />
      )}

      {showPostDialog && prInfo && repoPath && onPRCommentPosted && (
        <PostToPRDialog
          item={item}
          prNumber={prInfo.number}
          commitId={prInfo.commitId}
          repoPath={repoPath}
          onClose={() => setShowPostDialog(false)}
          onPosted={(prComment) => onPRCommentPosted(item.id, prComment)}
        />
      )}

      {item.code_snippet && (
        <div className="mt-3">
          <DiffSnippet code={item.code_snippet} />
        </div>
      )}

      <p className="mt-3 text-sm leading-relaxed">{item.description}</p>

      {item.proposed_fix && (
        <div className="mt-3">
          <button
            onClick={() => setShowFix(!showFix)}
            className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"
          >
            {showFix ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            Proposed Fix
          </button>
          {showFix && (
            <div className="mt-2">
              <DiffSnippet code={item.proposed_fix} />
            </div>
          )}
        </div>
      )}

    </div>
  );
}
