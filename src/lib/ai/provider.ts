import type { ReviewRequest, ReviewResult, AIReviewOutput } from "../types";
import { REVIEW_OUTPUT_SCHEMA } from "./output-schema";
import { spawn } from "child_process";

export interface AIProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  runReview(request: ReviewRequest, signal?: AbortSignal): Promise<ReviewResult>;
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

  async runReview(request: ReviewRequest, signal?: AbortSignal): Promise<ReviewResult> {
    const startTime = Date.now();
    const schemaStr = JSON.stringify(REVIEW_OUTPUT_SCHEMA);

    const args = [
      "-p",
      "--bare",
      "--output-format",
      "json",
      "--json-schema",
      schemaStr,
      "--system-prompt",
      request.systemPrompt,
      "--tools",
      "Read,Bash(git diff*),Bash(git log*),Bash(git show*),Bash(gh pr view*),Bash(gh pr list*)",
      "--add-dir",
      request.repoPath,
      "--dangerously-skip-permissions",
      "--no-session-persistence",
      request.diff,
    ];

    const output = await this.execClaude(args, signal);
    const parsed = JSON.parse(output);

    let reviewOutput: AIReviewOutput;
    if (parsed.structured_output) {
      reviewOutput = parsed.structured_output;
    } else if (parsed.result) {
      reviewOutput = this.extractJsonFromText(parsed.result);
    } else {
      reviewOutput = this.extractJsonFromText(output);
    }

    return {
      summary: reviewOutput.summary || "No summary provided.",
      items: reviewOutput.items || [],
      rawOutput: output,
      durationMs: Date.now() - startTime,
    };
  }

  private execClaude(args: string[], signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn("claude", args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      if (signal) {
        if (signal.aborted) {
          proc.kill("SIGTERM");
          reject(new Error("Review cancelled"));
          return;
        }
        signal.addEventListener("abort", () => {
          proc.kill("SIGTERM");
          reject(new Error("Review cancelled"));
        }, { once: true });
      }

      const timeout = setTimeout(() => {
        proc.kill("SIGTERM");
        reject(new Error("Review timed out after 10 minutes"));
      }, 10 * 60 * 1000);

      proc.on("close", (code) => {
        clearTimeout(timeout);
        if (signal?.aborted) return;
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(
            new Error(`Claude exited with code ${code}: ${stderr || stdout}`)
          );
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timeout);
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

export function createProvider(name: string): AIProvider {
  switch (name) {
    case "claude":
      return new ClaudeProvider();
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}
