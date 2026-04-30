import { NextRequest, NextResponse } from "next/server";
import { upsertRating } from "@/lib/db/ratings";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reviewItemId, rating, comment } = body;

    if (!reviewItemId || (rating !== 1 && rating !== -1)) {
      return NextResponse.json(
        { error: "reviewItemId and rating (1 or -1) are required" },
        { status: 400 }
      );
    }

    const result = upsertRating({
      review_item_id: reviewItemId,
      rating,
      comment: comment || null,
    });

    return NextResponse.json({ rating: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
