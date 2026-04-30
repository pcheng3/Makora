import { NextRequest, NextResponse } from "next/server";
import {
  getAllGuidance,
  saveGuidanceFile,
  deleteGuidanceFile,
  toggleGuidance,
} from "@/lib/db/guidance";

export async function GET() {
  try {
    const files = getAllGuidance();
    return NextResponse.json({ files });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const description = formData.get("description") as string | null;

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const id = saveGuidanceFile(file.name, buffer, description || undefined);

    return NextResponse.json({ id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = parseInt(req.nextUrl.searchParams.get("id") || "");
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    deleteGuidanceFile(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, enabled } = body;

    if (id === undefined || enabled === undefined) {
      return NextResponse.json(
        { error: "id and enabled are required" },
        { status: 400 }
      );
    }

    toggleGuidance(id, enabled);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
