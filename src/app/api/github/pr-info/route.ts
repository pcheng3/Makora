import { NextRequest, NextResponse } from "next/server";
import { getRepoInfo } from "@/lib/git/diff";
import { getPRForBranch } from "@/lib/github/cli";

export async function GET(req: NextRequest) {
  const repoPath = req.nextUrl.searchParams.get("repoPath");
  const branch = req.nextUrl.searchParams.get("branch");

  if (!repoPath || !branch) {
    return NextResponse.json(
      { error: "repoPath and branch query params required" },
      { status: 400 }
    );
  }

  try {
    const { remoteUrl } = await getRepoInfo(repoPath);
    if (!remoteUrl || !remoteUrl.includes("github")) {
      return NextResponse.json({ pr: null, isGitHub: false });
    }

    const pr = await getPRForBranch(repoPath, branch);
    return NextResponse.json({
      pr: pr
        ? { number: pr.prNumber, url: pr.prUrl, commitId: pr.commitId }
        : null,
      isGitHub: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
