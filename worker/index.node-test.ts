import assert from "node:assert/strict";
import test from "node:test";

import { handleRequest, type Env } from "./index.ts";

const context = { waitUntil: (_promise: Promise<unknown>) => undefined };
const origin = "http://localhost:5173";
let ipCounter = 0;

const validAnalysis = {
  summary: "calm",
  observations: [],
  personalityTraits: [],
  compatibilitySignals: [],
  riskFlags: [],
  confidence: 0.8,
  matchingProfile: {
    energyLevel: 3,
    sociability: 4,
    anxietyLevel: 2,
    assertiveness: 2,
    resourceGuarding: 1,
    playStyles: ["gentle", "fetch"],
  },
};

function analyzeRequest(body: unknown): Request {
  ipCounter += 1;
  return new Request("https://worker.test/api/analyze", {
    method: "POST",
    headers: { origin, "content-type": "application/json", "cf-connecting-ip": `test-${ipCounter}` },
    body: JSON.stringify(body),
  });
}

const successfulFetch: typeof fetch = async () => Response.json({
  choices: [{ message: { content: JSON.stringify(validAnalysis) } }],
});

test("health reports that media persistence is disabled", async () => {
  const response = await handleRequest(new Request("https://worker.test/health"), {}, context);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: "pet-hotel-agent-api",
    orcaRouterConfigured: false,
    mediaStorageConfigured: false,
  });
});

test("recognizes the deployed ORCAROUTER_API_KEY binding", async () => {
  const response = await handleRequest(
    new Request("https://worker.test/health"),
    { ORCAROUTER_API_KEY: "test-secret" },
    context,
  );
  assert.equal(response.status, 200);
  assert.equal(((await response.json()) as any).orcaRouterConfigured, true);
});

test("rejects an unlisted browser origin", async () => {
  const response = await handleRequest(
    new Request("https://worker.test/health", { headers: { origin: "https://evil.example" } }),
    {},
    context,
  );
  assert.equal(response.status, 403);
  assert.equal(((await response.json()) as any).error.code, "origin_not_allowed");
});

test("deprecated media endpoint never persists uploads", async () => {
  const response = await handleRequest(new Request("https://worker.test/api/media", {
    method: "POST",
    headers: { origin, "content-type": "image/jpeg" },
    body: new Uint8Array([0xff, 0xd8, 0xff]),
  }), {}, context);
  assert.equal(response.status, 410);
  assert.equal(((await response.json()) as any).error.code, "media_storage_disabled");
});

test("sends only approved profile fields and keeps the secret in Authorization", async () => {
  let capturedInit: RequestInit | undefined;
  const fakeFetch: typeof fetch = async (_input, init) => {
    capturedInit = init;
    return successfulFetch(_input, init);
  };
  const response = await handleRequest(analyzeRequest({
    profile: {
      personality: "おだやか",
      playStyle: "ボール遊び",
      precautions: "大きな犬には慎重",
    },
    media: { type: "image", dataUrl: "data:image/jpeg;base64,/9j/2w==" },
  }), { ORCAROUTER_API_KEY: "test-secret" }, context, fakeFetch);

  assert.equal(response.status, 200);
  assert.equal(new Headers(capturedInit?.headers).get("authorization"), "Bearer test-secret");
  const upstreamBody = String(capturedInit?.body);
  assert.doesNotMatch(upstreamBody, /test-secret|owner|contact|audio/i);
  assert.match(upstreamBody, /おだやか/);
  assert.equal(((await response.json()) as any).analysis.summary, "calm");
});

test("retains prompt compatibility for text-only analysis", async () => {
  const response = await handleRequest(
    analyzeRequest({ prompt: "初対面の犬には慎重ですが、慣れると追いかけっこをします。" }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, successfulFetch,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(((await response.json()) as any).analysis.matchingProfile, validAnalysis.matchingProfile);
});

test("rejects owner and contact fields before calling OrcaRouter", async () => {
  let called = false;
  const fakeFetch: typeof fetch = async () => { called = true; return successfulFetch("https://unused"); };
  const response = await handleRequest(
    analyzeRequest({ prompt: "穏やかです", ownerName: "送信禁止" }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, fakeFetch,
  );
  assert.equal(response.status, 400);
  assert.equal(((await response.json()) as any).error.code, "data_minimization_violation");
  assert.equal(called, false);
});

test("rejects contact details embedded in compatibility prompt", async () => {
  const response = await handleRequest(
    analyzeRequest({ prompt: "穏やか。電話: 090-1234-5678" }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, successfulFetch,
  );
  assert.equal(response.status, 400);
  assert.equal(((await response.json()) as any).error.code, "data_minimization_violation");
});

test("rejects audio and legacy mediaId references", async () => {
  const audio = await handleRequest(
    analyzeRequest({ prompt: "穏やか", media: { type: "audio", dataUrl: "data:audio/mpeg;base64,SUQz" } }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, successfulFetch,
  );
  assert.equal(audio.status, 415);
  assert.equal(((await audio.json()) as any).error.code, "audio_not_supported");

  const mediaId = await handleRequest(
    analyzeRequest({ prompt: "穏やか", media: { type: "image", mediaId: "stored-object" } }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, successfulFetch,
  );
  assert.equal(mediaId.status, 400);
  assert.equal(((await mediaId.json()) as any).error.code, "unknown_field");
});

test("rejects forged media content and private URLs", async () => {
  const forged = await handleRequest(
    analyzeRequest({ prompt: "穏やか", media: { type: "image", dataUrl: "data:image/jpeg;base64,SGVsbG8=" } }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, successfulFetch,
  );
  assert.equal(forged.status, 415);
  assert.equal(((await forged.json()) as any).error.code, "media_signature_mismatch");

  const privateUrl = await handleRequest(
    analyzeRequest({ prompt: "穏やか", media: { type: "image", url: "https://127.0.0.1/pet.jpg" } }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, successfulFetch,
  );
  assert.equal(privateUrl.status, 400);
  assert.equal(((await privateUrl.json()) as any).error.code, "invalid_media_url");
});

test("rejects models outside the explicit allowlist", async () => {
  const response = await handleRequest(
    analyzeRequest({ model: "expensive/unknown", prompt: "穏やか" }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, successfulFetch,
  );
  assert.equal(response.status, 400);
  assert.equal(((await response.json()) as any).error.code, "model_not_allowed");
});

test("rejects invalid structured model output", async () => {
  const fakeFetch: typeof fetch = async () => Response.json({ choices: [{ message: { content: '{"summary":"missing fields"}' } }] });
  const response = await handleRequest(
    analyzeRequest({ prompt: "穏やか" }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, fakeFetch,
  );
  assert.equal(response.status, 502);
  assert.equal(((await response.json()) as any).error.code, "invalid_model_response");
});
