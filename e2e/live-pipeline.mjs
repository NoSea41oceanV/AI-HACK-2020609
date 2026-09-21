#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const required = ["QA_APP_URL", "QA_WORKER_URL"];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`[SKIP] 実ネットワークE2Eは未実行です。不足: ${missing.join(", ")}`);
  console.error("QA_APP_URL と QA_WORKER_URL に配備済みHTTPS URLを設定してください。秘密鍵は不要です。");
  process.exit(2);
}

function httpsUrl(name) {
  const value = process.env[name].trim().replace(/\/$/, "");
  const url = new URL(value);
  if (url.protocol !== "https:" && !(process.env.QA_ALLOW_HTTP_LOCALHOST === "true" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error(`${name} はHTTPS URLにしてください（localhostは QA_ALLOW_HTTP_LOCALHOST=true の場合のみ許可）`);
  }
  if (url.username || url.password) throw new Error(`${name} に認証情報を埋め込まないでください`);
  return url;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateAnalysisResponse(payload) {
  assert(payload && typeof payload === "object" && !Array.isArray(payload), "分析応答はobject必須");
  assert(payload.ok === true, "分析応答 ok=true 必須");
  assert(typeof payload.requestId === "string" && payload.requestId.length > 0, "requestId必須");
  assert(typeof payload.model === "string" && payload.model.length > 0, "model必須");
  const analysis = payload.analysis;
  assert(analysis && typeof analysis === "object" && !Array.isArray(analysis), "analysis object必須");
  const expected = ["summary", "observations", "personalityTraits", "compatibilitySignals", "riskFlags", "confidence", "matchingProfile"];
  assert(expected.every((key) => Object.hasOwn(analysis, key)), "analysis必須キー不足");
  assert(typeof analysis.summary === "string" && analysis.summary.length <= 2_000, "summary形式不正");
  assert(isStringArray(analysis.observations) && analysis.observations.length <= 50, "observations形式不正");
  assert(isStringArray(analysis.compatibilitySignals) && analysis.compatibilitySignals.length <= 50, "compatibilitySignals形式不正");
  assert(isStringArray(analysis.riskFlags) && analysis.riskFlags.length <= 50, "riskFlags形式不正");
  assert(Number.isFinite(analysis.confidence) && analysis.confidence >= 0 && analysis.confidence <= 1, "confidence形式不正");
  assert(Array.isArray(analysis.personalityTraits) && analysis.personalityTraits.every((trait) =>
    trait && typeof trait === "object" && typeof trait.label === "string" && typeof trait.evidence === "string" &&
    Number.isFinite(trait.confidence) && trait.confidence >= 0 && trait.confidence <= 1), "personalityTraits形式不正");
  const profile = analysis.matchingProfile;
  const profileKeys = ["energyLevel", "sociability", "anxietyLevel", "assertiveness", "resourceGuarding", "playStyles"];
  assert(profile && typeof profile === "object" && !Array.isArray(profile), "matchingProfile object必須");
  assert(Object.keys(profile).length === profileKeys.length && profileKeys.every((key) => Object.hasOwn(profile, key)), "matchingProfileキー不正");
  for (const key of ["energyLevel", "sociability", "anxietyLevel", "assertiveness"]) {
    assert(Number.isInteger(profile[key]) && profile[key] >= 1 && profile[key] <= 5, `${key}は1..5の整数必須`);
  }
  assert(Number.isInteger(profile.resourceGuarding) && profile.resourceGuarding >= 0 && profile.resourceGuarding <= 5, "resourceGuardingは0..5の整数必須");
  const allowedStyles = new Set(["chase", "wrestle", "tug", "fetch", "gentle", "solo"]);
  assert(isStringArray(profile.playStyles) && profile.playStyles.every((style) => allowedStyles.has(style)), "playStyles形式不正");
  assert(new Set(profile.playStyles).size === profile.playStyles.length, "playStyles重複禁止");
}

const mediaTypes = new Map([
  [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".png", "image/png"], [".webp", "image/webp"],
]);

async function fixtureMedia() {
  assert(!process.env.QA_VIDEO_FIXTURE, "QA_VIDEO_FIXTUREは送信できません。Owner UIと同様にブラウザ内で抽出したJPEGフレームだけを使用してください");
  const fixtures = [process.env.QA_PHOTO_FIXTURE].filter(Boolean);
  if (!fixtures.length) return [];
  if (process.env.QA_SEND_MEDIA !== "true") {
    throw new Error("fixtureが指定されていますが外部送信は停止しました。送信を明示する場合だけ QA_SEND_MEDIA=true を設定してください");
  }
  const media = [];
  for (const fixture of fixtures) {
    const path = resolve(fixture);
    const contentType = mediaTypes.get(extname(path).toLowerCase());
    assert(contentType, `未対応fixture形式: ${extname(path)}`);
    const bytes = await readFile(path);
    const max = 5 * 1024 * 1024;
    assert(bytes.length <= max, `fixtureが上限超過: ${contentType}`);
    media.push({
      type: "image",
      dataUrl: `data:${contentType};base64,${bytes.toString("base64")}`,
    });
  }
  assert(media.length <= 1, "画像fixtureは1件まで");
  return media;
}

async function fetchJson(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(60_000) });
  const type = response.headers.get("content-type") ?? "";
  assert(type.includes("application/json"), `${url.pathname} のContent-TypeがJSONではありません`);
  const payload = await response.json();
  assert(response.ok, `${url.pathname} failed: HTTP ${response.status}, code=${payload?.error?.code ?? "unknown"}`);
  return payload;
}

