import { NextRequest, NextResponse } from "next/server";
import { getDiff, getDiffStats } from "@/lib/git/diff";

export async function GET(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get("repo");
  const branch = req.nextUrl.searchParams.get("branch");
  const base = req.nextUrl.searchParams.get("base");

  if (!repo || !branch || !base) {
    return NextResponse.json(
      { error: "repo, branch, and base query params required" },
      { status: 400 }
    );
  }

  try {
    const [diff, stats] = await Promise.all([
      getDiff(repo, branch, base),
      getDiffStats(repo, branch, base),
    ]);
    return NextResponse.json({ diff, stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
