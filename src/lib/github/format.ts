import type { ReviewItemWithRating } from "../types";

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "\u{1F534}",
  blocking: "\u{1F7E0}",
  suggestion: "\u{1F535}",
  nit: "⚪",
};

export function formatReviewItemAsComment(
  item: ReviewItemWithRating
): string {
  const emoji = item.severity ? SEVERITY_EMOJI[item.severity] ?? "" : "";
  const lines: string[] = [];

  lines.push(`### ${emoji} ${item.title}`);
  lines.push("");

  const meta: string[] = [];
  if (item.severity) meta.push(`**Severity:** ${item.severity}`);
  meta.push(`**Category:** ${item.category}`);
  if (meta.length > 0) lines.push(meta.join(" | "));

  if (item.file_path) {
    let loc = item.file_path;
    if (item.line_start) {
      loc += `:${item.line_start}`;
      if (item.line_end && item.line_end !== item.line_start) {
        loc += `-${item.line_end}`;
      }
    }
    lines.push(`**File:** \`${loc}\``);
  }

  lines.push("");
  lines.push(item.description);

  if (item.code_snippet) {
    lines.push("");
    lines.push("<details>");
    lines.push("<summary>Code Snippet</summary>");
    lines.push("");
    lines.push("```");
    lines.push(item.code_snippet);
    lines.push("```");
    lines.push("");
    lines.push("</details>");
  }

  if (item.proposed_fix) {
    lines.push("");
    lines.push("<details>");
    lines.push("<summary>Proposed Fix</summary>");
    lines.push("");
    lines.push("```");
    lines.push(item.proposed_fix);
    lines.push("```");
    lines.push("");
    lines.push("</details>");
  }

  lines.push("");
  lines.push("---");
  lines.push("*Posted via Mahoraga code review*");

  return lines.join("\n");
}
