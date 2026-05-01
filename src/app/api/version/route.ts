import { NextResponse } from "next/server";
import { checkForUpdates } from "@/lib/git/version";

export async function GET() {
  try {
    const info = await checkForUpdates();
    return NextResponse.json(info);
  } catch {
    return NextResponse.json(
      { branch: "", versionLabel: "unknown", localHash: "", commitsBehind: 0, available: false }
    );
  }
}
