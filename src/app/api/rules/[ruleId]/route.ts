import { NextRequest, NextResponse } from "next/server";
import { updateRule, deleteRule } from "@/lib/db/rules";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  const { ruleId } = await params;
  const id = parseInt(ruleId);

  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid rule ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    updateRule(id, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  const { ruleId } = await params;
  const id = parseInt(ruleId);

  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid rule ID" }, { status: 400 });
  }

  try {
    deleteRule(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
