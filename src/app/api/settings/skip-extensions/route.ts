import { NextResponse } from "next/server";
import { getSkipExtensions } from "@/lib/db/settings";
import { setSetting } from "@/lib/db/settings";

export function GET() {
  const extensions = getSkipExtensions();
  return NextResponse.json({ extensions });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { extensions } = body;

  if (!Array.isArray(extensions) || !extensions.every((e: unknown) => typeof e === "string")) {
    return NextResponse.json({ error: "extensions must be an array of strings" }, { status: 400 });
  }

  const normalized = extensions
    .map((e: string) => e.toLowerCase().trim())
    .filter((e: string) => e.startsWith(".") && e.length > 1);

  setSetting("skip_extensions", JSON.stringify(normalized));
  return NextResponse.json({ extensions: normalized });
}
