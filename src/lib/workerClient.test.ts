import { describe, expect, it, vi } from "vitest";
import {
  AI_MEDIA_LIMITS,
  AIWorkerClient,
  WorkerClientError,
  parseWorkerAnalysis,
  validateOwnerAnalysisMedia,
} from "./workerClient";

const validAnalysis = {
  summary: "落ち着いて周囲を観察しています。",
  observations: ["座っている"],
  personalityTraits: [{ label: "慎重", evidence: "周囲を確認", confidence: 0.8 }],
  compatibilitySignals: ["穏やかな個体と合う可能性"],
  riskFlags: [],
  confidence: 0.75,
  matchingProfile: {
    energyLevel: 2,
    sociability: 3,
    anxietyLevel: 2,
    assertiveness: 2,
    resourceGuarding: 0,
    playStyles: ["gentle"],
  },
};

describe("AIWorkerClient", () => {
  it("exposes a disabled state when the worker URL is missing", async () => {
    const client = new AIWorkerClient(undefined, { fetchImpl: vi.fn() });
    expect(client.state.kind).toBe("disabled");
    await expect(client.health()).rejects.toMatchObject({ code: "worker_disabled" });
  });

  it("rejects audio before making a network request", async () => {
    const fetchMock = vi.fn();
    const client = new AIWorkerClient("https://worker.example", { fetchImpl: fetchMock });
    await expect(client.analyzeOwnerRegistration({
      personality: "穏やか",
      playStyle: "ボール遊び",
      concerns: "",
      photo: new Blob(["audio"], { type: "audio/mpeg" }),
    })).rejects.toMatchObject({ code: "audio_not_supported" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends only approved owner text and ephemeral data URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true, requestId: "request-owner", model: "demo-model", analysis: validAnalysis, usage: null,
    }), { status: 200 }));
    const client = new AIWorkerClient("https://worker.example", { fetchImpl: fetchMock });
    const untrustedInput = {
      personality: "慎重",
      playStyle: "追いかけっこ",
      concerns: "大きな音が苦手",
      photo: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }),
      owner: { name: "送信禁止の飼い主", contact: "secret@example.test" },
      petName: "送信禁止のペット名",
    };

    await client.analyzeOwnerRegistration(untrustedInput);

    const bodyText = String(fetchMock.mock.calls[0][1]?.body);
    const body = JSON.parse(bodyText) as { prompt: string; media: Array<{ type: string; dataUrl: string }> };
    expect(body.prompt).toContain("性格: 慎重");
    expect(body.prompt).toContain("好きな遊び・遊び方: 追いかけっこ");
    expect(body.prompt).toContain("苦手なこと・注意点: 大きな音が苦手");
    expect(body.media).toEqual([{ type: "image", dataUrl: "data:image/jpeg;base64,/9j/" }]);
    expect(bodyText).not.toContain("送信禁止の飼い主");
    expect(bodyText).not.toContain("secret@example.test");
    expect(bodyText).not.toContain("送信禁止のペット名");
    expect(bodyText).not.toContain("mediaId");
  });

  it("accepts text-only analysis and validates the strict matching profile", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true, requestId: "request-1", model: "demo-model", analysis: validAnalysis, usage: null,
    }), { status: 200 }));
    const client = new AIWorkerClient("https://worker.example/", { fetchImpl: fetchMock });
    await expect(client.analyze({ prompt: "フォームを分析して" })).resolves.toMatchObject({
      requestId: "request-1", analysis: { matchingProfile: { energyLevel: 2, hardBlockedPetIds: [] } },
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as { media: unknown[] };
    expect(body.media).toEqual([]);
  });

  it("propagates Worker failures instead of returning a successful analysis", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "orcarouter_error", message: "AI分析に失敗しました。" },
    }), { status: 502 }));
    const client = new AIWorkerClient("https://worker.example", { fetchImpl: fetchMock });

    await expect(client.analyzeOwnerRegistration({
      personality: "穏やか",
      playStyle: "ボール遊び",
      concerns: "",
    })).rejects.toMatchObject({ code: "orcarouter_error", status: 502 });
  });
});

describe("validateOwnerAnalysisMedia", () => {
  it("keeps client limits aligned with the Worker contract", () => {
    expect(AI_MEDIA_LIMITS).toEqual({
      imageBytes: 5 * 1024 * 1024,
      videoBytes: 20 * 1024 * 1024,
      totalBytes: 20 * 1024 * 1024,
    });
  });

  it("rejects a combined payload that cannot fit the analyze request", () => {
    const photo = new Blob([new Uint8Array(1024 * 1024)], { type: "image/jpeg" });
    const video = new Blob([new Uint8Array(20 * 1024 * 1024)], { type: "video/mp4" });
    expect(() => validateOwnerAnalysisMedia({ photo, video })).toThrowError(
      expect.objectContaining({ code: "media_total_too_large" }),
    );
  });
});

describe("parseWorkerAnalysis", () => {
  it("rejects malformed confidence, traits, and matching values", () => {
    expect(() => parseWorkerAnalysis({ ...validAnalysis, confidence: 2 })).toThrow(WorkerClientError);
    expect(() => parseWorkerAnalysis({ ...validAnalysis, personalityTraits: [{}] })).toThrow(WorkerClientError);
    expect(() => parseWorkerAnalysis({ ...validAnalysis, matchingProfile: { ...validAnalysis.matchingProfile, energyLevel: 2.5 } })).toThrow(WorkerClientError);
    expect(() => parseWorkerAnalysis({ ...validAnalysis, matchingProfile: { ...validAnalysis.matchingProfile, playStyles: ["invalid"] } })).toThrow(WorkerClientError);
  });
});
