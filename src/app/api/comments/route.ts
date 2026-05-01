import { NextRequest, NextResponse } from "next/server";
import { addComment } from "@/lib/db/comments";

export async function POST(req: NextRequest) {
  try {
    const { reviewItemId, text } = await req.json();

    if (!reviewItemId || !text?.trim()) {
      return NextResponse.json(
        { error: "reviewItemId and text are required" },
        { status: 400 }
      );
    }

    const comment = addComment(reviewItemId, text.trim());
    return NextResponse.json({ comment });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
