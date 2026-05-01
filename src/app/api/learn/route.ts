import { NextRequest, NextResponse } from "next/server";
import { runLearningPipeline } from "@/lib/learning/pipeline";
import { startLearning, finishLearning } from "@/lib/learning/status";
import { listSessions } from "@/lib/db/sessions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.mode === "all") {
      return await handleLearnAll();
    }

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

async function handleLearnAll() {
  const sessions = listSessions(1000, 0);
  const toLearn = sessions.filter((s) => s.needs_learning > 0);

  let totalCreated = 0;
  let totalMerged = 0;
  let sessionsProcessed = 0;

  for (const session of toLearn) {
    if (!startLearning(session.id)) continue;
    try {
      const result = await runLearningPipeline(session.id);
      totalCreated += result.rulesCreated;
      totalMerged += result.rulesMerged ?? 0;
      sessionsProcessed++;
    } catch {
      // continue to next session
    } finally {
      finishLearning(session.id);
    }
  }

  return NextResponse.json({
    sessionsProcessed,
    rulesCreated: totalCreated,
    rulesMerged: totalMerged,
  });
}
