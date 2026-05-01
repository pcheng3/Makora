import { NextResponse } from "next/server";
import { getCustomBasePrompt, setCustomBasePrompt, clearCustomBasePrompt } from "@/lib/db/settings";
import { DEFAULT_BASE_INSTRUCTIONS } from "@/lib/ai/prompt-builder";

export function GET() {
  const prompt = getCustomBasePrompt();
  return NextResponse.json({ prompt, defaultPrompt: DEFAULT_BASE_INSTRUCTIONS });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { prompt } = body;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "prompt must be a non-empty string" }, { status: 400 });
  }
  setCustomBasePrompt(prompt);
  return NextResponse.json({ prompt });
}

export async function DELETE() {
  clearCustomBasePrompt();
  return NextResponse.json({ prompt: null });
}
