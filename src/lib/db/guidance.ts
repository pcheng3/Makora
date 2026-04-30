import { getDb } from "./connection";
import type { GuidanceFile } from "../types";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const GUIDANCE_DIR = path.join(process.cwd(), "data", "guidance");

export function getEnabledGuidance(): GuidanceFile[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM guidance_files WHERE enabled = 1")
    .all() as GuidanceFile[];
}

export function getAllGuidance(): GuidanceFile[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM guidance_files ORDER BY created_at DESC")
    .all() as GuidanceFile[];
}

export function getGuidanceContents(): string[] {
  const files = getEnabledGuidance();
  return files
    .map((f) => {
      try {
        return fs.readFileSync(f.file_path, "utf-8");
      } catch {
        return null;
      }
    })
    .filter((c): c is string => c !== null);
}

export function saveGuidanceFile(
  originalName: string,
  content: Buffer,
  description?: string
): number {
  const db = getDb();

  if (!fs.existsSync(GUIDANCE_DIR)) {
    fs.mkdirSync(GUIDANCE_DIR, { recursive: true });
  }

  const hash = crypto.createHash("sha256").update(content).digest("hex");
  const ext = path.extname(originalName);
  const filename = `${hash.slice(0, 12)}${ext}`;
  const filePath = path.join(GUIDANCE_DIR, filename);

  fs.writeFileSync(filePath, content);

  const result = db
    .prepare(
      `INSERT INTO guidance_files (filename, original_name, description, file_path, content_hash, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(filename, originalName, description ?? null, filePath, hash, content.length);

  return result.lastInsertRowid as number;
}

export function deleteGuidanceFile(id: number) {
  const db = getDb();
  const file = db
    .prepare("SELECT * FROM guidance_files WHERE id = ?")
    .get(id) as GuidanceFile | undefined;

  if (file) {
    try {
      fs.unlinkSync(file.file_path);
    } catch {
      // file already gone
    }
    db.prepare("DELETE FROM guidance_files WHERE id = ?").run(id);
  }
}

export function toggleGuidance(id: number, enabled: boolean) {
  const db = getDb();
  db.prepare("UPDATE guidance_files SET enabled = ? WHERE id = ?").run(
    enabled ? 1 : 0,
    id
  );
}
