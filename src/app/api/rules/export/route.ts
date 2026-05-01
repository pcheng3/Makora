import { NextResponse } from "next/server";
import { getAllRules } from "@/lib/db/rules";

export function GET() {
  const rules = getAllRules();

  const portable = rules.map((r) => {
    let fileExtensions: string[] | null = null;
    if (r.file_extensions) {
      try {
        fileExtensions = JSON.parse(r.file_extensions);
      } catch {
        fileExtensions = null;
      }
    }

    return {
      rule_type: r.rule_type,
      category: r.category,
      title: r.title,
      description: r.description,
      file_extensions: fileExtensions,
    };
  });

  const payload = {
    version: 1,
    exported_at: new Date().toISOString(),
    rules: portable,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="mahoraga-rules.json"',
    },
  });
}
