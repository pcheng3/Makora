import { NextRequest, NextResponse } from "next/server";
import { isLearning } from "@/lib/learning/status";
import { getSessionLearningStatus } from "@/lib/db/ratings";

export async function GET(req: NextRequest) {
  const sessionId = parseInt(req.nextUrl.searchParams.get("sessionId") ?? "");
  if (isNaN(sessionId)) {
    return NextResponse.json({ error: "Missing or invalid sessionId" }, { status: 400 });
  }
  const status = getSessionLearningStatus(sessionId);
  return NextResponse.json({ isLearning: isLearning(sessionId), ...status });
}
