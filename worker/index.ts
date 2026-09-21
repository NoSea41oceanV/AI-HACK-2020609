const DEFAULT_BASE_URL = "https://api.orcarouter.ai/v1";
const DEFAULT_MODELS = ["google/gemini-2.5-flash"];
const DEFAULT_ORIGINS = ["http://localhost:5173"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const MAX_BODY_BYTES = 28 * 1024 * 1024;
const MAX_UPSTREAM_BYTES = 1024 * 1024;
const ALLOWED_IMAGES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_VIDEOS = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const ALLOWED_PLAY_STYLES = new Set(["chase", "wrestle", "tug", "fetch", "gentle", "solo"]);
const REQUEST_KEYS = new Set(["model", "prompt", "profile", "media"]);
const PROFILE_KEYS = new Set(["personality", "playStyle", "precautions"]);
const MEDIA_KEYS = new Set(["type", "url", "dataUrl"]);
const PRIVATE_KEY = /(?:owner|guardian|customer|contact|phone|tel|email|mail|address|name|audio|voice|飼い主|利用者|氏名|名前|連絡|電話|住所|メール|音声|鳴き声)/i;
const PRIVATE_TEXT = [
  /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/,
  /(?:\+?81[-\s]?)?(?:0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4})/,
  /(?:飼い主|利用者|氏名|名前|連絡先|電話|住所|メール|owner|guardian|contact|phone|e-?mail)\s*[:：]/i,
];

export interface Env {
  ORCAROUTER_API_KEY?: string;
  ORCA_ROUTER_BASE_URL?: string;
  ORCA_ALLOWED_MODELS?: string;
  ORCA_ROUTER_TIMEOUT_MS?: string;
  CORS_ORIGINS?: string;
}

interface ExecutionContextLike { waitUntil(promise: Promise<unknown>): void }
type MediaKind = "image" | "video";
interface MediaInput { type?: MediaKind; url?: string; dataUrl?: string }
interface PetProfile { personality?: string; playStyle?: string; precautions?: string }
interface AnalyzeBody { model?: string; prompt?: string; profile?: PetProfile; media?: MediaInput | MediaInput[] }

class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const rateWindows = new Map<string, { startedAt: number; count: number }>();

function csv(value: string | undefined, fallback: string[]): string[] {
  const parsed = value?.split(",").map((item) => item.trim()).filter(Boolean);
  return parsed?.length ? parsed : fallback;
}

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  return csv(env.CORS_ORIGINS, DEFAULT_ORIGINS).includes(origin) ? origin : null;
}

function responseHeaders(origin: string | null): Headers {
  const headers = new Headers({
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    vary: "Origin",
  });
  if (origin) headers.set("access-control-allow-origin", origin);
  return headers;
}

function json(value: unknown, status: number, origin: string | null, extra: HeadersInit = {}): Response {
  const headers = responseHeaders(origin);
  headers.set("content-type", "application/json; charset=utf-8");
  new Headers(extra).forEach((headerValue, key) => headers.set(key, headerValue));
  return new Response(JSON.stringify(value), { status, headers });
}

function assertCors(request: Request, env: Env): string | null {
  const origin = request.headers.get("origin");
  const allowed = allowedOrigin(request, env);
  if (origin && !allowed) throw new HttpError(403, "origin_not_allowed", "このOriginからは利用できません。");
  return allowed;
}

function enforceRateLimit(request: Request): void {
  const key = `analyze:${request.headers.get("cf-connecting-ip") ?? "local"}`;
  const now = Date.now();
  const current = rateWindows.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    rateWindows.set(key, { startedAt: now, count: 1 });
    if (rateWindows.size > 1_000) {
      for (const [candidate, value] of rateWindows) if (now - value.startedAt >= 60_000) rateWindows.delete(candidate);
    }
    return;
  }
  current.count += 1;
  if (current.count > 10) throw new HttpError(429, "rate_limited", "1分あたりの利用上限を超えました。");
}

function assertKeys(value: Record<string, unknown>, allowed: Set<string>): void {
  for (const key of Object.keys(value)) {
    if (PRIVATE_KEY.test(key)) throw new HttpError(400, "data_minimization_violation", "個人情報または音声は送信できません。");
    if (!allowed.has(key)) throw new HttpError(400, "unknown_field", `未対応の項目です: ${key}`);
  }
}

