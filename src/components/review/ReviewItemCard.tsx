"use client";

import { useState } from "react";
import { FileCode, ChevronDown, ChevronRight } from "lucide-react";
import SeverityBadge from "./SeverityBadge";
import RatingControls from "./RatingControls";
import DiffSnippet from "./DiffSnippet";
import type { ReviewItemWithRating } from "@/lib/types";

interface ReviewItemCardProps {
  item: ReviewItemWithRating;
  onRate: (itemId: number, rating: 1 | -1, comment?: string) => void;
}

export default function ReviewItemCard({ item, onRate }: ReviewItemCardProps) {
  const [showFix, setShowFix] = useState(false);

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

  return (
    <div
      className={`bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-4 mb-3 border-l-4 ${borderColor}`}
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

        <RatingControls
          reviewItemId={item.id}
          currentRating={ratingValue as 1 | -1 | null}
          currentComment={item.rating?.comment}
          onRate={(rating, comment) => onRate(item.id, rating, comment)}
        />
      </div>

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
