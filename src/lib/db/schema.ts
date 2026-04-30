import Database from "better-sqlite3";

export function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_path     TEXT NOT NULL,
      branch        TEXT NOT NULL,
      base_branch   TEXT NOT NULL,
      commit_hash   TEXT,
      provider      TEXT NOT NULL DEFAULT 'claude',
      status        TEXT NOT NULL DEFAULT 'pending',
      diff_stats    TEXT,
      chunk_count   INTEGER DEFAULT 1,
      chunks_done   INTEGER DEFAULT 0,
      error_message TEXT,
      started_at    TEXT,
      completed_at  TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS review_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id    INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      chunk_index   INTEGER DEFAULT 0,
      category      TEXT NOT NULL,
      severity      TEXT,
      title         TEXT NOT NULL,
      file_path     TEXT,
      line_start    INTEGER,
      line_end      INTEGER,
      code_snippet  TEXT,
      description   TEXT NOT NULL,
      proposed_fix  TEXT,
      raw_json      TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_review_items_session ON review_items(session_id);

    CREATE TABLE IF NOT EXISTS ratings (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      review_item_id  INTEGER NOT NULL REFERENCES review_items(id) ON DELETE CASCADE,
      rating          INTEGER NOT NULL,
      comment         TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(review_item_id)
    );

    CREATE INDEX IF NOT EXISTS idx_ratings_review_item ON ratings(review_item_id);

    CREATE TABLE IF NOT EXISTS rules (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_type       TEXT NOT NULL,
      category        TEXT,
      title           TEXT NOT NULL,
      description     TEXT NOT NULL,
      source_type     TEXT NOT NULL DEFAULT 'learned',
      confidence      REAL DEFAULT 0.5,
      times_applied   INTEGER DEFAULT 0,
      enabled         INTEGER DEFAULT 1,
      source_ratings  TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_rules_enabled ON rules(enabled);

    CREATE TABLE IF NOT EXISTS guidance_files (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      filename        TEXT NOT NULL,
      original_name   TEXT NOT NULL,
      description     TEXT,
      file_path       TEXT NOT NULL,
      content_hash    TEXT,
      size_bytes      INTEGER,
      enabled         INTEGER DEFAULT 1,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rule_source_ratings (
      rule_id         INTEGER NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
      rating_id       INTEGER NOT NULL REFERENCES ratings(id) ON DELETE CASCADE,
      PRIMARY KEY (rule_id, rating_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key             TEXT PRIMARY KEY,
      value           TEXT NOT NULL
    );
  `);

  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run(
    "skip_extensions",
    JSON.stringify([".meta", ".prefab", ".asset", ".unity", ".mat", ".lighting"])
  );

  runMigrations(db);
}

function runMigrations(db: Database.Database) {
  const cols = db.pragma("table_info(rules)") as { name: string }[];
  if (!cols.some((c) => c.name === "file_extensions")) {
    db.exec("ALTER TABLE rules ADD COLUMN file_extensions TEXT");
    backfillFileExtensions(db);
  }
}

function backfillFileExtensions(db: Database.Database) {
  const rules = db
    .prepare(
      `SELECT r.id,
              GROUP_CONCAT(DISTINCT ri.file_path) as file_paths
       FROM rules r
       JOIN rule_source_ratings rsr ON rsr.rule_id = r.id
       JOIN ratings rat ON rat.id = rsr.rating_id
       JOIN review_items ri ON ri.id = rat.review_item_id
       WHERE ri.file_path IS NOT NULL
       GROUP BY r.id`
    )
    .all() as { id: number; file_paths: string }[];

  const update = db.prepare("UPDATE rules SET file_extensions = ? WHERE id = ?");
  for (const rule of rules) {
    const exts = new Set<string>();
    for (const fp of rule.file_paths.split(",")) {
      const dot = fp.lastIndexOf(".");
      if (dot > 0) exts.add(fp.slice(dot).toLowerCase());
    }
    if (exts.size > 0) {
      update.run(JSON.stringify([...exts]), rule.id);
    }
  }
}
