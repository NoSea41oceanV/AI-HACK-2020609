import { PLAY_STYLES } from "../domain/types";
import type { IntakeAiAnalysis, IntakeMatchingProfile } from "../domain/intakeProfile";
import { isPersonalityAxes, isStructuredIntakeAnswers, samePersonalityAxes, type StructuredIntakeAnswers } from "../domain/structuredIntake";

export interface WorkerHealth {
  ok: true;
  service: string;
  orcaRouterConfigured: boolean;
  mediaStorageConfigured: boolean;
}
export interface WorkerMediaInput {
  type: "image";
  url?: string;
  dataUrl?: string;
}
export interface WorkerAnalyzeProfile {
  structured?: StructuredIntakeAnswers;
  personality: string;
  playStyle: string;
  precautions: string;
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
type VideoFrameExtractor = (video: Blob) => Promise<Blob[]>;
interface WorkerClientOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  videoFrameExtractor?: VideoFrameExtractor;
}

export const AI_MEDIA_LIMITS = {
  imageBytes: 5 * 1024 * 1024,
  videoBytes: 40 * 1024 * 1024,
  totalBytes: 40 * 1024 * 1024,
} as const;

export const AI_MEDIA_TYPES = {
  image: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
} as const;

export interface OwnerAnalysisInput {
  structured?: StructuredIntakeAnswers;
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
    throw new WorkerClientError("写真と動画の合計サイズは40MB以下にしてください。", "media_total_too_large", 413);
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

const waitForVideoEvent = (video: HTMLVideoElement, successEvent: "loadedmetadata" | "loadeddata" | "seeked"): Promise<void> =>
  new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(new WorkerClientError("動画から静止画を作成できませんでした。", "video_frame_extraction_failed", 422)), 15_000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener(successEvent, onSuccess);
      video.removeEventListener("error", onError);
    };
    const finish = (error?: WorkerClientError) => {
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const onSuccess = () => finish();
    const onError = () => finish(new WorkerClientError("動画を読み取れませんでした。", "video_frame_extraction_failed", 422));
    video.addEventListener(successEvent, onSuccess, { once: true });
    video.addEventListener("error", onError, { once: true });
  });

const canvasToJpeg = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new WorkerClientError("動画から静止画を作成できませんでした。", "video_frame_extraction_failed", 422));
  }, "image/jpeg", 0.82);
});

const extractSilentVideoFrames: VideoFrameExtractor = async (file) => {
  if (typeof document === "undefined" || typeof window === "undefined" ||
      typeof URL.createObjectURL !== "function" || typeof URL.revokeObjectURL !== "function") {
    throw new WorkerClientError("この環境では動画から静止画を作成できません。", "video_frame_extraction_unavailable", 422);
  }

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;

  try {
    const metadataReady = waitForVideoEvent(video, "loadedmetadata");
    video.load();
    await metadataReady;
    if (!video.videoWidth || !video.videoHeight || !Number.isFinite(video.duration) || video.duration <= 0) {
      throw new WorkerClientError("動画の長さまたは映像を読み取れませんでした。", "video_frame_extraction_failed", 422);
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForVideoEvent(video, "loadeddata");
    }

    const maximumDimension = 1_280;
    const scale = Math.min(1, maximumDimension / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new WorkerClientError("動画から静止画を作成できませんでした。", "video_frame_extraction_failed", 422);

    const end = Math.max(0, video.duration - Math.min(0.05, video.duration / 10));
    const candidates = [video.duration * 0.25, video.duration * 0.75]
      .map((time) => Math.min(end, Math.max(0, time)));
    const timestamps = candidates.filter((time, index) => index === 0 || Math.abs(time - candidates[index - 1]) >= 0.05);
    const frames: Blob[] = [];
    for (const timestamp of timestamps) {
      if (Math.abs(video.currentTime - timestamp) >= 0.001) {
        const seeked = waitForVideoEvent(video, "seeked");
        video.currentTime = timestamp;
        await seeked;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = await canvasToJpeg(canvas);
      assertMediaFile("image", frame);
      frames.push(frame);
    }
    if (!frames.length) throw new WorkerClientError("動画から静止画を作成できませんでした。", "video_frame_extraction_failed", 422);
    return frames.slice(0, 2);
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
};

const sanitizeAnalyzeProfile = (profile: WorkerAnalyzeProfile): WorkerAnalyzeProfile => {
  if (profile?.structured !== undefined && !isStructuredIntakeAnswers(profile.structured)) {
    throw new WorkerClientError("構造化回答の形式が不正です。", "invalid_structured_intake", 400);
  }
  const values = {
    personality: profile?.personality,
    playStyle: profile?.playStyle,
    precautions: profile?.precautions,
  };
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== "string") {
      throw new WorkerClientError("性格・遊び方・注意事項は文字列で入力してください。", "invalid_profile", 400);
    }
    if (value.length > 1_000) {
      throw new WorkerClientError(`${key}は1000文字以下にしてください。`, "profile_too_long", 400);
    }
  }
  if (!profile.structured && (!values.personality.trim() || !values.playStyle.trim())) {
    throw new WorkerClientError("性格と好きな遊び・遊び方を入力してください。", "owner_profile_required", 400);
  }
  return {
    personality: values.personality.trim(),
    playStyle: values.playStyle.trim(),
    precautions: values.precautions.trim(),
    ...(profile.structured ? { structured: { ...profile.structured } } : {}),
  };
};

const parseMatchingProfile = (value: unknown): IntakeMatchingProfile => {
  if (!isRecord(value) || !isStrictScale(value.energyLevel) || !isStrictScale(value.sociability) ||
      !isStrictScale(value.anxietyLevel) || !isStrictScale(value.assertiveness) ||
      !isStrictScale(value.resourceGuarding, 0) || !isStringArray(value.playStyles) || value.playStyles.length > 6) {
    throw new WorkerClientError("AI分析のマッチング値が不正です。", "invalid_response");
  }
  const allowed = new Set<string>(PLAY_STYLES);
  if (value.personalityAxes !== undefined && !isPersonalityAxes(value.personalityAxes)) {
    throw new WorkerClientError("AI分析の7軸が不正です。", "invalid_response");
  }
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
    ...(isPersonalityAxes(value.personalityAxes) ? { personalityAxes: { ...value.personalityAxes } } : {}),
  };
};

