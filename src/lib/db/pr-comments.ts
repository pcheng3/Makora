import { getDb } from "./connection";
import type { PRComment } from "../types";

export function insertPRComment(
  reviewItemId: number,
  prNumber: number,
  prCommentId: number | null,
  commentUrl: string | null,
  commentBody: string
): PRComment {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO pr_comments (review_item_id, pr_number, pr_comment_id, comment_url, comment_body)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(reviewItemId, prNumber, prCommentId, commentUrl, commentBody);

  return {
    id: result.lastInsertRowid as number,
    review_item_id: reviewItemId,
    pr_number: prNumber,
    pr_comment_id: prCommentId,
    comment_url: commentUrl,
    comment_body: commentBody,
    posted_at: new Date().toISOString(),
  };
}

export function getSessionPRComments(
  sessionId: number
): Map<number, PRComment> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT pc.*
       FROM pr_comments pc
       JOIN review_items ri ON ri.id = pc.review_item_id
       WHERE ri.session_id = ?
       ORDER BY pc.posted_at DESC`
    )
    .all(sessionId) as PRComment[];

  const map = new Map<number, PRComment>();
  for (const row of rows) {
    if (!map.has(row.review_item_id)) {
      map.set(row.review_item_id, row);
    }
  }
  return map;
}
