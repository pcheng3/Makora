import { NextRequest, NextResponse } from "next/server";
import { deleteComment } from "@/lib/db/comments";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await params;
    const id = parseInt(commentId);

    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
    }

    deleteComment(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
