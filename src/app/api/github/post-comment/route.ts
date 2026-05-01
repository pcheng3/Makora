import { NextRequest, NextResponse } from "next/server";
import {
  postPRComment,
  postPRReviewComment,
} from "@/lib/github/cli";
import { insertPRComment } from "@/lib/db/pr-comments";

export async function POST(req: NextRequest) {
  try {
    const {
      reviewItemId,
      repoPath,
      prNumber,
      commitId,
      body,
      filePath,
      lineStart,
      lineEnd,
    } = await req.json();

    if (!reviewItemId || !repoPath || !prNumber || !body) {
      return NextResponse.json(
        { error: "reviewItemId, repoPath, prNumber, and body are required" },
        { status: 400 }
      );
    }

    let prCommentId: number | null = null;
    let commentUrl = "";

    if (filePath && lineStart && commitId) {
      try {
        const result = await postPRReviewComment(
          repoPath,
          prNumber,
          body,
          filePath,
          lineEnd ?? lineStart,
          commitId,
          lineStart !== lineEnd ? lineStart : undefined
        );
        prCommentId = result.prCommentId;
        commentUrl = result.commentUrl;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("422") || msg.includes("Validation")) {
          const result = await postPRComment(repoPath, prNumber, body);
          commentUrl = result.commentUrl;
        } else {
          throw err;
        }
      }
    } else {
      const result = await postPRComment(repoPath, prNumber, body);
      commentUrl = result.commentUrl;
    }

    const prComment = insertPRComment(
      reviewItemId,
      prNumber,
      prCommentId,
      commentUrl,
      body
    );

    return NextResponse.json({ success: true, commentUrl, prComment });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
