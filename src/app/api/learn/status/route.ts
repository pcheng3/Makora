import { NextRequest, NextResponse } from "next/server";
import { isLearning } from "@/lib/learning/status";

export async function GET(req: NextRequest) {
  const sessionId = parseInt(req.nextUrl.searchParams.get("sessionId") ?? "");
  if (isNaN(sessionId)) {
    return NextResponse.json({ error: "Missing or invalid sessionId" }, { status: 400 });
  }
  return NextResponse.json({ isLearning: isLearning(sessionId) });
}
