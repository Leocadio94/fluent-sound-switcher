// Cuts a release: bump the three version manifests, close the CHANGELOG
// section, commit, tag and push.
//
//   pnpm release 0.3.0
//   pnpm release 0.3.0 --dry-run    # print what it would do, change nothing
//   pnpm release 0.3.0 --no-push    # commit and tag locally only
//
// Pushing the tag publishes a GitHub Release and hands it to every installed
// copy through the updater, so this refuses to run on anything it is not sure
// about rather than asking for confirmation it cannot get in a script.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const version = args.find((a) => !a.startsWith("-"));
const dryRun = args.includes("--dry-run");
const noPush = args.includes("--no-push");

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

function git(...cmd) {
  return execFileSync("git", cmd, { encoding: "utf8" }).trim();
}

/** Runs a command, streaming its output; throws if it fails. */
function run(cmd, cmdArgs) {
  execFileSync(cmd, cmdArgs, { stdio: "inherit", shell: process.platform === "win32" });
}

if (!version) {
  fail("usage: pnpm release <version> [--dry-run] [--no-push]\n  e.g. pnpm release 0.3.0");
}
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  fail(`"${version}" is not a version. Expected x.y.z, without a leading "v".`);
}

const tag = `v${version}`;

// ---------------------------------------------------------------- checks

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== "master") {
  fail(`Releases are cut from master; you are on "${branch}".`);
}

if (git("status", "--porcelain")) {
  fail("The working tree has uncommitted changes. Commit or stash them first.");
}

const tags = git("tag", "--list").split("\n");
if (tags.includes(tag)) {
  fail(`Tag ${tag} already exists.`);
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const current = pkg.version;
const isNewer = (a, b) => {
  const [x, y, z] = a.split(".").map(Number);
  const [p, q, r] = b.split(".").map(Number);
  return x !== p ? x > p : y !== q ? y > q : z > r;
};
if (!isNewer(version, current)) {
  fail(`${version} is not newer than the current ${current}.`);
}

// The release notes come from this section; without it the release page would
// carry whatever the previous version said.
const changelog = readFileSync("CHANGELOG.md", "utf8");
if (!changelog.includes("## [Unreleased]")) {
  fail(
    "CHANGELOG.md has no `## [Unreleased]` section to turn into " +
      `${version}. Write the notes first.`,
  );
}
const unreleased = changelog
  .split("## [Unreleased]")[1]
  .split(/^## \[/m)[0]
  .trim();
if (!unreleased) {
  fail("The `## [Unreleased]` section is empty. Write the notes first.");
}

console.log(`\n  ${current} → ${version}   (tag ${tag}, branch ${branch})`);
console.log(`  ${unreleased.split("\n").length} lines of notes ready\n`);

if (dryRun) {
  console.log("  --dry-run: nothing was changed.\n");
  process.exit(0);
}

// ------------------------------------------------------- verify, then bump

// Tagging publishes to users, so the checks run before anything is written.
console.log("  running checks...\n");
run("pnpm", ["exec", "tsc", "--noEmit"]);
run("pnpm", ["exec", "vitest", "run"]);
run("cargo", ["fmt", "--manifest-path", "src-tauri/Cargo.toml", "--all", "--", "--check"]);
run("cargo", [
  "clippy",
  "--manifest-path",
  "src-tauri/Cargo.toml",
  "--all-targets",
  "--",
  "-D",
  "warnings",
]);
run("cargo", ["test", "--manifest-path", "src-tauri/Cargo.toml"]);

function replaceOnce(file, from, to) {
  const text = readFileSync(file, "utf8");
  if (!text.includes(from)) fail(`Could not find ${from} in ${file}.`);
  writeFileSync(file, text.replace(from, to));
  console.log(`  updated ${file}`);
}

console.log("");
replaceOnce("package.json", `"version": "${current}"`, `"version": "${version}"`);
replaceOnce(
  "src-tauri/tauri.conf.json",
  `"version": "${current}"`,
  `"version": "${version}"`,
);
replaceOnce("src-tauri/Cargo.toml", `version = "${current}"`, `version = "${version}"`);

const today = new Date().toISOString().slice(0, 10);
replaceOnce("CHANGELOG.md", "## [Unreleased]", `## [${version}] - ${today}`);

// Cargo.lock carries the version too, and a stale one makes the build dirty.
run("cargo", ["check", "--manifest-path", "src-tauri/Cargo.toml", "--quiet"]);

// The workflow refuses to build a tag whose manifests disagree; catch it here.
run("node", ["scripts/check-version.mjs", tag]);

// ------------------------------------------------------- commit, tag, push

git("add", "-A");
git("commit", "-m", `chore: release ${tag}`);
git("tag", "-a", tag, "-m", `Fluent Sound Switcher ${version}`);
console.log(`\n  committed and tagged ${tag}`);

if (noPush) {
  console.log(`\n  --no-push: run \`git push origin master && git push origin ${tag}\` when ready.\n`);
  process.exit(0);
}

git("push", "origin", "master");
git("push", "origin", tag);

console.log(`
  pushed ${tag}. The release workflow is building:
  https://github.com/Leocadio94/fluent-sound-switcher/actions
`);