function assertPublicPetText(value: string): void {
  if (PRIVATE_TEXT.some((pattern) => pattern.test(value))) {
    throw new HttpError(400, "data_minimization_violation", "飼い主名・連絡先を除いて入力してください。");
  }
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function validateMediaBytes(bytes: Uint8Array, contentType: string): MediaKind {
  if (contentType.startsWith("audio/")) throw new HttpError(415, "audio_not_supported", "このシステムでは音声を受け付けません。");
  const kind = ALLOWED_IMAGES.has(contentType) ? "image" : ALLOWED_VIDEOS.has(contentType) ? "video" : null;
  if (!kind) throw new HttpError(415, "unsupported_media_type", "対応していないメディア形式です。");
  const valid =
    (contentType === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (contentType === "image/png" && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) ||
    (contentType === "image/webp" && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") ||
    ((contentType === "video/mp4" || contentType === "video/quicktime") && ascii(bytes, 4, 8) === "ftyp") ||
    (contentType === "video/webm" && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3);
  if (!valid) throw new HttpError(415, "media_signature_mismatch", "Content-Typeとファイル内容が一致しません。");
  if (bytes.byteLength > (kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES)) {
    throw new HttpError(413, "media_too_large", `${kind === "image" ? "画像" : "動画"}の入力上限を超えています。`);
  }
  return kind;
}

function parseDataUrl(value: string): { bytes: Uint8Array; contentType: string } {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new HttpError(400, "invalid_data_url", "data URLはbase64形式にしてください。");
  try {
    const binary = atob(match[2]);
    return { bytes: Uint8Array.from(binary, (character) => character.charCodeAt(0)), contentType: match[1].toLowerCase() };
  } catch {
    throw new HttpError(400, "invalid_base64", "base64データを読み取れません。");
  }
}

function isPublicHttps(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || value.length > 2_048) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".local") || host === "::1" || /^(?:fc|fd|fe8|fe9|fea|feb)/i.test(host)) return false;
    const parts = host.split(".").map(Number);
    if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
      if (parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || parts[0] >= 224) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      if (parts[0] === 169 && parts[1] === 254) return false;
    }
    return true;
  } catch { return false; }
}

function mediaContent(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new HttpError(400, "invalid_media", "メディア指定が不正です。");
  const media = input as Record<string, unknown>;
  assertKeys(media, MEDIA_KEYS);
  if (media.type === "audio") throw new HttpError(415, "audio_not_supported", "このシステムでは音声を受け付けません。");
  if (media.type !== "image" && media.type !== "video") throw new HttpError(400, "invalid_media_type", "画像か動画を指定してください。");
  if ([media.url, media.dataUrl].filter((value) => value !== undefined).length !== 1) {
    throw new HttpError(400, "invalid_media_reference", "urlまたはdataUrlのどちらか1つを指定してください。");
  }
  let value: string;
  if (typeof media.url === "string") {
    if (!isPublicHttps(media.url)) throw new HttpError(400, "invalid_media_url", "公開HTTPS URLを指定してください。");
    value = media.url;
  } else if (typeof media.dataUrl === "string") {
    const parsed = parseDataUrl(media.dataUrl);
    if (validateMediaBytes(parsed.bytes, parsed.contentType) !== media.type) {
      throw new HttpError(400, "media_type_mismatch", "指定したメディア種別と内容が一致しません。");
    }
    value = media.dataUrl;
  } else throw new HttpError(400, "invalid_media_reference", "urlまたはdataUrlを文字列で指定してください。");
  return media.type === "image"
    ? { type: "image_url", image_url: { url: value, detail: "low" } }
    : { type: "video_url", video_url: { url: value } };
}

function profileText(body: AnalyzeBody): string {
  const parts: string[] = [];
  if (body.profile !== undefined) {
    if (!body.profile || typeof body.profile !== "object" || Array.isArray(body.profile)) throw new HttpError(400, "invalid_profile", "profileはオブジェクトで指定してください。");
    assertKeys(body.profile as Record<string, unknown>, PROFILE_KEYS);
    const labels: Record<keyof PetProfile, string> = { personality: "性格", playStyle: "遊び方", precautions: "注意事項" };
    for (const key of Object.keys(labels) as Array<keyof PetProfile>) {
      const value = body.profile[key];
      if (value === undefined) continue;
      if (typeof value !== "string") throw new HttpError(400, "invalid_profile", `${labels[key]}は文字列で指定してください。`);
      if (value.trim()) {
        assertPublicPetText(value);
        parts.push(`${labels[key]}: ${value.trim().slice(0, 1_000)}`);
      }
    }
  }
  // Existing client compatibility. This is treated only as approved pet data.
  if (body.prompt !== undefined) {
    if (typeof body.prompt !== "string") throw new HttpError(400, "invalid_prompt", "promptは文字列で指定してください。");
    if (body.prompt.trim()) {
      assertPublicPetText(body.prompt);
      parts.push(`ペット情報: ${body.prompt.trim().slice(0, 2_000)}`);
    }
  }
  if (!parts.length) throw new HttpError(400, "profile_required", "性格・遊び方・注意事項のいずれかを入力してください。");
  return parts.join("\n");
}

