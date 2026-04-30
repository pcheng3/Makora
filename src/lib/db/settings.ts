import { getDb } from "./connection";

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
    key,
    value
  );
}

export function getSkipExtensions(): string[] {
  const raw = getSetting("skip_extensions");
  if (!raw) return [".meta", ".prefab", ".asset", ".unity", ".mat", ".lighting"];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
