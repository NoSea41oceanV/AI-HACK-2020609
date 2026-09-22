#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";
const git = isWindows ? "git.exe" : "git";
const failures = [];
const warnings = [];

function report(level, message) {
  const marker = { PASS: "[PASS]", FAIL: "[FAIL]", WARN: "[WARN]", INFO: "[INFO]" }[level];
  console.log(`${marker} ${message}`);
  if (level === "FAIL") failures.push(message);
  if (level === "WARN") warnings.push(message);
}

function run(label, command, args) {
  console.log(`\n== ${label} ==`);
  const executable = isWindows ? (process.env.ComSpec ?? "cmd.exe") : command;
  const executableArgs = isWindows ? ["/d", "/s", "/c", command, ...args] : args;
  const result = spawnSync(executable, executableArgs, { cwd: root, encoding: "utf8", stdio: "pipe" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    report("FAIL", `${label}: 実行できませんでした (${result.error.code ?? result.error.name})`);
    return;
  }
  if (result.status === 0) report("PASS", label);
  else report("FAIL", `${label}: exit ${result.status ?? "unknown"}`);
}

run("TypeScript typecheck", npm, ["run", "typecheck"]);
run("Application tests", npm, ["test"]);
run("Production build", npm, ["run", "build"]);
run("Worker tests", npm, ["--prefix", "worker", "test"]);
run("Git diff whitespace check", git, ["diff", "--check"]);

const excludedDirectories = new Set([
  ".git",
  ".firebase",
  ".wrangler",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".cache",
  "tmp",
]);
const excludedExtensions = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".mp4", ".mov", ".webm",
  ".woff", ".woff2", ".ttf", ".lock",
]);
const maxScanBytes = 2 * 1024 * 1024;

function sourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) files.push(...sourceFiles(join(directory, entry.name)));
      continue;
    }
    const isPrivateEnv = /^\.env(?:\.|$)/i.test(entry.name) && !/^\.env\.example$/i.test(entry.name);
    if (!entry.isFile() || isPrivateEnv || excludedExtensions.has(extname(entry.name).toLowerCase())) continue;
    const path = join(directory, entry.name);
    if (statSync(path).size <= maxScanBytes) files.push(path);
  }
  return files;
}

