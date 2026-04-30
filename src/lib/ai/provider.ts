import type { ReviewRequest, ReviewResult, AIReviewOutput } from "../types";
import { REVIEW_OUTPUT_SCHEMA } from "./output-schema";
import { spawn } from "child_process";

export type ActivityCallback = (activity: { tool: string; input: string }) => void;

export interface AIProvider {
  name: string;
  isAvailable(): Promise<boolean>;
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
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}
