export interface DiffChunk {
  index: number;
  files: string[];
  content: string;
}

interface FileDiff {
  path: string;
  content: string;
}

function splitByFile(fullDiff: string): FileDiff[] {
  const fileDiffs: FileDiff[] = [];
  const fileHeaders = fullDiff.split(/(?=^diff --git )/m);

  for (const header of fileHeaders) {
    if (!header.trim()) continue;
    const match = header.match(/^diff --git a\/(.+?) b\//);
    const filePath = match?.[1] ?? "unknown";
    fileDiffs.push({ path: filePath, content: header });
  }

  return fileDiffs;
}

function splitByHunk(
  fileDiff: FileDiff,
  maxChars: number
): { files: string[]; parts: string[]; chars: number }[] {
  const chunks: { files: string[]; parts: string[]; chars: number }[] = [];
  const hunks = fileDiff.content.split(/(?=^@@ )/m);

  const fileHeader = hunks[0] ?? "";
  let current = { files: [fileDiff.path], parts: [fileHeader], chars: fileHeader.length };

  for (let i = 1; i < hunks.length; i++) {
    const hunk = hunks[i];
    if (current.chars + hunk.length > maxChars && current.parts.length > 1) {
      chunks.push(current);
      current = { files: [fileDiff.path], parts: [fileHeader], chars: fileHeader.length };
    }
    current.parts.push(hunk);
    current.chars += hunk.length;
  }

  if (current.parts.length > 1) {
    chunks.push(current);
  }

  return chunks;
}

export function chunkDiff(
  fullDiff: string,
  maxCharsPerChunk = 40000
): DiffChunk[] {
  const fileDiffs = splitByFile(fullDiff);

  if (fileDiffs.length === 0) {
    return [{ index: 0, files: [], content: fullDiff }];
  }

  const chunks: DiffChunk[] = [];
  let currentChunk = { files: [] as string[], parts: [] as string[], chars: 0 };

  for (const fileDiff of fileDiffs) {
    if (fileDiff.content.length > maxCharsPerChunk) {
      if (currentChunk.parts.length > 0) {
        chunks.push({
          index: chunks.length,
          files: currentChunk.files,
          content: currentChunk.parts.join(""),
        });
        currentChunk = { files: [], parts: [], chars: 0 };
      }
      const hunkChunks = splitByHunk(fileDiff, maxCharsPerChunk);
      for (const hc of hunkChunks) {
        chunks.push({
          index: chunks.length,
          files: hc.files,
          content: hc.parts.join(""),
        });
      }
      continue;
    }

    if (currentChunk.chars + fileDiff.content.length > maxCharsPerChunk) {
      chunks.push({
        index: chunks.length,
        files: currentChunk.files,
        content: currentChunk.parts.join(""),
      });
      currentChunk = { files: [], parts: [], chars: 0 };
    }

    currentChunk.files.push(fileDiff.path);
    currentChunk.parts.push(fileDiff.content);
    currentChunk.chars += fileDiff.content.length;
  }

  if (currentChunk.parts.length > 0) {
    chunks.push({
      index: chunks.length,
      files: currentChunk.files,
      content: currentChunk.parts.join(""),
    });
  }

  return chunks;
}
