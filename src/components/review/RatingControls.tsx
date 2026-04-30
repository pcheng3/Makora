"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";

interface RatingControlsProps {
  reviewItemId: number;
  currentRating?: 1 | -1 | null;
  currentComment?: string | null;
  onRate: (rating: 1 | -1, comment?: string) => void;
}

export default function RatingControls({
  reviewItemId,
  currentRating,
  currentComment,
  onRate,
}: RatingControlsProps) {
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState(currentComment || "");
  const [rating, setRating] = useState<1 | -1 | null>(currentRating ?? null);

  const handleRate = (value: 1 | -1) => {
    setRating(value);
    setShowComment(true);
    onRate(value, comment || undefined);
  };

  const handleCommentSubmit = () => {
    if (rating !== null) {
      onRate(rating, comment || undefined);
    }
    setShowComment(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleRate(1)}
          className={`p-2 rounded-md transition-colors ${
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
          className={`p-2 rounded-md transition-colors ${
            rating === -1
              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              : "hover:bg-gray-100 text-gray-400 dark:hover:bg-gray-800"
          }`}
          title="Unhelpful review"
        >
          <ThumbsDown className="w-4 h-4" />
        </button>
        {rating !== null && !showComment && (
          <button
            onClick={() => setShowComment(true)}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-400 dark:hover:bg-gray-800"
            title="Add comment"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        )}
      </div>
      {showComment && (
        <div className="flex gap-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Why is this good/bad? (optional)"
            className="flex-1 px-3 py-1.5 text-sm border rounded-md bg-[var(--card-bg)] border-[var(--card-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCommentSubmit();
            }}
          />
          <button
            onClick={handleCommentSubmit}
            className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)]"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
