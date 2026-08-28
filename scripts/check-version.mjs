// Fails the release if the pushed tag does not match every version we ship.
//
// The version lives in three files and nothing kept them in sync, so it was
// possible to publish `v0.2.0` containing a binary that reports 0.1.2 — and the
// updater compares versions, so the mismatch would break update checks.
import { readFileSync } from "node:fs";

const tag = process.argv[2];
if (!tag) {
  console.error("usage: node scripts/check-version.mjs <tag>");
  process.exit(2);
}

const expected = tag.replace(/^v/, "");

const pkg = JSON.parse(readFileSync("package.json", "utf8")).version;
const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8")).version;

// Only the `[package]` version, not a dependency's.
const cargoToml = readFileSync("src-tauri/Cargo.toml", "utf8");
const cargo = cargoToml
  .split(/^\[/m)[1]
  ?.match(/^\s*version\s*=\s*"([^"]+)"/m)?.[1];

const sources = {
  "package.json": pkg,
  "src-tauri/Cargo.toml": cargo,
  "src-tauri/tauri.conf.json": conf,
};

const mismatched = Object.entries(sources).filter(([, v]) => v !== expected);
if (mismatched.length > 0) {
  console.error(`Tag ${tag} expects version ${expected}, but:`);
  for (const [file, value] of mismatched) {
    console.error(`  ${file}: ${value ?? "<not found>"}`);
  }
  process.exit(1);
}

console.log(`Version ${expected} consistent across all three manifests.`);
