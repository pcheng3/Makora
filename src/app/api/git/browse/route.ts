import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST() {
  try {
    const { stdout } = await execAsync(
      `osascript -e 'POSIX path of (choose folder with prompt "Select repository")'`
    );
    const path = stdout.trim().replace(/\/$/, "");
    return NextResponse.json({ path });
  } catch {
    return NextResponse.json({ path: null });
  }
}