export const parseWorkerAnalysis = (value: unknown, requireAxes = false): IntakeAiAnalysis => {
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
  const matchingProfile = parseMatchingProfile(value.matchingProfile);
  if ((requireAxes || value.personalityAxes !== undefined) && (!isPersonalityAxes(value.personalityAxes) ||
      !isPersonalityAxes(matchingProfile.personalityAxes) || !samePersonalityAxes(value.personalityAxes, matchingProfile.personalityAxes))) {
    throw new WorkerClientError("AI分析の7軸が不足または不整合です。", "invalid_response");
  }
  return {
    summary: value.summary,
    observations: value.observations,
    personalityTraits,
    compatibilitySignals: value.compatibilitySignals,
    riskFlags: value.riskFlags,
    confidence: value.confidence,
    matchingProfile,
    ...(isPersonalityAxes(value.personalityAxes) ? { personalityAxes: { ...value.personalityAxes } } : {}),
  };
};

export class AIWorkerClient {
  readonly state: { kind: "enabled"; baseUrl: string } | { kind: "disabled"; reason: string };
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly videoFrameExtractor: VideoFrameExtractor;

  constructor(baseUrl?: string, options: WorkerClientOptions = {}) {
    const value = baseUrl?.trim();
    if (!value) this.state = { kind: "disabled", reason: "VITE_AI_WORKER_URL が未設定です。" };
    else {
      let parsed: URL;
      try { parsed = new URL(value); } catch { throw new WorkerClientError("AI Worker URLが不正です。", "invalid_worker_url"); }
      if (!["http:", "https:"].includes(parsed.protocol)) throw new WorkerClientError("AI Worker URLはHTTP(S)で指定してください。", "invalid_worker_url");
      this.state = { kind: "enabled", baseUrl: parsed.toString().replace(/\/$/, "") };
    }
    // Browser-native fetch is brand-checked and throws "Illegal invocation"
    // when called as an instance property (`this.fetchImpl(...)`). Keep the
    // expected Window/Worker global receiver even for injected test clients.
    this.fetchImpl = (options.fetchImpl ?? fetch).bind(globalThis);
    this.timeoutMs = Math.max(100, options.timeoutMs ?? 60_000);
    this.videoFrameExtractor = options.videoFrameExtractor ?? extractSilentVideoFrames;
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

  async analyze(input: { profile: WorkerAnalyzeProfile; media?: WorkerMediaInput | WorkerMediaInput[]; model?: string }): Promise<WorkerAnalyzeResult> {
    const media = input.media ? (Array.isArray(input.media) ? input.media : [input.media]) : [];
    if (media.some((item) => !item || item.type !== "image")) {
      throw new WorkerClientError("写真または動画から抽出した静止画像だけを指定してください。", "unsupported_media_type", 415);
    }
    const profile = sanitizeAnalyzeProfile(input.profile);
    const value = await this.request("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile, media, ...(input.model ? { model: input.model } : {}) }),
    });
    if (!isRecord(value) || value.ok !== true || typeof value.requestId !== "string" || typeof value.model !== "string") {
      throw new WorkerClientError("AI Workerの分析応答形式が不正です。", "invalid_response");
    }
    return { ok: true, requestId: value.requestId, model: value.model, analysis: parseWorkerAnalysis(value.analysis, !!profile.structured), usage: value.usage };
  }

  async analyzeOwnerRegistration(input: OwnerAnalysisInput): Promise<WorkerAnalyzeResult> {
    validateOwnerAnalysisMedia(input);
    const imageFiles: Blob[] = input.photo ? [input.photo] : [];
    if (input.video) imageFiles.push(...await this.videoFrameExtractor(input.video));
    if (imageFiles.length > 3) {
      throw new WorkerClientError("送信できる画像は3枚までです。", "invalid_media_count", 400);
    }
    imageFiles.forEach((file) => assertMediaFile("image", file));
    const media = await Promise.all(imageFiles.map(async (file) => ({ type: "image" as const, dataUrl: await toDataUrl(file) })));

    return this.analyze({
      profile: {
        personality: input.personality,
        playStyle: input.playStyle,
        precautions: input.concerns,
        ...(input.structured !== undefined ? { structured: input.structured } : {}),
      },
      media,
    });
  }
}

export const createAIWorkerClient = () => new AIWorkerClient(import.meta.env.VITE_AI_WORKER_URL);
