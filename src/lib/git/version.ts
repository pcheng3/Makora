import simpleGit from "simple-git";

interface UpdateInfo {
  branch: string;
  versionLabel: string;
  localHash: string;
  commitsBehind: number;
  available: boolean;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
let cache: { data: UpdateInfo; timestamp: number } | null = null;

export async function checkForUpdates(): Promise<UpdateInfo> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return cache.data;
  }

  const fallback: UpdateInfo = {
    branch: "",
    versionLabel: "unknown",
    localHash: "",
    commitsBehind: 0,
    available: false,
  };

  try {
    const git = simpleGit(process.cwd());

    if (!(await git.checkIsRepo())) return fallback;

    const branch = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
    const localHash = (await git.revparse(["HEAD"])).trim().slice(0, 7);

    let versionLabel: string;
    if (branch === "main" || branch === "master") {
      const count = (await git.raw(["rev-list", "--count", "HEAD"])).trim();
      versionLabel = `#${count}`;
    } else {
      versionLabel = branch;
    }

    let commitsBehind = 0;
    try {
      await git.fetch(["origin", "main", "--quiet"]);
      const behind = (await git.raw(["rev-list", "HEAD..origin/main", "--count"])).trim();
      commitsBehind = parseInt(behind, 10) || 0;
    } catch {
      // no remote or no origin/main
    }

    const result: UpdateInfo = {
      branch,
      versionLabel,
      localHash,
      commitsBehind,
      available: commitsBehind > 0,
    };

    cache = { data: result, timestamp: Date.now() };
    return result;
  } catch {
    return fallback;
  }
}
