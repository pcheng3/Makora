import { getUnprocessedRatings } from "../db/ratings";
import { insertRule, linkRatingsToRule, getEnabledRules, updateRule, deleteRule } from "../db/rules";
import { createProvider } from "../ai/provider";
import { getAIProvider } from "../db/settings";
import { RULE_SYNTHESIS_SCHEMA } from "./rule-schema";
import type { Rule } from "../types";
import path from "path";

interface RatingWithItem {
  id: number;
  review_item_id: number;
  rating: number;
  comment: string | null;
  item_title: string;
  item_description: string;
  item_code_snippet: string | null;
  item_file_path: string | null;
  item_proposed_fix: string | null;
  category: string;
  severity: string | null;
}

export async function runLearningPipeline(sessionId: number) {
  const unprocessed = getUnprocessedRatings(sessionId) as RatingWithItem[];

  if (unprocessed.length < 1) {
    return { rulesCreated: 0, rulesUpdated: 0, message: "No unprocessed ratings for this session" };
  }

  const thumbsDown = unprocessed.filter((r) => r.rating === -1);
  const thumbsUp = unprocessed.filter((r) => r.rating === 1);

  let rulesCreated = 0;

  if (thumbsDown.length >= 2) {
    const avoidRules = await synthesizeRules(thumbsDown, "avoid");
    const exts = extractFileExtensions(thumbsDown);
    for (const rule of avoidRules) {
      const ruleId = insertRule({
        rule_type: "avoid",
        title: rule.title,
        description: rule.description,
        category: rule.category,
        source_type: "learned",
        confidence: Math.min(0.9, 0.4 + thumbsDown.length * 0.05),
        file_extensions: exts.length > 0 ? JSON.stringify(exts) : undefined,
      });
      linkRatingsToRule(
        ruleId,
        thumbsDown.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment }))
      );
      rulesCreated++;
    }
  }

  if (thumbsUp.length >= 2) {
    const doRules = await synthesizeRules(thumbsUp, "do");
    const exts = extractFileExtensions(thumbsUp);
    for (const rule of doRules) {
      const ruleId = insertRule({
        rule_type: "do",
        title: rule.title,
        description: rule.description,
        category: rule.category,
        source_type: "learned",
        confidence: Math.min(0.9, 0.4 + thumbsUp.length * 0.05),
        file_extensions: exts.length > 0 ? JSON.stringify(exts) : undefined,
      });
      linkRatingsToRule(
        ruleId,
        thumbsUp.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment }))
      );
      rulesCreated++;
    }
  }

  // Handle remaining unlinked ratings by linking them to a placeholder
  const remaining = unprocessed.filter(
    (r) =>
      (r.rating === -1 && thumbsDown.length < 2) ||
      (r.rating === 1 && thumbsUp.length < 2)
  );
  // These will be picked up next time when there are enough

  const rulesUpdated = resolveConflicts();
  const rulesMerged = await consolidateRules();

  return { rulesCreated, rulesUpdated, rulesMerged };
}

async function synthesizeRules(
  ratings: RatingWithItem[],
  ruleType: "do" | "avoid"
): Promise<Array<{ title: string; description: string; category?: string }>> {
  const provider = createProvider(getAIProvider());

  const examples = ratings.map((r) => ({
    title: r.item_title,
    description: r.item_description,
    code_snippet: r.item_code_snippet,
    file_path: r.item_file_path,
    user_comment: r.comment,
    severity: r.severity,
  }));

  const direction =
    ruleType === "avoid"
      ? "UNHELPFUL (thumbs down). Extract 1-3 concise rules about what to AVOID."
      : "HELPFUL (thumbs up). Extract 1-3 concise rules about what to DO MORE OF.";

  const prompt = `The user rated the following code review findings as ${direction}

Each rule should be:
- A single clear instruction, not a restatement of the examples
- Generalizable beyond these specific findings
- Actionable for future reviews

Examples:
${JSON.stringify(examples, null, 2)}`;

  try {
    const result = await provider.runReview({
      diff: prompt,
      chunkIndex: 0,
      chunkCount: 1,
      repoPath: "",
      branch: "",
      baseBranch: "",
      systemPrompt:
        "You are a meta-reviewer that analyzes patterns in code review feedback to extract generalizable rules. Output rules as structured JSON.",
    });

    // The result items will be our rules (repurposing the review output format)
    return result.items.map((item) => ({
      title: item.title,
      description: item.description,
      category: item.category,
    }));
  } catch (error) {
    console.error("Rule synthesis failed:", error);
    return [];
  }
}

