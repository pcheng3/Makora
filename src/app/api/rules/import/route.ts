import { NextResponse } from "next/server";
import { getAllRules, insertRule } from "@/lib/db/rules";

interface ImportedRule {
  rule_type: "do" | "avoid";
  category?: string;
  title: string;
  description: string;
  file_extensions?: string[] | null;
}

export async function POST(req: Request) {
  const body = await req.json();

  if (!body.rules || !Array.isArray(body.rules)) {
    return NextResponse.json({ error: "Invalid format: expected { rules: [...] }" }, { status: 400 });
  }

  const existingTitles = new Set(getAllRules().map((r) => r.title.toLowerCase()));

  let imported = 0;
  let skipped = 0;

  for (const rule of body.rules as ImportedRule[]) {
    if (!rule.rule_type || !rule.title || !rule.description) {
      skipped++;
      continue;
    }

    if (existingTitles.has(rule.title.toLowerCase())) {
      skipped++;
      continue;
    }

    insertRule({
      rule_type: rule.rule_type,
      category: rule.category,
      title: rule.title,
      description: rule.description,
      source_type: "imported",
      confidence: 0.8,
      file_extensions: rule.file_extensions ? JSON.stringify(rule.file_extensions) : undefined,
    });

    existingTitles.add(rule.title.toLowerCase());
    imported++;
  }

  return NextResponse.json({ imported, skipped });
}
