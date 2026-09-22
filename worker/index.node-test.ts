import assert from "node:assert/strict";
import test from "node:test";

import { handleRequest, type Env } from "./index.ts";
import { STRUCTURED_INTAKE_OPTIONS } from "../src/domain/structuredIntake.ts";

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

const validProfile = {
  personality: "穏やか",
  playStyle: "追いかけっこ",
  precautions: "大きな音には慎重",
};

const structuredAnswers = () => ({
  ...Object.fromEntries(Object.entries(STRUCTURED_INTAKE_OPTIONS).map(([key, options]) => [key, options[0]])),
  medicalHistory: "なし", sensoryJointConcerns: "なし", troubleHistory: "なし",
});
const axes = { extraversion: 12, sociability: 34, neuroticism: 56, trainability: 78, resourceGuarding: 90, assertiveness: 23, resilience: 45 };

test("structured-only analysis sends answers and returns the exact generated seven axes", async () => {
  let captured: any;
  const response = await handleRequest(analyzeRequest({ profile: { personality: "", playStyle: "", structured: structuredAnswers() } }), { ORCAROUTER_API_KEY: "test-secret" }, context, async (_url, init) => {
    captured = JSON.parse(String(init?.body));
    return Response.json({ choices: [{ message: { content: JSON.stringify({ ...validAnalysis, personalityAxes: axes }) } }] });
  });
  assert.equal(response.status, 200);
  const payload: any = await response.json();
  assert.deepEqual(payload.analysis.personalityAxes, axes);
  assert.deepEqual(payload.analysis.matchingProfile.personalityAxes, axes);
  assert.match(captured.messages[0].content, /trainability/);
  assert.match(captured.messages[1].content[0].text, /混合ワクチン証明: 提出済み・有効/);
});

test("structured input rejects unknown keys, missing answers and private health/history text before upstream", async () => {
  let called = false;
  for (const structured of [
    { ...structuredAnswers(), ownerName: "unexpected" },
    { ...structuredAnswers(), heat: undefined },
    { ...structuredAnswers(), medicalHistory: "連絡先: private@example.test" },
    { ...structuredAnswers(), sensoryJointConcerns: "電話: 090-1234-5678" },
    { ...structuredAnswers(), troubleHistory: "音声を分析" },
    { ...structuredAnswers(), medicalHistory: "x".repeat(1001) },
  ]) {
    const response = await handleRequest(analyzeRequest({ profile: { ...validProfile, structured } }), { ORCAROUTER_API_KEY: "test-secret" }, context, async () => { called = true; return Response.json({}); });
    assert.equal(response.status, 400);
  }
  assert.equal(called, false);
});

