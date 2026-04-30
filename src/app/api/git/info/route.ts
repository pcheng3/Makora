import { NextRequest, NextResponse } from "next/server";
import { getRepoInfo } from "@/lib/git/diff";

export async function GET(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get("repo");
  if (!repo) {
    return NextResponse.json({ error: "repo query param required" }, { status: 400 });
  }

  try {
    const info = await getRepoInfo(repo);
    return NextResponse.json(info);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
