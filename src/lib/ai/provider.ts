import type { ReviewRequest, ReviewResult, AIReviewOutput } from "../types";
import { REVIEW_OUTPUT_SCHEMA } from "./output-schema";
import { spawn } from "child_process";
import { getFoundryBaseUrl, getFoundryModel, getFoundryToken } from "../db/settings";

export type ActivityCallback = (activity: { tool: string; input: string }) => void;

export interface AIProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  testConnection(): Promise<{ available: boolean; error?: string }>;
  runReview(request: ReviewRequest, signal?: AbortSignal, onActivity?: ActivityCallback): Promise<ReviewResult>;
}

export class ClaudeProvider implements AIProvider {
  name = "claude";

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("claude", ["--version"], { stdio: "pipe" });
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  }

  async testConnection(): Promise<{ available: boolean; error?: string }> {
    const available = await this.isAvailable();
    return { available, error: available ? undefined : "Claude CLI not found" };
  }

  async runReview(request: ReviewRequest, signal?: AbortSignal, onActivity?: ActivityCallback): Promise<ReviewResult> {
    const startTime = Date.now();
    const schemaStr = JSON.stringify(REVIEW_OUTPUT_SCHEMA);

    const args = [
      "-p",
      "--bare",
      "--output-format",
      "stream-json",
      "--verbose",
      "--json-schema",
      schemaStr,
      "--system-prompt",
      request.systemPrompt,
      "--tools",
      "Read,Bash",
      "--allowedTools",
      "Read,Bash(git diff*),Bash(git log*),Bash(git show*),Bash(gh pr view*),Bash(gh pr list*)",
      "--add-dir",
      request.repoPath,
      "--dangerously-skip-permissions",
      "--no-session-persistence",
      request.diff,
    ];

    const resultText = await this.execClaude(args, signal, onActivity);
    const reviewOutput = this.extractJsonFromText(resultText);

    return {
      summary: reviewOutput.summary || "No summary provided.",
      items: reviewOutput.items || [],
      rawOutput: resultText,
      durationMs: Date.now() - startTime,
    };
  }

  private execClaude(args: string[], signal?: AbortSignal, onActivity?: ActivityCallback): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn("claude", args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });

      let buffer = "";
      let finalResult = "";
      let settled = false;

      proc.stdout.on("data", (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === "assistant" && msg.message?.content) {
              for (const block of msg.message.content) {
                if (block.type === "tool_use" && block.name !== "StructuredOutput" && onActivity) {
                  onActivity({
                    tool: block.name,
                    input: summarizeToolInput(block.name, block.input),
                  });
                }
              }
            }
            if (msg.type === "result") {
              if (msg.is_error) {
                settled = true;
                reject(new Error(msg.result || "Claude returned an error"));
              } else if (msg.structured_output) {
                finalResult = JSON.stringify(msg.structured_output);
              } else {
                finalResult = msg.result || "";
              }
            }
          } catch {
            // partial JSON or non-JSON line, skip
          }
        }
      });

      proc.stderr.on("data", () => {
        // ignore stderr
      });

      if (signal) {
        if (signal.aborted) {
          proc.kill("SIGTERM");
          reject(new Error("Review cancelled"));
          return;
        }
        signal.addEventListener("abort", () => {
          if (!settled) {
            settled = true;
            proc.kill("SIGTERM");
            reject(new Error("Review cancelled"));
          }
        }, { once: true });
      }

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          proc.kill("SIGTERM");
          reject(new Error("Review timed out after 10 minutes"));
        }
      }, 10 * 60 * 1000);

      proc.on("close", () => {
        clearTimeout(timeout);
        if (settled) return;
        settled = true;
        resolve(finalResult);
      });

      proc.on("error", (err) => {
        clearTimeout(timeout);
        if (settled) return;
        settled = true;
        reject(new Error(`Failed to spawn claude: ${err.message}`));
      });
    });
  }

  private extractJsonFromText(text: string): AIReviewOutput {
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        // fall through
      }
    }

    try {
      return JSON.parse(text);
    } catch {
      return {
        summary: text.slice(0, 500),
        items: [],
      };
    }
  }
}

interface VertexContentBlock {
  type: string;
  name?: string;
  input?: unknown;
  text?: string;
}

interface VertexResponse {
  content: VertexContentBlock[];
}

const VERTEX_PROJECT_ID = "unset";
const VERTEX_REGION = "global";
const VERTEX_API_VERSION = "vertex-2023-10-16";

export class FoundryProvider implements AIProvider {
  name = "foundry";

  async isAvailable(): Promise<boolean> {
    const token = getFoundryToken();
    const baseUrl = getFoundryBaseUrl();
    return !!(token && baseUrl);
  }