function systemPrompt(): string {
  return [
    "あなたはペットホテルの相性マッチングに使う性格傾向の構造化補助AIです。",
    "入力はペットの性格・遊び方・注意事項と任意の写真・短い動画だけです。飼い主の特定や個人情報の推測をせず、音声を評価しないでください。",
    "医療診断や性格の断定はせず、根拠が弱い場合はconfidenceを下げ、riskFlagsへ不確実性を明記してください。",
    "JSONのみを返し、次のキーを必ず含めてください:",
    'summary:string, observations:string[], personalityTraits:{label:string,evidence:string,confidence:number}[], compatibilitySignals:string[], riskFlags:string[], confidence:number, matchingProfile:{energyLevel:number,sociability:number,anxietyLevel:number,assertiveness:number,resourceGuarding:number,playStyles:string[]}',
    "energyLevel、sociability、anxietyLevel、assertivenessは1〜5、resourceGuardingは0〜5の整数です。playStylesはchase,wrestle,tug,fetch,gentle,soloから選び、confidenceは0〜1です。",
  ].join("\n");
}

function timeout(env: Env): number {
  const value = Number(env.ORCA_ROUTER_TIMEOUT_MS ?? 25_000);
  return Number.isFinite(value) ? Math.max(1_000, Math.min(30_000, Math.floor(value))) : 25_000;
}

async function callUpstream(url: string, init: RequestInit, env: Env, fetcher: typeof fetch): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout(env));
  try { return await fetcher(url, { ...init, signal: controller.signal }); }
  catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new HttpError(504, "orcarouter_timeout", "AI分析がタイムアウトしました。");
    throw new HttpError(502, "orcarouter_unreachable", "AI分析へ接続できませんでした。");
  } finally { clearTimeout(timer); }
}

async function analyze(request: Request, env: Env, origin: string | null, fetcher: typeof fetch, requestId: string): Promise<Response> {
  if (!env.ORCAROUTER_API_KEY) throw new HttpError(503, "orcarouter_not_configured", "AI接続が設定されていません。");
  enforceRateLimit(request);
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw new HttpError(413, "payload_too_large", "入力サイズが上限を超えています。");
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new HttpError(415, "json_required", "application/jsonで送信してください。");
  let body: AnalyzeBody;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new HttpError(413, "payload_too_large", "入力サイズが上限を超えています。");
    body = JSON.parse(raw) as AnalyzeBody;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "invalid_json", "JSONオブジェクトを送信してください。");
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "invalid_json", "JSONを読み取れません。");
  }
  assertKeys(body as Record<string, unknown>, REQUEST_KEYS);
  const text = profileText(body);
  const models = csv(env.ORCA_ALLOWED_MODELS, DEFAULT_MODELS);
  const model = body.model ?? models[0];
  if (typeof model !== "string" || !models.includes(model)) throw new HttpError(400, "model_not_allowed", "許可されていないモデルです。");
  const media = Array.isArray(body.media) ? body.media : body.media ? [body.media] : [];
  if (media.length > 3) throw new HttpError(400, "invalid_media_count", "メディアは0〜3件指定してください。");
  const content = media.map(mediaContent);
  if (content.filter((item) => item.type === "video_url").length > 1) throw new HttpError(400, "too_many_videos", "動画は1件までです。");

  const baseUrl = (env.ORCA_ROUTER_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const upstream = await callUpstream(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.ORCAROUTER_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model, temperature: 0.1, response_format: { type: "json_object" },
      messages: [{ role: "system", content: systemPrompt() }, { role: "user", content: [{ type: "text", text }, ...content] }],
    }),
  }, env, fetcher);
  if (!upstream.ok) {
    console.error(JSON.stringify({ event: "orcarouter_error", status: upstream.status, requestId }));
    throw new HttpError(502, "orcarouter_error", "AI分析に失敗しました。少し待って再試行してください。");
  }
  const upstreamLength = upstream.headers.get("content-length");
  if (upstreamLength && Number(upstreamLength) > MAX_UPSTREAM_BYTES) throw new HttpError(502, "orcarouter_response_too_large", "AIの応答サイズが上限を超えました。");
  const rawResponse = await upstream.text();
  if (new TextEncoder().encode(rawResponse).byteLength > MAX_UPSTREAM_BYTES) throw new HttpError(502, "orcarouter_response_too_large", "AIの応答サイズが上限を超えました。");
  let payload: { choices?: Array<{ message?: { content?: string | Record<string, unknown> } }>; usage?: unknown };
  try { payload = JSON.parse(rawResponse) as typeof payload; }
  catch { throw new HttpError(502, "invalid_model_response", "AIの応答形式が不正です。"); }
  return json({ ok: true, requestId, model, analysis: parseAnalysis(payload.choices?.[0]?.message?.content), usage: payload.usage ?? null }, 200, origin);
}

