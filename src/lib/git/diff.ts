import simpleGit, { SimpleGit } from "simple-git";
import fs from "fs";
import path from "path";

function getGit(repoPath: string): SimpleGit {
  const resolved = path.resolve(repoPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Path does not exist: ${resolved}`);
  }
  return simpleGit(resolved);
}

export async function getRepoInfo(repoPath: string) {
  const git = getGit(repoPath);

  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    throw new Error(`Not a git repository: ${repoPath}`);
  }

  const branches = await git.branch();
  const defaultBranch = await detectDefaultBranch(git);

  return {
    currentBranch: branches.current,
    defaultBranch,
    branches: branches.all.filter((b) => !b.startsWith("remotes/")),
  };
}

export async function getDiff(
  repoPath: string,
  branch: string,
  baseBranch: string
) {
  const git = getGit(repoPath);
  return git.diff([`${baseBranch}...${branch}`, "--find-renames", "-U3"]);
}

export async function getDiffStats(
  repoPath: string,
  branch: string,
  baseBranch: string
) {
  const git = getGit(repoPath);
  const [summary, nameStatusRaw] = await Promise.all([
    git.diffSummary([`${baseBranch}...${branch}`, "--find-renames"]),
    git.raw("diff", "--name-status", "--find-renames", `${baseBranch}...${branch}`),
  ]);

  const statusMap = new Map<string, string>();
  for (const line of nameStatusRaw.trim().split("\n")) {
    if (!line) continue;
    const parts = line.split("\t");
    const status = parts[0][0];
    const file = status === "R" ? parts[2] : parts[1];
    if (file) statusMap.set(file, status);
  }

  return {
    files: summary.files.map((f) => ({
      file: f.file,
      insertions: "insertions" in f ? f.insertions : 0,
      deletions: "deletions" in f ? f.deletions : 0,
      binary: f.binary,
      status: statusMap.get(f.file) || "M",
    })),
    totalInsertions: summary.insertions,
    totalDeletions: summary.deletions,
    totalFiles: summary.files.length,
  };
}

export async function getCommitHash(
  repoPath: string,
  branch: string
): Promise<string> {
  const git = getGit(repoPath);
  const log = await git.log({ maxCount: 1, from: branch });
  return log.latest?.hash ?? "unknown";
}

async function detectDefaultBranch(git: SimpleGit): Promise<string> {
  try {
    const remoteInfo = await git.raw(
      "symbolic-ref",
      "refs/remotes/origin/HEAD"
    );
    const match = remoteInfo.trim().replace("refs/remotes/origin/", "");
    if (match) return match;
  } catch {
    // no remote or no symbolic ref set
  }

  const branches = await git.branchLocal();
  for (const name of ["main", "master", "develop", "development"]) {
    if (branches.all.includes(name)) return name;
  }
  return branches.all[0] || "main";
}
