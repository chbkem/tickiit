const { spawnSync } = require("child_process");

const message = process.argv.slice(2).join(" ") || "Update from local";

function run(args) {
  const res = spawnSync("git", args, { stdio: "inherit" });
  if (res.error) throw res.error;
  if (res.status !== 0) process.exit(res.status);
  return res.status;
}

const branch = spawnSync("git", ["branch", "--show-current"], { encoding: "utf8" });
if (branch.error) throw branch.error;
const currentBranch = branch.stdout.trim();
if (!currentBranch) {
  console.error("error: not on a branch");
  process.exit(1);
}

run(["add", "-A"]);

const staged = spawnSync("git", ["diff", "--cached", "--quiet"]).status;
if (staged === 0) {
  console.log("Nothing new to commit.");
} else {
  run(["commit", "-m", message]);
}

run(["push", "origin", currentBranch]);
console.log(`Pushed "${currentBranch}" to "origin".`);