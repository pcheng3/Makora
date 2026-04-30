import type { Rule, FewShotExample } from "../types";

export function buildSystemPrompt(
  rules: Rule[],
  guidanceContents: string[],
  fewShotExamples?: FewShotExample[]
): string {
  const sections: string[] = [];

  sections.push(`You are an expert code reviewer. You have tool access to explore the repository — use git diff, git show, and Read to examine changes and their surrounding context.

## How to Review
1. Start with \`git diff <baseBranch>...<branch> --stat\` to see what files changed
2. Use \`git diff <baseBranch>...<branch> -- <file>\` to inspect individual file diffs
3. Use Read to look at surrounding code for context when needed (e.g., to check if a null check exists elsewhere, or understand a class hierarchy)
4. Use \`gh pr view\` or \`gh pr list\` if you need PR description context
5. Skip binary files, large asset diffs, and auto-generated files — they are noise

## Severity Definitions
- critical: Runtime bug, crash, data corruption, security vulnerability. Will break in production.
- blocking: Should be fixed before merge but won't crash at runtime.
- suggestion: Improvement that could be deferred to a follow-up.
- nit: Minor style/formatting issue.

## Review Priorities (in order)
1. Correctness: null references, logic bugs, async errors, resource leaks, event subscription leaks
2. Security: injection, auth bypass, secrets exposure, unsafe deserialization
3. Architecture: design pattern misuse, unnecessary coupling, layer violations
4. Performance: O(n^2) in hot paths, unnecessary allocations, missing caching
5. Readability: unclear naming, missing error context, confusing control flow

## Rules
- Only report findings you are confident about. If you investigate and determine it's NOT a real problem, omit it entirely.
- Verify line numbers by reading the actual file before citing them.
- Always propose a concrete fix with code when possible.
- For each issue, explain WHY it's a problem, not just WHAT is wrong.
- Group related findings into a single item when they share a root cause.
- Include positive findings (category: "positive") for particularly good patterns or improvements.
- Include test suggestions (category: "test_suggestion") for areas that should be tested.`);

  const doRules = rules.filter((r) => r.rule_type === "do" && r.enabled);
  const avoidRules = rules.filter(
    (r) => r.rule_type === "avoid" && r.enabled
  );

  if (doRules.length > 0) {
    sections.push(
      `## Things to DO (learned from past feedback)\n${doRules
        .map((r) => `- ${r.description}`)
        .join("\n")}`
    );
  }

  if (avoidRules.length > 0) {
    sections.push(
      `## Things to AVOID (learned from past feedback)\n${avoidRules
        .map((r) => `- ${r.description}`)
        .join("\n")}`
    );
  }

  if (fewShotExamples && fewShotExamples.length > 0) {
    sections.push(formatFewShotSection(fewShotExamples));
  }

  if (guidanceContents.length > 0) {
    sections.push(
      `## Project-Specific Guidance\n${guidanceContents.join("\n\n---\n\n")}`
    );
  }

  return sections.join("\n\n");
}

function formatFewShotSection(examples: FewShotExample[]): string {
  const parts = ["## Examples from Past Reviews\n\nThese are real findings from past reviews and how the user rated them. Learn from these to calibrate your review style."];

  for (const ex of examples) {
    const isGood = ex.rating === 1;
    const label = isGood
      ? "GOOD finding (user approved)"
      : "BAD finding (user rejected)";

    const lines = [`### ${label}`];
    if (ex.file_path) lines.push(`- **File**: ${ex.file_path}`);
    const meta = [ex.category];
    if (ex.severity) meta.push(`Severity: ${ex.severity}`);
    lines.push(`- **${meta.join(" | ")}**`);
    lines.push(`- **Title**: ${ex.title}`);

    if (ex.code_snippet) {
      const truncated = ex.code_snippet.split("\n").slice(0, 5).join("\n");
      lines.push(`- **Code**: \`${truncated}\``);
    }

    const desc = ex.description.length > 300
      ? ex.description.slice(0, 297) + "..."
      : ex.description;
    lines.push(`- **Finding**: ${desc}`);

    if (ex.proposed_fix) {
      const fix = ex.proposed_fix.length > 200
        ? ex.proposed_fix.slice(0, 197) + "..."
        : ex.proposed_fix;
      lines.push(`- **Proposed fix**: ${fix}`);
    }

    if (ex.comment) {
      const reason = isGood ? "Why this was valued" : "Why it was rejected";
      lines.push(`- **${reason}**: "${ex.comment}"`);
    }

    lines.push(
      isGood
        ? "- Produce more findings like this one."
        : "- DO NOT produce findings like this one."
    );

    parts.push(lines.join("\n"));
  }

  return parts.join("\n\n");
}

export function buildUserPrompt(
  repoPath: string,
  branch: string,
  baseBranch: string,
  filesToReview?: string[]
): string {
  const fileScope = filesToReview
    ? `\n\nFocus on these files only:\n${filesToReview.map((f) => `- ${f}`).join("\n")}`
    : "";

  return `Review the changes on branch \`${branch}\` compared to \`${baseBranch}\` in the repository at \`${repoPath}\`.

Use \`git diff ${baseBranch}...${branch}\` to examine the changes. Read surrounding code for context when needed to verify your findings.${fileScope}`;
}