  async testConnection(): Promise<{ available: boolean; error?: string }> {
    const token = getFoundryToken();
    const baseUrl = getFoundryBaseUrl();
    const model = getFoundryModel();

    if (!token || !baseUrl) {
      return { available: false, error: "Missing token or base URL" };
    }

    const url = buildVertexUrl(baseUrl, model);

    try {
      const response = await vertexFetch(url, token, {
        anthropic_version: VERTEX_API_VERSION,
        stream: true,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 16,
      });

      if (!response.ok) {
        const body = await response.text();
        return {
          available: false,
          error: `HTTP ${response.status}: ${body || "(empty body)"}`,
        };
      }

      if (response.body) {
        const reader = response.body.getReader();
        while (!(await reader.read()).done) { /* drain */ }
      }

      return { available: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { available: false, error: msg };
    }
  }

  async runReview(request: ReviewRequest, signal?: AbortSignal, onActivity?: ActivityCallback): Promise<ReviewResult> {
    const startTime = Date.now();
    const token = getFoundryToken();
    const baseUrl = getFoundryBaseUrl();
    const model = getFoundryModel();

    if (!token || !baseUrl) {
      throw new Error("Foundry provider requires an auth token and base URL");
    }

    const tool = {
      name: "submit_review",
      description: "Submit the structured code review output",
      input_schema: REVIEW_OUTPUT_SCHEMA,
    };

    onActivity?.({ tool: "Vertex", input: `Connecting to ${model}...` });

    const url = buildVertexUrl(baseUrl, model);
    const response = await vertexFetch(url, token, {
      anthropic_version: VERTEX_API_VERSION,
      stream: true,
      messages: [{ role: "user", content: request.diff }],
      max_tokens: 16384,
      system: request.systemPrompt,
      tools: [tool],
      tool_choice: { type: "tool", name: "submit_review" },
    }, signal);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Vertex API error ${response.status}: ${body || "(empty body)"}`);
    }

    const data = await parseSSEStream(response, onActivity);
    const reviewOutput = this.extractOutput(data);

    return {
      summary: reviewOutput.summary || "No summary provided.",
      items: reviewOutput.items || [],
      rawOutput: JSON.stringify(data.content),
      durationMs: Date.now() - startTime,
    };
  }

  private extractOutput(response: VertexResponse): AIReviewOutput {
    for (const block of response.content) {
      if (block.type === "tool_use" && block.name === "submit_review") {
        return block.input as unknown as AIReviewOutput;
      }
    }

    for (const block of response.content) {
      if (block.type === "text" && block.text) {
        try {
          return JSON.parse(block.text);
        } catch {
          return { summary: block.text.slice(0, 500), items: [] };
        }
      }
    }

    return { summary: "No output received", items: [] };
  }
}

function buildVertexUrl(baseUrl: string, model: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/projects/${VERTEX_PROJECT_ID}/locations/${VERTEX_REGION}/publishers/anthropic/models/${model}:streamRawPredict`;
}

async function vertexFetch(url: string, token: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "X-Palantir-compliance-regime": "FEDRAMP_HIGH_IL4_DIB",
      "X-Palantir-georestriction-region": "US",
    },
    body: JSON.stringify(body),
    signal: signal ?? undefined,
  });
}

async function parseSSEStream(response: Response, onActivity?: ActivityCallback): Promise<VertexResponse> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  const contentBlocks: VertexContentBlock[] = [];
  const jsonAccumulators: Map<number, string> = new Map();
  let buffer = "";
  let lastActivityAt = 0;
  let totalChars = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === "[DONE]") continue;

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }

      switch (event.type) {
        case "message_start": {
          onActivity?.({ tool: "Vertex", input: "Stream connected, analyzing diff..." });
          break;
        }
        case "content_block_start": {
          const idx = event.index as number;
          const block = event.content_block as Record<string, unknown>;
          if (block.type === "tool_use") {
            contentBlocks[idx] = { type: "tool_use", name: block.name as string, input: undefined };
            jsonAccumulators.set(idx, "");
            onActivity?.({ tool: "Vertex", input: "Building structured review output..." });
          } else if (block.type === "text") {
            contentBlocks[idx] = { type: "text", text: "" };
            onActivity?.({ tool: "Vertex", input: "Generating analysis..." });
          }
          break;
        }
        case "content_block_delta": {
          const idx = event.index as number;
          const delta = event.delta as Record<string, unknown>;
          if (delta.type === "input_json_delta") {
            const chunk = delta.partial_json as string;
            const prev = jsonAccumulators.get(idx) || "";
            jsonAccumulators.set(idx, prev + chunk);
            totalChars += chunk.length;
          } else if (delta.type === "text_delta") {
            const block = contentBlocks[idx];
            const text = delta.text as string;
            if (block?.type === "text") {
              block.text = (block.text || "") + text;
            }
            totalChars += text.length;
          }
          const now = Date.now();
          if (onActivity && now - lastActivityAt > 2000) {
            lastActivityAt = now;
            const kb = (totalChars / 1024).toFixed(1);
            onActivity({ tool: "Vertex", input: `Streaming response... (${kb} KB received)` });
          }
          break;
        }
        case "content_block_stop": {
          const idx = event.index as number;
          const block = contentBlocks[idx];
          const json = jsonAccumulators.get(idx);
          if (block?.type === "tool_use" && json) {
            block.input = JSON.parse(json);
            jsonAccumulators.delete(idx);
            onActivity?.({ tool: "Vertex", input: "Review output complete" });
          }
          break;
        }
      }
    }
  }

  return { content: contentBlocks };
}

function summarizeToolInput(tool: string, input: Record<string, unknown>): string {
  switch (tool) {
    case "Read":
      return String(input.file_path || "");
    case "Bash":
      return String(input.command || "").slice(0, 120);
    case "Edit":
      return String(input.file_path || "");
    case "Write":
      return String(input.file_path || "");
    default:
      return JSON.stringify(input).slice(0, 80);
  }
}

export function createProvider(name: string): AIProvider {
  switch (name) {
    case "claude":
      return new ClaudeProvider();
    case "foundry":
      return new FoundryProvider();
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}
