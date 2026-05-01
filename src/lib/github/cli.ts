import { exec, execFile, spawn } from "child_process";
import { promisify } from "util";
import { getRepoInfo } from "../git/diff";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

function spawnWithStdin(
  cmd: string,
  args: string[],
  cwd: string,
  stdin: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`${cmd} exited ${code}: ${stderr}`));
      else resolve({ stdout, stderr });
    });
    child.stdin.write(stdin);
    child.stdin.end();
  });
}

export interface PRInfo {
  prNumber: number;
  prUrl: string;
  commitId: string;
}

export function parseOwnerRepo(remoteUrl: string): string | null {
  const httpsMatch = remoteUrl.match(
    /github(?:-sec\.washington\.palantircloud)?\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/
  );
  if (httpsMatch) return httpsMatch[1];
  return null;
}

export async function getPRForBranch(
  repoPath: string,
  branch: string
): Promise<PRInfo | null> {
  try {
    const { stdout } = await execAsync(
      `gh pr list --head ${JSON.stringify(branch)} --state open --json number,url,headRefOid --limit 1`,
      { cwd: repoPath }
    );
    const prs = JSON.parse(stdout.trim() || "[]");
    if (prs.length === 0) return null;
    return {
      prNumber: prs[0].number,
      prUrl: prs[0].url,
      commitId: prs[0].headRefOid,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT") || msg.includes("not found")) {
      throw new Error(
        "GitHub CLI (gh) is not installed. Install it from https://cli.github.com/"
      );
    }
    if (msg.includes("gh auth login")) {
      throw new Error(
        "GitHub CLI is not authenticated. Run `gh auth login` in your terminal."
      );
    }
    throw err;
  }
}

export async function postPRComment(
  repoPath: string,
  prNumber: number,
  body: string
): Promise<{ commentUrl: string }> {
  const { stdout } = await execFileAsync(
    "gh",
    ["pr", "comment", String(prNumber), "--body", body],
    { cwd: repoPath }
  );
  const urlMatch = stdout.match(/(https:\/\/\S+)/);
  return { commentUrl: urlMatch?.[1] ?? "" };
}

export async function postPRReviewComment(
  repoPath: string,
  prNumber: number,
  body: string,
  filePath: string,
  line: number,
  commitId: string,
  startLine?: number
): Promise<{ prCommentId: number; commentUrl: string }> {
  const { remoteUrl } = await getRepoInfo(repoPath);
  const ownerRepo = remoteUrl ? parseOwnerRepo(remoteUrl) : null;
  if (!ownerRepo) {
    throw new Error("Could not determine GitHub owner/repo from remote URL");
  }

  const comment: Record<string, unknown> = {
    path: filePath,
    line,
    side: "RIGHT",
    body,
  };
  if (startLine && startLine !== line) {
    comment.start_line = startLine;
    comment.start_side = "RIGHT";
  }

  const reviewBody = JSON.stringify({
    commit_id: commitId,
    event: "COMMENT",
    comments: [comment],
  });

  const { stdout } = await spawnWithStdin(
    "gh",
    [
      "api",
      `repos/${ownerRepo}/pulls/${prNumber}/reviews`,
      "--method", "POST",
      "--input", "-",
    ],
    repoPath,
    reviewBody
  );

  const result = JSON.parse(stdout);
  const postedComment = result.comments?.[0];
  return {
    prCommentId: postedComment?.id ?? result.id,
    commentUrl: postedComment?.html_url ?? result.html_url ?? "",
  };
}