async function consolidateRules(): Promise<number> {
  const rules = getEnabledRules();
  if (rules.length < 6) return 0;

  const groups: { type: "do" | "avoid"; rules: Rule[] }[] = [
    { type: "do", rules: rules.filter((r) => r.rule_type === "do") },
    { type: "avoid", rules: rules.filter((r) => r.rule_type === "avoid") },
  ];

  let totalMerged = 0;

  for (const group of groups) {
    if (group.rules.length < 4) continue;

    const clusters = findSimilarClusters(group.rules);
    for (const cluster of clusters) {
      if (cluster.length < 2) continue;

      const merged = await mergeRules(cluster, group.type);
      if (!merged) continue;

      const maxConfidence = Math.max(...cluster.map((r) => r.confidence));
      const totalApplied = cluster.reduce((sum, r) => sum + r.times_applied, 0);

      const newId = insertRule({
        rule_type: group.type,
        title: merged.title,
        description: merged.description,
        category: merged.category,
        source_type: "learned",
        confidence: Math.min(1.0, maxConfidence + 0.05),
      });

      updateRule(newId, {
        confidence: Math.min(1.0, maxConfidence + 0.05),
      });

      const db = (await import("../db/connection")).getDb();
      const sourceRatings = db
        .prepare(
          `SELECT rsr.rating_id as id, r.rating, r.comment
           FROM rule_source_ratings rsr
           JOIN ratings r ON r.id = rsr.rating_id
           WHERE rsr.rule_id IN (${cluster.map(() => "?").join(",")})`
        )
        .all(...cluster.map((r) => r.id)) as { id: number; rating: number; comment: string | null }[];
      if (sourceRatings.length > 0) {
        linkRatingsToRule(newId, sourceRatings);
      }

      if (totalApplied > 0) {
        db.prepare("UPDATE rules SET times_applied = ? WHERE id = ?").run(totalApplied, newId);
      }

      for (const old of cluster) {
        deleteRule(old.id);
      }

      totalMerged += cluster.length;
    }
  }

  return totalMerged;
}

function extractFileExtensions(ratings: RatingWithItem[]): string[] {
  const exts = new Set<string>();
  for (const r of ratings) {
    if (r.item_file_path) {
      const ext = path.extname(r.item_file_path).toLowerCase();
      if (ext) exts.add(ext);
    }
  }
  return [...exts];
}

function findSimilarClusters(rules: Rule[]): Rule[][] {
  const used = new Set<number>();
  const clusters: Rule[][] = [];

  for (let i = 0; i < rules.length; i++) {
    if (used.has(i)) continue;
    const cluster = [rules[i]];
    used.add(i);

    for (let j = i + 1; j < rules.length; j++) {
      if (used.has(j)) continue;
      const sim = computeSimilarity(rules[i].description, rules[j].description);
      if (sim > 0.35) {
        cluster.push(rules[j]);
        used.add(j);
      }
    }

    if (cluster.length >= 2) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

async function mergeRules(
  cluster: Rule[],
  ruleType: "do" | "avoid"
): Promise<{ title: string; description: string; category?: string } | null> {
  const provider = createProvider(getAIProvider());

  const prompt = `These ${ruleType === "avoid" ? "AVOID" : "DO"} rules for an AI code reviewer overlap and should be merged into a single, concise rule.

Rules to merge:
${cluster.map((r, i) => `${i + 1}. [${r.title}] ${r.description}`).join("\n")}

Merge into ONE rule that captures the combined intent. Keep it concise and actionable.`;

  try {
    const result = await provider.runReview({
      diff: prompt,
      chunkIndex: 0,
      chunkCount: 1,
      repoPath: "",
      branch: "",
      baseBranch: "",
      systemPrompt:
        "You are a rule consolidation assistant. Merge overlapping code review rules into a single concise rule. Output as structured JSON.",
    });

    if (result.items.length > 0) {
      return {
        title: result.items[0].title,
        description: result.items[0].description,
        category: result.items[0].category,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function resolveConflicts(): number {
  const rules = getEnabledRules();
  let updated = 0;

  // Simple conflict detection: rules with opposite types and similar descriptions
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i];
      const b = rules[j];
      if (a.rule_type === b.rule_type) continue;

      const similarity = computeSimilarity(a.description, b.description);
      if (similarity > 0.6) {
        // Reduce confidence on both
        const newConfA = Math.max(0, a.confidence - 0.15);
        const newConfB = Math.max(0, b.confidence - 0.15);
        updateRule(a.id, { confidence: newConfA, enabled: newConfA >= 0.2 });
        updateRule(b.id, { confidence: newConfB, enabled: newConfB >= 0.2 });
        updated += 2;
      }
    }
  }

  return updated;
}

function computeSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

export { RULE_SYNTHESIS_SCHEMA };