try {
  const appUrl = httpsUrl("QA_APP_URL");
  const workerUrl = httpsUrl("QA_WORKER_URL");
  console.log("[INFO] 実キー・飼い主名・連絡先・音声は送信しません");

  const appResponse = await fetch(appUrl, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
  assert(appResponse.ok, `アプリGET失敗: HTTP ${appResponse.status}`);
  assert((appResponse.headers.get("content-type") ?? "").includes("text/html"), "アプリGETがHTMLではありません");
  console.log("[PASS] deployed app GET");

  const healthUrl = new URL("/health", `${workerUrl}/`);
  const workerHeaders = { origin: appUrl.origin };
  const health = await fetchJson(healthUrl, { headers: workerHeaders });
  assert(health.ok === true && health.service === "pet-hotel-agent-api", "health応答構造不正");
  assert(health.orcaRouterConfigured === true, "OrcaRouterがWorkerに設定されていません");
  assert(typeof health.mediaStorageConfigured === "boolean", "health.mediaStorageConfigured形式不正");
  assert(health.mediaStorageConfigured === false, "R2等のmedia storageが有効です。R2なし受入条件に違反します");
  console.log("[PASS] worker health + OrcaRouter configured");

  const prompt = process.env.QA_SAFE_PROMPT?.trim() || "ほかの犬にはゆっくり近づき、短い追いかけっこを好みます。食事中は一頭で落ち着ける場所を選びます。";
  assert(prompt.length > 0 && prompt.length <= 2_000, "QA_SAFE_PROMPTは1..2000文字にしてください");
  const forbiddenPii = /(?:@|\b0\d{1,4}-?\d{1,4}-?\d{3,4}\b|飼い主|電話|メール|住所|音声)/i;
  assert(!forbiddenPii.test(prompt), "QA_SAFE_PROMPTにPII/音声を示す文字列があります。非PIIの行動記述だけを使用してください");
  const media = await fixtureMedia();
  const analyzeUrl = new URL("/api/analyze", `${workerUrl}/`);
  const analysis = await fetchJson(analyzeUrl, {
    method: "POST",
    headers: { ...workerHeaders, "content-type": "application/json", "x-request-id": `qa-${crypto.randomUUID()}` },
    body: JSON.stringify({ prompt, ...(media.length ? { media } : {}) }),
  });
  validateAnalysisResponse(analysis);
  console.log(`[PASS] real AI structured analysis (${media.length ? `${media.length} explicit fixture(s)` : "text only"})`);
  console.log("[PASS] live pipeline network probe completed; Firestore/room assignment/confirmation remain browser E2E checks");
} catch (error) {
  console.error(`[FAIL] ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
}
