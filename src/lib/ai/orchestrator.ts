import { createProvider } from "./provider";
import { buildSystemPrompt, buildUserPrompt, buildUserPromptWithDiff, DEFAULT_BASE_INSTRUCTIONS_API } from "./prompt-builder";
import { getDiffStats, getCommitHash, getDiff } from "../git/diff";
import {
  updateSessionStatus,
  updateSessionChunks,
  updateSessionDiffStats,
} from "../db/sessions";
import { insertReviewItem } from "../db/review-items";
import { getRelevantRules, incrementTimesApplied } from "../db/rules";
import { getFewShotExamples } from "../db/ratings";
import path from "path";
import { getGuidanceContents } from "../db/guidance";
import { getSkipExtensions } from "../db/settings";
import { emitSSE } from "./sse";

const MAX_FILES_PER_CHUNK = 15;

const globalForReviews = globalThis as typeof globalThis & {
  __activeReviews?: Map<number, AbortController>;
};
if (!globalForReviews.__activeReviews) {
  globalForReviews.__activeReviews = new Map();
}
const activeReviews = globalForReviews.__activeReviews;

export function cancelReview(sessionId: number): boolean {
  const controller = activeReviews.get(sessionId);
  if (controller) {
    controller.abort();
    activeReviews.delete(sessionId);
    return true;
  }
  return false;
}

function getFileExtensions(files: string[]): string[] {
  const exts = new Set<string>();
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    if (ext) exts.add(ext);
  }
  return [...exts];
}

function chunkFiles(files: string[]): string[][] {
  if (files.length <= MAX_FILES_PER_CHUNK) return [files];

  const chunks: string[][] = [];
  for (let i = 0; i < files.length; i += MAX_FILES_PER_CHUNK) {
    chunks.push(files.slice(i, i + MAX_FILES_PER_CHUNK));
  }
  return chunks;
}

export async function runReview(sessionId: number, repoPath: string, branch: string, baseBranch: string, providerName: string, customBasePrompt?: string) {
  const controller = new AbortController();
  activeReviews.set(sessionId, controller);

  updateSessionStatus(sessionId, "running");
  emitSSE(sessionId, "status", { status: "running", message: "Starting review..." });

  try {
    const [stats, commitHash] = await Promise.all([
      getDiffStats(repoPath, branch, baseBranch),
      getCommitHash(repoPath, branch),
    ]);

    if (stats.totalFiles === 0) {
      updateSessionStatus(sessionId, "completed");
      emitSSE(sessionId, "complete", { totalItems: 0, message: "No changes found between branches." });
      return;
    }

    updateSessionDiffStats(sessionId, JSON.stringify(stats));

    const SKIP_EXTENSIONS = new Set(getSkipExtensions());

    const allFiles = stats.files
      .filter((f) => {
        if (f.binary) return false;
        const ext = path.extname(f.file).toLowerCase();
        if (SKIP_EXTENSIONS.has(ext)) return false;
        return true;
      })
      .map((f) => f.file);

    const fileChunks = chunkFiles(allFiles);
    updateSessionChunks(sessionId, fileChunks.length, 0);
    emitSSE(sessionId, "progress", { chunksCompleted: 0, chunksTotal: fileChunks.length, itemsFound: 0 });

    const isApiProvider = providerName === "foundry";

    const allExtensions = getFileExtensions(allFiles);
    const rules = getRelevantRules(allExtensions);
    const examples = getFewShotExamples(allExtensions);
    const guidance = getGuidanceContents();
    const baseInstructions = customBasePrompt || (isApiProvider ? DEFAULT_BASE_INSTRUCTIONS_API : undefined);
    const systemPrompt = buildSystemPrompt(rules, guidance, examples, baseInstructions);

    if (rules.length > 0) {
      incrementTimesApplied(rules.map((r) => r.id));
    }

    let diffContent = "";
    if (isApiProvider) {
      diffContent = await getDiff(repoPath, branch, baseBranch);
    }

    const provider = createProvider(providerName);
    let totalItems = 0;
    let chunksCompleted = 0;
    const isSingleChunk = fileChunks.length === 1;

    const MAX_PARALLEL = 3;

    const processChunk = async (i: number) => {
      if (controller.signal.aborted) return;

      const fileGroup = fileChunks[i];

      emitSSE(sessionId, "status", {
        status: "running",
        message: isSingleChunk
          ? `Reviewing ${allFiles.length} files...`
          : `Reviewing chunk ${i + 1} of ${fileChunks.length} (${fileGroup.length} files)...`,
        files: fileGroup,
      });

      let userPrompt: string;
      if (isApiProvider) {
        const chunkDiff = isSingleChunk
          ? diffContent
          : filterDiffByFiles(diffContent, fileGroup);
        userPrompt = buildUserPromptWithDiff(
          branch,
          baseBranch,
          chunkDiff,
          isSingleChunk ? undefined : fileGroup
        );
      } else {
        userPrompt = buildUserPrompt(
          repoPath,
          branch,
          baseBranch,
          isSingleChunk ? undefined : fileGroup
        );
      }

      const result = await provider.runReview({
        diff: userPrompt,
        chunkIndex: i,
        chunkCount: fileChunks.length,
        repoPath,
        branch,
        baseBranch,
        systemPrompt,
      }, controller.signal, (activity) => {
        emitSSE(sessionId, "activity", activity);
      });

      if (i === 0 && result.summary) {
        const summaryId = insertReviewItem(sessionId, i, {
          category: "positive",
          title: "Review Summary",
          description: result.summary,
        });
        emitSSE(sessionId, "item", {
          id: summaryId,
          category: "positive",
          title: "Review Summary",
          description: result.summary,
        });
        totalItems++;
      }

      for (const item of result.items) {
        const itemId = insertReviewItem(sessionId, i, item);
        emitSSE(sessionId, "item", { id: itemId, ...item });
        totalItems++;
      }

      chunksCompleted++;
      updateSessionChunks(sessionId, fileChunks.length, chunksCompleted);
      emitSSE(sessionId, "progress", {
        chunksCompleted,
        chunksTotal: fileChunks.length,
        itemsFound: totalItems,
      });
    };

    if (isSingleChunk) {
      await processChunk(0);
    } else {
      for (let batch = 0; batch < fileChunks.length; batch += MAX_PARALLEL) {
        if (controller.signal.aborted) break;
        const batchIndices = fileChunks
          .slice(batch, batch + MAX_PARALLEL)
          .map((_, j) => batch + j);
        await Promise.all(batchIndices.map(processChunk));
      }
    }

    updateSessionStatus(sessionId, "completed");
    emitSSE(sessionId, "complete", {
      totalItems,
      commitHash,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      updateSessionStatus(sessionId, "cancelled");
      emitSSE(sessionId, "cancelled", { message: "Review cancelled by user" });
    } else {
      const message = error instanceof Error ? error.message : String(error);
      updateSessionStatus(sessionId, "failed", message);
      emitSSE(sessionId, "error", { message });
    }
  } finally {
    activeReviews.delete(sessionId);
  }
}

function filterDiffByFiles(fullDiff: string, files: string[]): string {
  const fileSet = new Set(files);
  const lines = fullDiff.split("\n");
  const result: string[] = [];
  let include = false;

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      const match = line.match(/b\/(.+)$/);
      include = match ? fileSet.has(match[1]) : false;
    }
    if (include) result.push(line);
  }

  return result.join("\n");
}
