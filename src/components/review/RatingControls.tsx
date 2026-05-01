"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare, X } from "lucide-react";
import type { Comment } from "@/lib/types";

interface RatingButtonsProps {
  currentRating?: 1 | -1 | null;
  commentCount: number;
  showComments: boolean;
  onToggleComments: () => void;
  onRate: (rating: 1 | -1) => void;
}

export default function RatingButtons({
  currentRating,
  commentCount,
  showComments,
  onToggleComments,
  onRate,
}: RatingButtonsProps) {
  const [rating, setRating] = useState<1 | -1 | null>(currentRating ?? null);

  const handleRate = (value: 1 | -1) => {
    setRating(value);
    onRate(value);
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => handleRate(1)}
        className={`p-1.5 rounded-md transition-colors ${
          rating === 1
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "hover:bg-gray-100 text-gray-400 dark:hover:bg-gray-800"
        }`}
        title="Helpful review"
      >
        <ThumbsUp className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleRate(-1)}
        className={`p-1.5 rounded-md transition-colors ${
          rating === -1
            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            : "hover:bg-gray-100 text-gray-400 dark:hover:bg-gray-800"
        }`}
        title="Unhelpful review"
      >
        <ThumbsDown className="w-4 h-4" />
      </button>
      <button
        onClick={onToggleComments}
        className={`flex items-center gap-1 p-1.5 rounded-md transition-colors ${
          showComments
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            : commentCount > 0
              ? "text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
        title={`${commentCount} comment${commentCount !== 1 ? "s" : ""}`}
      >
        <MessageSquare className="w-4 h-4" />
        {commentCount > 0 && (
          <span className="text-xs font-medium min-w-[1ch]">{commentCount}</span>
        )}
      </button>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + "Z").getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface CommentPanelProps {
  comments: Comment[];
  onAddComment: (text: string) => void;
  onDeleteComment: (commentId: number) => void;
}

export function CommentPanel({ comments, onAddComment, onDeleteComment }: CommentPanelProps) {
  const [newComment, setNewComment] = useState("");

  const handleAddComment = () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;
    onAddComment(trimmed);
    setNewComment("");
  };

  return (
    <div className="mt-3 border border-[var(--card-border)] rounded-lg overflow-hidden">
      {comments.length > 0 && (
        <div className="divide-y divide-[var(--card-border)]">
          {comments.map((c) => (
            <div
              key={c.id}
              className="px-3 py-2 text-sm group flex items-start gap-2"
            >
              <p className="flex-1 whitespace-pre-wrap break-words">{c.text}</p>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-[var(--muted)]">
                  {formatRelativeTime(c.created_at)}
                </span>
                <button
                  onClick={() => onDeleteComment(c.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-red-500 transition-all"
                  title="Delete comment"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-2 bg-[var(--card-bg)]">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={2}
          className="w-full px-3 py-2 text-sm border rounded-md bg-[var(--card-bg)] border-[var(--card-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 resize-y"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleAddComment();
            }
          }}
        />
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-[var(--muted)]">
            {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+Enter to submit
          </span>
          <button
            onClick={handleAddComment}
            disabled={!newComment.trim()}
            className="px-3 py-1 text-xs font-medium bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
