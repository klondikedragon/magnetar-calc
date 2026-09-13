import { execFileSync } from "node:child_process";

export const developmentVersion = "vdev-local";

export function readBuildVersion({ cwd = process.cwd(), run = execFileSync } = {}) {
  const git = (args) => run("git", ["-c", `safe.directory=${cwd}`, ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  try {
    const date = git(["show", "-s", "--format=%cs", "HEAD"]);
    const hash = git(["rev-parse", "HEAD"]).slice(0, 6).toLowerCase();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[0-9a-f]{6}$/.test(hash)) return developmentVersion;
    return `v${date}-${hash}`;
  } catch {
    return developmentVersion;
  }
}
