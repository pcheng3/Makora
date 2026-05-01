import { getDb } from "./connection";
import type { Rating, FewShotExample } from "../types";

export function upsertRating(data: {
  review_item_id: number;
  rating: 1 | -1;
  comment?: string | null;
}): Rating {
  const db = getDb();
  db.prepare(
    `INSERT INTO ratings (review_item_id, rating, comment)
     VALUES (?, ?, ?)
     ON CONFLICT(review_item_id) DO UPDATE SET
       rating = excluded.rating,
       comment = excluded.comment,
       created_at = datetime('now')`
  ).run(data.review_item_id, data.rating, data.comment ?? null);

  return db
    .prepare("SELECT * FROM ratings WHERE review_item_id = ?")
    .get(data.review_item_id) as Rating;
}

export function getUnprocessedRatings(sessionId?: number) {
  const db = getDb();
  const unprocessedCondition = `(
    r.id NOT IN (SELECT rating_id FROM rule_source_ratings)
    OR EXISTS (
      SELECT 1 FROM rule_source_ratings rsr
      WHERE rsr.rating_id = r.id
        AND (rsr.learned_rating != r.rating
             OR COALESCE(rsr.learned_comment, '') != COALESCE(r.comment, ''))
    )
  )`;

  const commentsSubquery = `(SELECT GROUP_CONCAT(c.text, '\n') FROM comments c WHERE c.review_item_id = r.review_item_id ORDER BY c.created_at ASC)`;

  if (sessionId !== undefined) {
    return db
      .prepare(
        `SELECT r.*, ri.category, ri.severity, ri.title as item_title, ri.description as item_description,
                ri.code_snippet as item_code_snippet, ri.file_path as item_file_path, ri.proposed_fix as item_proposed_fix,
                ${commentsSubquery} as all_comments
         FROM ratings r
         JOIN review_items ri ON r.review_item_id = ri.id
         WHERE ${unprocessedCondition}
           AND ri.session_id = ?`
      )
      .all(sessionId);
  }
  return db
    .prepare(
      `SELECT r.*, ri.category, ri.severity, ri.title as item_title, ri.description as item_description,
              ri.code_snippet as item_code_snippet, ri.file_path as item_file_path, ri.proposed_fix as item_proposed_fix,
              ${commentsSubquery} as all_comments
       FROM ratings r
       JOIN review_items ri ON r.review_item_id = ri.id
       WHERE ${unprocessedCondition}`
    )
    .all();
}

export function getFewShotExamples(
  fileExtensions: string[],
  limit = 4
): FewShotExample[] {
  const db = getDb();
  const extLikes = fileExtensions.map((e) => `%${e.toLowerCase()}`);

  function fetchByRating(ratingVal: 1 | -1, max: number): FewShotExample[] {
    const extCase =
      extLikes.length > 0
        ? `CASE WHEN ${extLikes.map(() => "LOWER(ri.file_path) LIKE ?").join(" OR ")} THEN 0 ELSE 1 END`
        : "0";

    const commentsSubquery = `(SELECT GROUP_CONCAT(c.text, '\n') FROM comments c WHERE c.review_item_id = rat.review_item_id ORDER BY c.created_at ASC)`;
    const hasCommentsCheck = `(EXISTS(SELECT 1 FROM comments c WHERE c.review_item_id = rat.review_item_id))`;

    const sql = `
      SELECT
        rat.rating, ${commentsSubquery} as comment,
        ri.category, ri.severity, ri.title,
        ri.file_path, ri.code_snippet, ri.description, ri.proposed_fix
      FROM ratings rat
      JOIN review_items ri ON rat.review_item_id = ri.id
      WHERE rat.rating = ?
      ORDER BY
        CASE WHEN ${hasCommentsCheck} THEN 0 ELSE 1 END,
        CASE WHEN ri.category != 'positive' THEN 0 ELSE 1 END,
        ${extCase},
        rat.created_at DESC
      LIMIT ?`;

    const params: unknown[] = [ratingVal, ...extLikes, max];
    return db.prepare(sql).all(...params) as FewShotExample[];
  }

  const targetPerSide = Math.floor(limit / 2);
  let negatives = fetchByRating(-1, targetPerSide);
  let positives = fetchByRating(1, targetPerSide);

  if (negatives.length < targetPerSide) {
    positives = fetchByRating(1, limit - negatives.length);
  } else if (positives.length < targetPerSide) {
    negatives = fetchByRating(-1, limit - positives.length);
  }

  return [...negatives, ...positives];
}

export function getSessionLearningStatus(sessionId: number): {
  hasRatings: boolean;
  hasLearnings: boolean;
  needsLearning: boolean;
} {
  const db = getDb();
  const result = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM ratings r JOIN review_items ri ON r.review_item_id = ri.id WHERE ri.session_id = ?) as total_ratings,
        (SELECT COUNT(*) FROM rule_source_ratings rsr JOIN ratings r ON rsr.rating_id = r.id JOIN review_items ri ON r.review_item_id = ri.id WHERE ri.session_id = ?) as learned_ratings,
        (SELECT COUNT(*) FROM ratings r JOIN review_items ri ON r.review_item_id = ri.id WHERE ri.session_id = ? AND (
          r.id NOT IN (SELECT rating_id FROM rule_source_ratings)
          OR EXISTS (SELECT 1 FROM rule_source_ratings rsr WHERE rsr.rating_id = r.id AND (rsr.learned_rating != r.rating OR COALESCE(rsr.learned_comment, '') != COALESCE(r.comment, '')))
        )) as unprocessed_ratings`
    )
    .get(sessionId, sessionId, sessionId) as {
    total_ratings: number;
    learned_ratings: number;
    unprocessed_ratings: number;
  };
  return {
    hasRatings: result.total_ratings > 0,
    hasLearnings: result.learned_ratings > 0,
    needsLearning: result.unprocessed_ratings > 0,
  };
}

export function getSessionRatingCount(sessionId: number): number {
  const db = getDb();
  const result = db
    .prepare(
      `SELECT COUNT(*) as count FROM ratings r
       JOIN review_items ri ON r.review_item_id = ri.id
       WHERE ri.session_id = ?`
    )
    .get(sessionId) as { count: number };
  return result.count;
}
