import { NextRequest, NextResponse } from "next/server";
import { getAllRules, insertRule } from "@/lib/db/rules";

export async function GET() {
  try {
    const rules = getAllRules();
    return NextResponse.json({ rules });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ruleType, title, description, category } = body;

    if (!ruleType || !title || !description) {
      return NextResponse.json(
        { error: "ruleType, title, and description are required" },
        { status: 400 }
      );
    }

    const id = insertRule({
      rule_type: ruleType,
      title,
      description,
      category,
      source_type: "manual",
      confidence: 1.0,
    });

    return NextResponse.json({ id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
