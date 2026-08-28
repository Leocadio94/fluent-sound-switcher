// Builds the GitHub release body: the CHANGELOG section for this version, plus
// a download table, the SmartScreen note and a compare link.
//
// Prints to stdout; the workflow captures it into the tauri-action input.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const tag = process.argv[2];
if (!tag) {
  console.error("usage: node scripts/release-notes.mjs <tag>");
  process.exit(2);
}
const version = tag.replace(/^v/, "");
const repo = process.env.GITHUB_REPOSITORY ?? "Leocadio94/fluent-sound-switcher";

/**
 * The notes for a version.
 *
 * The CHANGELOG is written for whoever works on the code: phase by phase, and
 * long. A release page is read by whoever installs the thing. So when a section
 * marks a highlights block, that is what ships; otherwise the whole section
 * does, which keeps this working for a version nobody wrote a summary for.
 */
function changelogSection(version) {
  const changelog = readFileSync("CHANGELOG.md", "utf8");
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith("## ["));
  const section = end === -1 ? rest : rest.slice(0, end);

  const from = section.findIndex((l) => l.trim() === "<!-- release-notes -->");
  const to = section.findIndex((l) => l.trim() === "<!-- /release-notes -->");
  if (from !== -1 && to > from) {
    return section.slice(from + 1, to).join("\n").trim();
  }
  return section.join("\n").trim();
}

/** The previous `v*` tag, for the compare link. Absent on the first release. */
function previousTag(tag) {
  try {
    return execSync(`git describe --tags --abbrev=0 --match "v*" ${tag}^`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

const section = changelogSection(version);
if (!section) {
  // Not fatal: a release with a generic body still beats a failed publish.
  console.error(`warning: no "## [${version}]" section found in CHANGELOG.md`);
}

const previous = previousTag(tag);

const parts = [
  section ?? `Release ${version}.`,
  "",
  "## Download",
  "",
  "| Installer | When to use |",
  "| --- | --- |",
  "| `.msi` | Standard Windows Installer package. |",
  "| `-setup.exe` (NSIS) | Smaller installer; also what the auto-updater uses. |",
  "",
  "> The app is not signed with an Authenticode certificate yet, so Windows",
  "> SmartScreen shows a warning on first run. Choose **More info → Run anyway**.",
  "> Verify the download against `SHA256SUMS.txt` if you want to be sure.",
];

if (previous) {
  parts.push("", `**Full changelog**: https://github.com/${repo}/compare/${previous}...${tag}`);
}

console.log(parts.join("\n"));
