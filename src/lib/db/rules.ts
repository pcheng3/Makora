import { getDb } from "./connection";
import type { Rule } from "../types";

export function getEnabledRules(): Rule[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM rules WHERE enabled = 1 ORDER BY confidence DESC")
    .all() as Rule[];
}

export function getAllRules(): Rule[] {
  const db = getDb();
  return db.prepare("SELECT * FROM rules ORDER BY created_at DESC").all() as Rule[];
}

export function insertRule(data: {
  rule_type: "do" | "avoid";
  category?: string;
  title: string;
  description: string;
  source_type?: "learned" | "manual" | "imported";
  confidence?: number;
  file_extensions?: string;
}): number {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO rules (rule_type, category, title, description, source_type, confidence, file_extensions)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.rule_type,
      data.category ?? null,
      data.title,
      data.description,
      data.source_type ?? "manual",
      data.confidence ?? 0.5,
      data.file_extensions ?? null
    );
  return result.lastInsertRowid as number;
}

export function updateRule(
  id: number,
  data: Partial<{
    title: string;
    description: string;
    enabled: boolean;
    confidence: number;
  }>
) {
  const db = getDb();
  const updates: string[] = [];
  const values: unknown[] = [];

  if (data.title !== undefined) {
    updates.push("title = ?");
    values.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    values.push(data.description);
  }
  if (data.enabled !== undefined) {
    updates.push("enabled = ?");
    values.push(data.enabled ? 1 : 0);
  }
  if (data.confidence !== undefined) {
    updates.push("confidence = ?");
    values.push(data.confidence);
  }

  if (updates.length === 0) return;

  updates.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE rules SET ${updates.join(", ")} WHERE id = ?`).run(
    ...values
  );
}

export function getRelevantRules(
  fileExtensions: string[],
  maxRules = 30
): Rule[] {
  const allEnabled = getEnabledRules();
  const extSet = new Set(fileExtensions.map((e) => e.toLowerCase()));

  const scored = allEnabled.map((rule) => {
    if (rule.source_type === "manual") {
      return { rule, score: 1.0 };
    }

    let extMatch = 1.0;
    if (rule.file_extensions) {
      try {
        const ruleExts: string[] = JSON.parse(rule.file_extensions);
        extMatch = ruleExts.some((e) => extSet.has(e.toLowerCase())) ? 1.0 : 0.0;
      } catch {
        extMatch = 1.0;
      }
    }

    const conf = rule.confidence;
    const usage = Math.min(Math.log2(rule.times_applied + 1) / 5, 1.0);
    const score = extMatch * 0.4 + conf * 0.4 + usage * 0.2;
    return { rule, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxRules).map((s) => s.rule);
}

export function deleteRule(id: number) {
  const db = getDb();
  db.prepare("DELETE FROM rules WHERE id = ?").run(id);
}

export function linkRatingsToRule(ruleId: number, ratingIds: number[]) {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO rule_source_ratings (rule_id, rating_id) VALUES (?, ?)"
  );
  for (const ratingId of ratingIds) {
    stmt.run(ruleId, ratingId);
  }
}

export function incrementTimesApplied(ruleIds: number[]) {
  const db = getDb();
  const stmt = db.prepare(
    "UPDATE rules SET times_applied = times_applied + 1 WHERE id = ?"
  );
  for (const id of ruleIds) {
    stmt.run(id);
  }
}
