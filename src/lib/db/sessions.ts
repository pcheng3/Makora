import { getDb } from "./connection";
import type { Session, SessionWithStats } from "../types";

export function createSession(data: {
  repo_path: string;
  branch: string;
  base_branch: string;
  commit_hash?: string;
  provider?: string;
}): number {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO sessions (repo_path, branch, base_branch, commit_hash, provider)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      data.repo_path,
      data.branch,
      data.base_branch,
      data.commit_hash ?? null,
      data.provider ?? "claude"
    );
  return result.lastInsertRowid as number;
}

export function getSession(id: number): Session | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as
    | Session
    | undefined;
}

export function listSessions(
  limit = 20,
  offset = 0
): SessionWithStats[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT s.*,
        (SELECT COUNT(*) FROM review_items WHERE session_id = s.id) as total_items,
        (SELECT COUNT(*) FROM ratings r JOIN review_items ri ON r.review_item_id = ri.id WHERE ri.session_id = s.id) as rated_items,
        (SELECT COUNT(*) FROM ratings r JOIN review_items ri ON r.review_item_id = ri.id WHERE ri.session_id = s.id AND r.rating = 1) as thumbs_up,
        (SELECT COUNT(*) FROM ratings r JOIN review_items ri ON r.review_item_id = ri.id WHERE ri.session_id = s.id AND r.rating = -1) as thumbs_down
       FROM sessions s
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as SessionWithStats[];
}

export function updateSessionStatus(
  id: number,
  status: Session["status"],
  errorMessage?: string
) {
  const db = getDb();
  const now = new Date().toISOString();
  if (status === "running") {
    db.prepare("UPDATE sessions SET status = ?, started_at = ? WHERE id = ?").run(
      status,
      now,
      id
    );
  } else if (status === "completed" || status === "failed" || status === "cancelled") {
    db.prepare(
      "UPDATE sessions SET status = ?, completed_at = ?, error_message = ? WHERE id = ?"
    ).run(status, now, errorMessage ?? null, id);
  } else {
    db.prepare("UPDATE sessions SET status = ? WHERE id = ?").run(status, id);
  }
}

export function updateSessionChunks(
  id: number,
  chunkCount: number,
  chunksDone: number
) {
  const db = getDb();
  db.prepare(
    "UPDATE sessions SET chunk_count = ?, chunks_done = ? WHERE id = ?"
  ).run(chunkCount, chunksDone, id);
}

export function getDistinctRepos(): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT repo_path, MAX(created_at) as last_used FROM sessions GROUP BY repo_path ORDER BY last_used DESC"
    )
    .all() as { repo_path: string }[];
  return rows.map((r) => r.repo_path);
}

export function updateSessionDiffStats(id: number, diffStats: string) {
  const db = getDb();
  db.prepare("UPDATE sessions SET diff_stats = ? WHERE id = ?").run(
    diffStats,
    id
  );
}
