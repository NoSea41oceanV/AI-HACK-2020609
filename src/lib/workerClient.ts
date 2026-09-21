import { PLAY_STYLES } from "../domain/types";
import type { IntakeAiAnalysis, IntakeMatchingProfile } from "../domain/intakeProfile";

export interface WorkerHealth {
  ok: true;
  service: string;
  orcaRouterConfigured: boolean;
  mediaStorageConfigured: boolean;
}
export interface WorkerMediaInput {
  type: "image" | "video";
  url?: string;
  dataUrl?: string;
}
export interface WorkerAnalyzeResult {
  ok: true;
  requestId: string;
  model: string;
  analysis: IntakeAiAnalysis;
  usage: unknown;
}

export class WorkerClientError extends Error {
  constructor(message: string, readonly code: string, readonly status?: number) { super(message); }
}
interface WorkerClientOptions { fetchImpl?: typeof fetch; timeoutMs?: number }

export const AI_MEDIA_LIMITS = {
  imageBytes: 5 * 1024 * 1024,
  videoBytes: 20 * 1024 * 1024,
  totalBytes: 20 * 1024 * 1024,
} as const;

export const AI_MEDIA_TYPES = {
  image: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
} as const;

export interface OwnerAnalysisInput {
  personality: string;
  playStyle: string;
  concerns: string;
  photo?: Blob & { name?: string };
  video?: Blob & { name?: string };
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const isStrictScale = (value: unknown, minimum = 1): value is number => typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= 5;

const mediaTypeSets = {
  image: new Set<string>(AI_MEDIA_TYPES.image),
  video: new Set<string>(AI_MEDIA_TYPES.video),
};

const assertMediaFile = (kind: "image" | "video", file: Blob): void => {
  if (file.type.startsWith("audio/")) {
    throw new WorkerClientError("音声ファイルは受け付けていません。", "audio_not_supported", 415);
  }
  if (!mediaTypeSets[kind].has(file.type)) {
    throw new WorkerClientError(
      kind === "image" ? "画像はJPG・PNG・WebP形式を指定してください。" : "動画はMP4・WebM・MOV形式を指定してください。",
      "unsupported_media_type",
      415,
    );
  }
  const maximum = kind === "image" ? AI_MEDIA_LIMITS.imageBytes : AI_MEDIA_LIMITS.videoBytes;
  if (file.size > maximum) {
    throw new WorkerClientError(
      `${kind === "image" ? "画像" : "動画"}のファイル上限を超えています。`,
      "media_too_large",
      413,
    );
  }
};

export const validateOwnerAnalysisMedia = (input: Pick<OwnerAnalysisInput, "photo" | "video">): void => {
  if (input.photo) assertMediaFile("image", input.photo);
  if (input.video) assertMediaFile("video", input.video);
  const totalBytes = (input.photo?.size ?? 0) + (input.video?.size ?? 0);
  if (totalBytes > AI_MEDIA_LIMITS.totalBytes) {
    throw new WorkerClientError("写真と動画の合計サイズは20MB以下にしてください。", "media_total_too_large", 413);
  }
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

const toDataUrl = async (file: Blob): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return `data:${file.type};base64,${bytesToBase64(bytes)}`;
};

const ownerAnalysisPrompt = (input: Pick<OwnerAnalysisInput, "personality" | "playStyle" | "concerns">): string => [
  "以下は飼い主が入力したペットの情報です。記載内容と添付メディアだけを根拠に分析してください。",
  `性格: ${input.personality.trim()}`,
  `好きな遊び・遊び方: ${input.playStyle.trim()}`,
  `苦手なこと・注意点: ${input.concerns.trim() || "記載なし"}`,
].join("\n");

const parseMatchingProfile = (value: unknown): IntakeMatchingProfile => {
  if (!isRecord(value) || !isStrictScale(value.energyLevel) || !isStrictScale(value.sociability) ||
      !isStrictScale(value.anxietyLevel) || !isStrictScale(value.assertiveness) ||
      !isStrictScale(value.resourceGuarding, 0) || !isStringArray(value.playStyles) || value.playStyles.length > 6) {
    throw new WorkerClientError("AI分析のマッチング値が不正です。", "invalid_response");
  }
  const allowed = new Set<string>(PLAY_STYLES);
  if (value.playStyles.some((style) => !allowed.has(style)) || new Set(value.playStyles).size !== value.playStyles.length) {
    throw new WorkerClientError("AI分析の遊び方が不正です。", "invalid_response");
  }
  return {
    energyLevel: value.energyLevel,
    sociability: value.sociability,
    anxietyLevel: value.anxietyLevel,
    assertiveness: value.assertiveness,
    resourceGuarding: value.resourceGuarding,
    playStyles: value.playStyles as IntakeMatchingProfile["playStyles"],
    // A single-pet observation cannot identify a specific incompatible counterpart.
    hardBlockedPetIds: [],
  };
};

export const parseWorkerAnalysis = (value: unknown): IntakeAiAnalysis => {
  if (!isRecord(value) || typeof value.summary !== "string" || !isStringArray(value.observations) ||
      !isStringArray(value.compatibilitySignals) || !isStringArray(value.riskFlags) ||
      typeof value.confidence !== "number" || !Number.isFinite(value.confidence) ||
      value.confidence < 0 || value.confidence > 1 || !Array.isArray(value.personalityTraits)) {
    throw new WorkerClientError("AI分析の応答形式が不正です。", "invalid_response");
  }
  const personalityTraits = value.personalityTraits.map((item) => {
    if (!isRecord(item) || typeof item.label !== "string" || typeof item.evidence !== "string" ||
        typeof item.confidence !== "number" || !Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1) {
      throw new WorkerClientError("AI分析の性格傾向形式が不正です。", "invalid_response");
    }
    return { label: item.label, evidence: item.evidence, confidence: item.confidence };
  });
  return {
    summary: value.summary,
    observations: value.observations,
    personalityTraits,
    compatibilitySignals: value.compatibilitySignals,
    riskFlags: value.riskFlags,
    confidence: value.confidence,
    matchingProfile: parseMatchingProfile(value.matchingProfile),
  };
};

export class AIWorkerClient {
  readonly state: { kind: "enabled"; baseUrl: string } | { kind: "disabled"; reason: string };
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(baseUrl?: string, options: WorkerClientOptions = {}) {
    const value = baseUrl?.trim();
    if (!value) this.state = { kind: "disabled", reason: "VITE_AI_WORKER_URL が未設定です。" };
    else {
      let parsed: URL;
      try { parsed = new URL(value); } catch { throw new WorkerClientError("AI Worker URLが不正です。", "invalid_worker_url"); }
      if (!["http:", "https:"].includes(parsed.protocol)) throw new WorkerClientError("AI Worker URLはHTTP(S)で指定してください。", "invalid_worker_url");
      this.state = { kind: "enabled", baseUrl: parsed.toString().replace(/\/$/, "") };
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = Math.max(100, options.timeoutMs ?? 60_000);
  }

  private url(path: string): string {
    if (this.state.kind === "disabled") throw new WorkerClientError(this.state.reason, "worker_disabled");
    return `${this.state.baseUrl}${path}`;
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.url(path), { ...init, signal: controller.signal });
      let payload: unknown;
      try { payload = await response.json(); } catch { throw new WorkerClientError("AI Workerの応答を読み取れません。", "invalid_response", response.status); }
      if (!response.ok) {
        const error = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
        throw new WorkerClientError(
          error && typeof error.message === "string" ? error.message : "AI Workerへの接続に失敗しました。",
          error && typeof error.code === "string" ? error.code : "worker_error",
          response.status,
        );
      }
      return payload;
    } catch (error) {
      if (error instanceof WorkerClientError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") throw new WorkerClientError("AI Workerがタイムアウトしました。", "timeout");
      throw new WorkerClientError("AI Workerへ接続できません。", "network_error");
    } finally { clearTimeout(timer); }
  }