const secretPatterns = [
  ["private key block", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["JSON private_key", /["']private_key["']\s*:\s*["']-----BEGIN/],
  ["Authorization Bearer credential", /authorization\s*[:=]\s*["'`]Bearer\s+(?!\$\{|<|example|dummy|test|redacted)[A-Za-z0-9._~+\/-]{16,}/i],
  ["Google API key", /AIza[0-9A-Za-z_-]{35}/],
  ["GitHub token", /gh(?:p|o|u|s|r)_[A-Za-z0-9]{30,}/],
  ["OpenAI-style key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/],
  ["assigned API secret", /(?:ORCAROUTER_API_KEY|CLOUDFLARE_API_TOKEN|FIREBASE_PRIVATE_KEY)\s*[:=]\s*["']?(?!\s*(?:"|'|<|\$\{|process\.env|env\.|example|dummy|test|redacted|your[_-]))[A-Za-z0-9_+\/.=-]{20,}/i],
];

console.log("\n== Secret scan ==");
let scanned = 0;
let secretFindings = 0;
for (const path of sourceFiles(root)) {
  const bytes = readFileSync(path);
  if (bytes.includes(0)) continue;
  const content = bytes.toString("utf8");
  scanned += 1;
  for (const [kind, pattern] of secretPatterns) {
    if (pattern.test(content)) {
      secretFindings += 1;
      report("FAIL", `秘密情報候補 (${kind}) を検出: ${relative(root, path)}`);
    }
  }
}
if (secretFindings === 0) report("PASS", `秘密情報候補なし (${scanned} files; 値は出力しません)`);

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
  } catch (error) {
    report("FAIL", `${label} を読み取れません: ${error instanceof Error ? error.message : "unknown error"}`);
    return null;
  }
}

console.log("\n== Firebase / Cloudflare static safety ==");
const firebase = readJson("firebase.json", "firebase.json");
if (firebase) {
  if (Object.hasOwn(firebase, "functions")) report("FAIL", "firebase.json に Cloud Functions 構成があります");
  else report("PASS", "firebase.json に Cloud Functions 構成なし");
  if (Object.hasOwn(firebase, "storage")) report("FAIL", "firebase.json に Cloud Storage 構成があります");
  else report("PASS", "firebase.json に Cloud Storage 構成なし");
  if (firebase.firestore && firebase.hosting) report("PASS", "Firebase は Firestore + Hosting 構成");
  else report("WARN", "Firebase の Firestore + Hosting 構成を確認してください");
}

let forbiddenFirebaseUsage = false;
for (const path of sourceFiles(join(root, "src"))) {
  const content = readFileSync(path, "utf8");
  if (/firebase\/(?:functions|storage)|\bgetFunctions\s*\(|\bgetStorage\s*\(|cloudfunctions\.net/i.test(content)) {
    forbiddenFirebaseUsage = true;
    report("FAIL", `Cloud Functions / Storage の利用候補を検出: ${relative(root, path)}`);
  }
}
if (!forbiddenFirebaseUsage) report("PASS", "アプリソースに Cloud Functions / Storage 利用候補なし");

function extractBraceBlock(text, marker) {
  const start = text.indexOf(marker);
  if (start < 0) return null;
  const open = text.indexOf("{", start + marker.length);
  if (open < 0) return null;
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    if (text[index] === "}") depth -= 1;
    if (depth === 0) return text.slice(open + 1, index);
  }
  return null;
}

try {
  const rules = readFileSync(join(root, "firestore.rules"), "utf8");
  const intakeBlock = extractBraceBlock(rules, "match /demoIntakes/{intakeId}");
  const facilityGuardBlock = extractBraceBlock(rules, "function isActiveFacility(facilityId)");
  const hasAuthenticatedFacilityGuard =
    facilityGuardBlock &&
    /request\.auth\s*!=\s*null/m.test(facilityGuardBlock) &&
    /(?:facilityId\s*==\s*request\.auth\.uid|request\.auth\.uid\s*==\s*facilityId)/m.test(facilityGuardBlock);
  const hasFacilityScopedRead =
    intakeBlock &&
    /allow\s+get\s*:\s*if\s+isActiveFacility\(facilityId\)\s*;/m.test(intakeBlock) &&
    /allow\s+list\s*:\s*if\s+isActiveFacility\(facilityId\)\b/m.test(intakeBlock);
  if (!intakeBlock) {
    report("FAIL", "Firestore Rules に demoIntakes 規則がありません");
  } else if (/allow\s+read(?:\s*,[^:]*)?\s*:\s*if\s+false\s*;/m.test(intakeBlock)) {
    report("PASS", "demoIntakes の公開 read は明示的に拒否");
  } else if (hasAuthenticatedFacilityGuard && hasFacilityScopedRead) {
    report("PASS", "demoIntakes の read は認証済みの同一施設に限定");
  } else {
    report("FAIL", "demoIntakes の公開read拒否または施設境界を確認できません");
  }
} catch (error) {
  report("FAIL", `firestore.rules を読み取れません: ${error instanceof Error ? error.message : "unknown error"}`);
}

for (const candidate of ["wrangler.toml", "wrangler.toml.example"]) {
  try {
    const text = readFileSync(join(root, candidate), "utf8");
    if (/\[\[\s*r2_buckets\s*\]\]|\bbinding\s*=\s*["']MEDIA_BUCKET["']/i.test(text)) {
      const level = candidate === "wrangler.toml" ? "FAIL" : "WARN";
      report(level, `${candidate} に R2 binding があります。Spark / Workers Free限定（R2なし）の受入条件と要確認`);
    } else {
      report("PASS", `${candidate} に R2 binding なし`);
    }
  } catch {
    // Optional deployment config.
  }
}

console.log("\n== Summary ==");
console.log(`failures=${failures.length} warnings=${warnings.length}`);
if (warnings.length) console.log("警告は受入条件との手動確認が必要です。");
process.exitCode = failures.length ? 1 : 0;
