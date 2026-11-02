// Run by `pnpm run deploy` before anything is built: what goes live is main as it was last pulled, all of it
// committed, so the version running can be traced to a commit. Prints that commit for the deploy's notes.
import { execFileSync } from "node:child_process";

function git(...args: ReadonlyArray<string>): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
const head = git("rev-parse", "HEAD");
const problems = [
  branch === "main" ? undefined : `the branch is ${branch}, not main`,
  git("status", "--porcelain") === "" ? undefined : "there are changes not committed",
  head === git("rev-parse", "origin/main") ? undefined : "HEAD is not origin/main: pull first",
].filter((problem) => problem !== undefined);

if (problems.length > 0) {
  throw new Error(`Not deploying: ${problems.join("; ")}.`);
}

console.log(`Deploying main at ${head}`);