  async health(): Promise<WorkerHealth> {
    const value = await this.request("/health");
    if (!isRecord(value) || value.ok !== true || typeof value.service !== "string" ||
        typeof value.orcaRouterConfigured !== "boolean" || typeof value.mediaStorageConfigured !== "boolean") {
      throw new WorkerClientError("AI Workerのヘルス応答が不正です。", "invalid_response");
    }
    return value as unknown as WorkerHealth;
  }

  async analyze(input: { prompt: string; media?: WorkerMediaInput | WorkerMediaInput[]; model?: string }): Promise<WorkerAnalyzeResult> {
    const media = input.media ? (Array.isArray(input.media) ? input.media : [input.media]) : [];
    if (media.some((item) => !item || !["image", "video"].includes(String(item.type)))) {
      throw new WorkerClientError("音声には対応していません。画像または動画を指定してください。", "audio_not_supported", 415);
    }
    const value = await this.request("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: input.prompt, media, ...(input.model ? { model: input.model } : {}) }),
    });
    if (!isRecord(value) || value.ok !== true || typeof value.requestId !== "string" || typeof value.model !== "string") {
      throw new WorkerClientError("AI Workerの分析応答形式が不正です。", "invalid_response");
    }
    return { ok: true, requestId: value.requestId, model: value.model, analysis: parseWorkerAnalysis(value.analysis), usage: value.usage };
  }

  async analyzeOwnerRegistration(input: OwnerAnalysisInput): Promise<WorkerAnalyzeResult> {
    if (!input.personality.trim() || !input.playStyle.trim()) {
      throw new WorkerClientError("性格と好きな遊び・遊び方を入力してください。", "owner_profile_required", 400);
    }
    validateOwnerAnalysisMedia(input);
    const entries = ([
      input.photo ? { type: "image" as const, file: input.photo } : null,
      input.video ? { type: "video" as const, file: input.video } : null,
    ]).filter((entry): entry is { type: "image" | "video"; file: Blob } => entry !== null);
    const media = await Promise.all(entries.map(async ({ type, file }) => ({ type, dataUrl: await toDataUrl(file) })));

    return this.analyze({
      prompt: ownerAnalysisPrompt(input),
      media,
    });
  }
}

export const createAIWorkerClient = () => new AIWorkerClient(import.meta.env.VITE_AI_WORKER_URL);
