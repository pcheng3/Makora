import { NextResponse } from "next/server";
import { cancelReview } from "@/lib/ai/orchestrator";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const id = parseInt(sessionId, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
  }

  const cancelled = cancelReview(id);
  return NextResponse.json({ cancelled });
}