function parseAnalysis(content: string | Record<string, unknown> | undefined): Record<string, unknown> {
  let value: Record<string, unknown>;
  if (content && typeof content === "object") value = content;
  else if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      value = parsed as Record<string, unknown>;
    } catch { throw new HttpError(502, "invalid_model_response", "AIの構造化応答を読み取れません。"); }
  } else throw new HttpError(502, "invalid_model_response", "AIの応答形式が不正です。");

  const strings = (candidate: unknown): candidate is string[] => Array.isArray(candidate) && candidate.every((item) => typeof item === "string");
  const traits = value.personalityTraits;
  const validTraits = Array.isArray(traits) && traits.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const trait = item as Record<string, unknown>;
    return typeof trait.label === "string" && typeof trait.evidence === "string" && typeof trait.confidence === "number" && Number.isFinite(trait.confidence) && trait.confidence >= 0 && trait.confidence <= 1;
  });
  if (typeof value.summary !== "string" || !strings(value.observations) || !validTraits || !strings(value.compatibilitySignals) || !strings(value.riskFlags) || typeof value.confidence !== "number" || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) {
    throw new HttpError(502, "invalid_model_response", "AIの構造化応答を読み取れません。");
  }
  return {
    summary: value.summary.slice(0, 2_000), observations: value.observations.slice(0, 50),
    personalityTraits: (traits as Array<Record<string, unknown>>).slice(0, 30),
    compatibilitySignals: value.compatibilitySignals.slice(0, 50), riskFlags: value.riskFlags.slice(0, 50),
    confidence: value.confidence, matchingProfile: validateMatchingProfile(value.matchingProfile),
  };
}

function validateMatchingProfile(candidate: unknown): Record<string, unknown> {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new HttpError(502, "invalid_model_response", "AIのmatchingProfileが不正です。");
  const profile = candidate as Record<string, unknown>;
  const keys = ["energyLevel", "sociability", "anxietyLevel", "assertiveness", "resourceGuarding", "playStyles"];
  const scales = ["energyLevel", "sociability", "anxietyLevel", "assertiveness"];
  if (Object.keys(profile).length !== keys.length || keys.some((key) => !(key in profile)) ||
      scales.some((key) => !Number.isInteger(profile[key]) || (profile[key] as number) < 1 || (profile[key] as number) > 5) ||
      !Number.isInteger(profile.resourceGuarding) || (profile.resourceGuarding as number) < 0 || (profile.resourceGuarding as number) > 5 ||
      !Array.isArray(profile.playStyles) || profile.playStyles.length > ALLOWED_PLAY_STYLES.size ||
      profile.playStyles.some((style) => typeof style !== "string" || !ALLOWED_PLAY_STYLES.has(style)) || new Set(profile.playStyles).size !== profile.playStyles.length) {
    throw new HttpError(502, "invalid_model_response", "AIのmatchingProfile値が不正です。");
  }
  return Object.fromEntries(keys.map((key) => [key, profile[key]]));
}

export async function handleRequest(request: Request, env: Env, _context: ExecutionContextLike, upstreamFetch: typeof fetch = fetch): Promise<Response> {
  let origin: string | null = null;
  const requestId = request.headers.get("cf-ray") ?? crypto.randomUUID();
  try {
    origin = assertCors(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(origin) });
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/health") return json({ ok: true, service: "pet-hotel-agent-api", orcaRouterConfigured: Boolean(env.ORCAROUTER_API_KEY), mediaStorageConfigured: false }, 200, origin);
    if (request.method === "POST" && path === "/api/analyze") return await analyze(request, env, origin, upstreamFetch, requestId);
    if (request.method === "POST" && path === "/api/media") throw new HttpError(410, "media_storage_disabled", "メディアは保存しません。/api/analyzeへdataUrlを直接送信してください。");
    throw new HttpError(404, "not_found", "エンドポイントが見つかりません。");
  } catch (error) {
    const known = error instanceof HttpError;
    const status = known ? error.status : 500;
    if (!known) console.error(JSON.stringify({ event: "worker_error", requestId }));
    return json({ ok: false, error: { code: known ? error.code : "internal_error", message: known ? error.message : "サーバーでエラーが発生しました。" }, requestId }, status, origin, status === 429 ? { "retry-after": "60" } : {});
  }
}

export default { fetch(request: Request, env: Env, context: ExecutionContextLike): Promise<Response> { return handleRequest(request, env, context); } };
