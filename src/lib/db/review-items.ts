import { getDb } from "./connection";
import type { ReviewItem, ReviewItemWithRating, AIReviewItem, Comment } from "../types";
import { getSessionComments } from "./comments";

export function insertReviewItem(
  sessionId: number,
  chunkIndex: number,
  item: AIReviewItem
): number {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO review_items (session_id, chunk_index, category, severity, title, file_path, line_start, line_end, code_snippet, description, proposed_fix, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      sessionId,
      chunkIndex,
      item.category,
      item.severity ?? null,
      item.title,
      item.file_path ?? null,
      item.line_start ?? null,
      item.line_end ?? null,
      item.code_snippet ?? null,
      item.description,
      item.proposed_fix ?? null,
      JSON.stringify(item)
    );
  return result.lastInsertRowid as number;
}

export function getSessionItems(
  sessionId: number
): ReviewItemWithRating[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT ri.*,
        r.id as rating_id, r.rating as rating_value, r.comment as rating_comment, r.created_at as rating_created_at
       FROM review_items ri
       LEFT JOIN ratings r ON r.review_item_id = ri.id
       WHERE ri.session_id = ?
       ORDER BY ri.id ASC`
    )
    .all(sessionId) as Record<string, unknown>[];
  const commentsByItem = getSessionComments(sessionId);

  return rows.map((row) => ({
      id: row.id as number,
      session_id: row.session_id as number,
      chunk_index: row.chunk_index as number,
      category: row.category as ReviewItem["category"],
      severity: row.severity as ReviewItem["severity"],
      title: row.title as string,
      file_path: row.file_path as string | null,
      line_start: row.line_start as number | null,
      line_end: row.line_end as number | null,
      code_snippet: row.code_snippet as string | null,
      description: row.description as string,
      proposed_fix: row.proposed_fix as string | null,
      raw_json: row.raw_json as string | null,
      viewed: !!(row.viewed as number),
      created_at: row.created_at as string,
      rating: row.rating_id
        ? {
            id: row.rating_id as number,
            review_item_id: row.id as number,
            rating: row.rating_value as 1 | -1,
            comment: row.rating_comment as string | null,
            created_at: row.rating_created_at as string,
          }
        : null,
      comments: commentsByItem.get(row.id as number) || [],
    }));
}

export function setItemViewed(itemId: number, viewed: boolean): void {
  const db = getDb();
  db.prepare("UPDATE review_items SET viewed = ? WHERE id = ?").run(viewed ? 1 : 0, itemId);
}
