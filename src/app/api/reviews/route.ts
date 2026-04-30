import { NextRequest, NextResponse } from "next/server";
import { createSession, listSessions, getDistinctRepos } from "@/lib/db/sessions";
import { runReview } from "@/lib/ai/orchestrator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repoPath, branch, baseBranch, provider } = body;

    if (!repoPath || !branch || !baseBranch) {
      return NextResponse.json(
        { error: "repoPath, branch, and baseBranch are required" },
        { status: 400 }
      );
    }

    const sessionId = createSession({
      repo_path: repoPath,
      branch,
      base_branch: baseBranch,
      provider: provider || "claude",
    });

    // Fire and forget — client will connect to SSE stream
    runReview(sessionId, repoPath, branch, baseBranch, provider || "claude").catch(
      (err) => console.error("Review failed:", err)
    );

    return NextResponse.json({ sessionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");
  const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0");

  try {
    const sessions = listSessions(limit, offset);
    const repos = getDistinctRepos();
    return NextResponse.json({ sessions, repos });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
