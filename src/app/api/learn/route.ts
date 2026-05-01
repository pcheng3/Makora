import { NextRequest, NextResponse } from "next/server";
import { runLearningPipeline } from "@/lib/learning/pipeline";
import { startLearning, finishLearning } from "@/lib/learning/status";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = parseInt(body.sessionId);
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: "Missing or invalid sessionId" }, { status: 400 });
    }

    if (!startLearning(sessionId)) {
      return NextResponse.json({ error: "Learning already in progress for this session" }, { status: 409 });
    }

    try {
      const result = await runLearningPipeline(sessionId);
      return NextResponse.json(result);
    } finally {
      finishLearning(sessionId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
