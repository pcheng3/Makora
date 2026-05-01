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

export function getCustomBasePrompt(): string | null {
  return getSetting("custom_base_prompt");
}

export function setCustomBasePrompt(value: string) {
  setSetting("custom_base_prompt", value);
}

export function clearCustomBasePrompt() {
  const db = getDb();
  db.prepare("DELETE FROM settings WHERE key = ?").run("custom_base_prompt");
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

export function getAIProvider(): "claude" | "foundry" {
  const val = getSetting("ai_provider");
  return val === "foundry" ? "foundry" : "claude";
}

export function setAIProvider(provider: "claude" | "foundry") {
  setSetting("ai_provider", provider);
}

export function getFoundryToken(): string | null {
  return getSetting("foundry_token") || process.env.ANTHROPIC_AUTH_TOKEN || null;
}

export function setFoundryToken(token: string) {
  setSetting("foundry_token", token);
  clearProviderVerified("foundry");
}

export function clearFoundryToken() {
  const db = getDb();
  db.prepare("DELETE FROM settings WHERE key = ?").run("foundry_token");
}

const DEFAULT_FOUNDRY_BASE_URL = "https://production.scapula.rubix.cloud/llm-portal/vertex/v1";

export function getFoundryBaseUrl(): string {
  return getSetting("foundry_base_url") || process.env.ANTHROPIC_VERTEX_BASE_URL || DEFAULT_FOUNDRY_BASE_URL;
}

export function setFoundryBaseUrl(url: string) {
  setSetting("foundry_base_url", url);
  clearProviderVerified("foundry");
}

export function getFoundryModel(): string {
  return getSetting("foundry_model") || process.env.ANTHROPIC_MODEL || "claude-opus-4-6";
}

export function setFoundryModel(model: string) {
  setSetting("foundry_model", model);
}

export function getProviderVerified(provider: "claude" | "foundry"): boolean {
  return getSetting(`${provider}_verified`) === "true";
}

export function setProviderVerified(provider: "claude" | "foundry", verified: boolean) {
  if (verified) {
    setSetting(`${provider}_verified`, "true");
  } else {
    clearProviderVerified(provider);
  }
}

function clearProviderVerified(provider: "claude" | "foundry") {
  const db = getDb();
  db.prepare("DELETE FROM settings WHERE key = ?").run(`${provider}_verified`);
}