test("structured analysis rejects missing, fractional, out-of-range and extra axes", async () => {
  for (const personalityAxes of [undefined, { ...axes, resilience: undefined }, { ...axes, resilience: 101 }, { ...axes, resilience: 1.5 }, { ...axes, extra: 50 }]) {
    const response = await handleRequest(analyzeRequest({ profile: { ...validProfile, structured: structuredAnswers() } }), { ORCAROUTER_API_KEY: "test-secret" }, context, async () => Response.json({ choices: [{ message: { content: JSON.stringify({ ...validAnalysis, personalityAxes }) } }] }));
    assert.equal(response.status, 502);
    assert.equal((await response.json() as any).error.code, "invalid_model_response");
  }
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

test("rejects legacy prompt before calling OrcaRouter", async () => {
  let called = false;
  const fakeFetch: typeof fetch = async () => { called = true; return successfulFetch("https://unused"); };
  const response = await handleRequest(
    analyzeRequest({ prompt: "初対面の犬には慎重です。" }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, fakeFetch,
  );
  assert.equal(response.status, 400);
  assert.equal(((await response.json()) as any).error.code, "unknown_field");
  assert.equal(called, false);
});

test("accepts empty precautions with required profile fields", async () => {
  const response = await handleRequest(
    analyzeRequest({ profile: { personality: "穏やか", playStyle: "ボール遊び", precautions: "" } }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, successfulFetch,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(((await response.json()) as any).analysis.matchingProfile, validAnalysis.matchingProfile);
});

test("rejects owner and contact fields before calling OrcaRouter", async () => {
  let called = false;
  const fakeFetch: typeof fetch = async () => { called = true; return successfulFetch("https://unused"); };
  const response = await handleRequest(
    analyzeRequest({ profile: validProfile, ownerName: "送信禁止" }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, fakeFetch,
  );
  assert.equal(response.status, 400);
  assert.equal(((await response.json()) as any).error.code, "data_minimization_violation");
  assert.equal(called, false);
});

test("rejects contact and audio text in every profile field", async () => {
  for (const [key, value] of [
    ["personality", "穏やか。電話: 090-1234-5678"],
    ["playStyle", "音声を使った遊び"],
    ["precautions", "owner: someone"],
  ] as const) {
    const response = await handleRequest(
      analyzeRequest({ profile: { ...validProfile, [key]: value } }),
      { ORCAROUTER_API_KEY: "test-secret" }, context, successfulFetch,
    );
    assert.equal(response.status, 400);
    assert.equal(((await response.json()) as any).error.code, "data_minimization_violation");
  }
});

test("requires non-empty personality and playStyle and enforces profile keys and lengths", async () => {
  const cases = [
    { profile: { playStyle: "追いかけっこ", precautions: "" } },
    { profile: { personality: "穏やか", playStyle: "   ", precautions: "" } },
    { profile: { ...validProfile, petName: "送信禁止" } },
    { profile: { ...validProfile, personality: "a".repeat(1_001) } },
  ];
  for (const body of cases) {
    let called = false;
    const fakeFetch: typeof fetch = async () => { called = true; return successfulFetch("https://unused"); };
    const response = await handleRequest(analyzeRequest(body), { ORCAROUTER_API_KEY: "test-secret" }, context, fakeFetch);
    assert.equal(response.status, 400);
    assert.equal(called, false);
  }
});

test("rejects audio and legacy mediaId references", async () => {
  const audio = await handleRequest(
    analyzeRequest({ profile: validProfile, media: { type: "audio", dataUrl: "data:audio/mpeg;base64,SUQz" } }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, successfulFetch,
  );
  assert.equal(audio.status, 415);
  assert.equal(((await audio.json()) as any).error.code, "audio_not_supported");

  const mediaId = await handleRequest(
    analyzeRequest({ profile: validProfile, media: { type: "image", mediaId: "stored-object" } }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, successfulFetch,
  );
  assert.equal(mediaId.status, 400);
  assert.equal(((await mediaId.json()) as any).error.code, "unknown_field");
});

test("rejects raw video data URLs and URLs before calling OrcaRouter", async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls += 1;
    return successfulFetch("https://unused");
  };

  const rawVideoData = await handleRequest(
    analyzeRequest({ profile: validProfile, media: { type: "video", dataUrl: "data:video/mp4;base64,AAAAAGZ0eXA=" } }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, fakeFetch,
  );
  assert.equal(rawVideoData.status, 415);
  assert.equal(((await rawVideoData.json()) as any).error.code, "video_not_supported");

  const rawVideoUrl = await handleRequest(
    analyzeRequest({ profile: validProfile, media: { type: "video", url: "https://cdn.example/pet.mp4" } }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, fakeFetch,
  );
  assert.equal(rawVideoUrl.status, 415);
  assert.equal(((await rawVideoUrl.json()) as any).error.code, "video_not_supported");
  assert.equal(calls, 0);
});

test("rejects forged media content and private URLs", async () => {
  const forged = await handleRequest(
    analyzeRequest({ profile: validProfile, media: { type: "image", dataUrl: "data:image/jpeg;base64,SGVsbG8=" } }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, successfulFetch,
  );
  assert.equal(forged.status, 415);
  assert.equal(((await forged.json()) as any).error.code, "media_signature_mismatch");

  const privateUrl = await handleRequest(
    analyzeRequest({ profile: validProfile, media: { type: "image", url: "https://127.0.0.1/pet.jpg" } }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, successfulFetch,
  );
  assert.equal(privateUrl.status, 400);
  assert.equal(((await privateUrl.json()) as any).error.code, "invalid_media_url");
});

test("rejects models outside the explicit allowlist", async () => {
  const response = await handleRequest(
    analyzeRequest({ model: "expensive/unknown", profile: validProfile }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, successfulFetch,
  );
  assert.equal(response.status, 400);
  assert.equal(((await response.json()) as any).error.code, "model_not_allowed");
});

test("rejects invalid structured model output", async () => {
  const fakeFetch: typeof fetch = async () => Response.json({ choices: [{ message: { content: '{"summary":"missing fields"}' } }] });
  const response = await handleRequest(
    analyzeRequest({ profile: validProfile }),
    { ORCAROUTER_API_KEY: "test-secret" }, context, fakeFetch,
  );
  assert.equal(response.status, 502);
  assert.equal(((await response.json()) as any).error.code, "invalid_model_response");
});
