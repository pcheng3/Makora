import { NextResponse } from "next/server";
import { runLearningPipeline } from "@/lib/learning/pipeline";

export async function POST() {
  try {
    const result = await runLearningPipeline();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
