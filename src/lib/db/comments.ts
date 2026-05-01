import { getDb } from "./connection";
import type { Comment } from "../types";

export function addComment(reviewItemId: number, text: string): Comment {
  const db = getDb();
  const result = db
    .prepare("INSERT INTO comments (review_item_id, text) VALUES (?, ?)")
    .run(reviewItemId, text);

  return db
    .prepare("SELECT * FROM comments WHERE id = ?")
    .get(result.lastInsertRowid) as Comment;
}

export function getItemComments(reviewItemId: number): Comment[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM comments WHERE review_item_id = ? ORDER BY created_at ASC")
    .all(reviewItemId) as Comment[];
}

export function deleteComment(commentId: number): void {
  const db = getDb();
  db.prepare("DELETE FROM comments WHERE id = ?").run(commentId);
}

export function getSessionComments(sessionId: number): Map<number, Comment[]> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.* FROM comments c
       JOIN review_items ri ON c.review_item_id = ri.id
       WHERE ri.session_id = ?
       ORDER BY c.created_at ASC`
    )
    .all(sessionId) as Comment[];

  const grouped = new Map<number, Comment[]>();
  for (const c of rows) {
    const list = grouped.get(c.review_item_id) || [];
    list.push(c);
    grouped.set(c.review_item_id, list);
  }
  return grouped;
}
