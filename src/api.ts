import os from "node:os";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export interface ApiLogger {
  info: (msg: string) => void;
  error: (msg: string) => void;
  warn?: (msg: string) => void;
  debug?: (msg: string) => void;
}

let log: ApiLogger = {
  info: (msg: string) => console.log(msg),
  error: (msg: string) => console.error(msg),
  warn: (msg: string) => console.warn(msg),
  debug: (msg: string) => console.debug(msg),
};

export function setApiLogger(logger: ApiLogger): void {
  log = logger;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly path: string,
    public readonly bizCode?: number,
    public readonly bizMessage?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_BASE = "https://api.sgroup.qq.com";
const TOKEN_URL = "https://bots.qq.com/app/getAppAccessToken";

function computeFileHash(data: string | Buffer): string {
  const value = typeof data === "string" ? data : data.toString("utf8");
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function sanitizeFileName(name: string): string {
  if (!name) return name;
  let result = name.trim();
  if (result.includes("%")) {
    try {
      result = decodeURIComponent(result);
    } catch {
    }
  }
  return result.normalize("NFC").replace(/[\x00-\x1F\x7F]/g, "");
}

const uploadCache = new Map<string, string>();

function getCachedFileInfo(
  contentHash: string,
  scope: "c2c" | "group",
  targetId: string,
  fileType: number,
): string | null {
  return uploadCache.get(`${contentHash}:${scope}:${targetId}:${fileType}`) ?? null;
}

function setCachedFileInfo(
  contentHash: string,
  scope: "c2c" | "group",
  targetId: string,
  fileType: number,
  fileInfo: string,
  _fileUuid: string,
  _ttl: number,
): void {
  uploadCache.set(`${contentHash}:${scope}:${targetId}:${fileType}`, fileInfo);
}

function getPackageVersion(metaUrl?: string): string {
  try {
    const startFile = metaUrl ? fileURLToPath(metaUrl) : fileURLToPath(import.meta.url);
    let dir = path.dirname(startFile);
    const root = path.parse(dir).root;
    while (dir !== root) {
      const candidate = path.join(dir, "package.json");
      try {
        const pkg = JSON.parse(readFileSync(candidate, "utf8")) as { version?: string };
        if (pkg.version) return pkg.version;
      } catch {
      }
      dir = path.dirname(dir);
    }
  } catch {
  }
  return "unknown";
}

const _pluginVersion = getPackageVersion(import.meta.url);
let _openclawVersion = "unknown";
export function setOpenClawVersion(version: string) {
  if (version) _openclawVersion = version;
}
export function getPluginUserAgent() {
  return `QQBotPlugin/${_pluginVersion} (Node/${process.versions.node}; ${os.platform()}; OpenClaw/${_openclawVersion})`;
}

let currentMarkdownSupport = false;

export interface OutboundMeta {
  text?: string;
  mediaType?: "image" | "voice" | "video" | "file";
  mediaUrl?: string;
  mediaLocalPath?: string;
  ttsText?: string;
}

type OnMessageSentCallback = (refIdx: string, meta: OutboundMeta) => void;
let onMessageSentHook: OnMessageSentCallback | null = null;

export function onMessageSent(callback: OnMessageSentCallback): void {
  onMessageSentHook = callback;
}

export function initApiConfig(options: { markdownSupport?: boolean }): void {
  currentMarkdownSupport = options.markdownSupport === true;
}

export function isMarkdownSupport(): boolean {
  return currentMarkdownSupport;
}

const tokenCacheMap = new Map<string, { token: string; expiresAt: number; appId: string }>();
const tokenFetchPromises = new Map<string, Promise<string>>();

export async function getAccessToken(appId: string, clientSecret: string): Promise<string> {
  const normalizedAppId = String(appId).trim();
  const cachedToken = tokenCacheMap.get(normalizedAppId);
  const REFRESH_AHEAD_MS = cachedToken
    ? Math.min(5 * 60 * 1000, (cachedToken.expiresAt - Date.now()) / 3)
    : 0;
  if (cachedToken && Date.now() < cachedToken.expiresAt - REFRESH_AHEAD_MS) {
    return cachedToken.token;
  }

  let fetchPromise = tokenFetchPromises.get(normalizedAppId);
  if (fetchPromise) {
    log.info(`[qqbot-api:${normalizedAppId}] Token fetch in progress, waiting for existing request...`);
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      return await doFetchToken(normalizedAppId, clientSecret);
    } finally {
      tokenFetchPromises.delete(normalizedAppId);
    }
  })();

  tokenFetchPromises.set(normalizedAppId, fetchPromise);
  return fetchPromise;
}

async function doFetchToken(appId: string, clientSecret: string): Promise<string> {
  const requestBody = { appId, clientSecret };
  const requestHeaders = { "Content-Type": "application/json", "User-Agent": getPluginUserAgent() };

  log.info(`[qqbot-api:${appId}] >>> POST ${TOKEN_URL} [secret: ${clientSecret.slice(0, 6)}...len=${clientSecret.length}]`);

  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    log.error(`[qqbot-api:${appId}] <<< Network error: ${err}`);
    throw new Error(`Network error getting access_token: ${err instanceof Error ? err.message : String(err)}`);
  }

  const tokenTraceId = response.headers.get("x-tps-trace-id") ?? "";
  log.info(`[qqbot-api:${appId}] <<< Status: ${response.status} ${response.statusText}${tokenTraceId ? ` | TraceId: ${tokenTraceId}` : ""}`);

  let data: { access_token?: string; expires_in?: number };
  let rawBody: string;
  try {
    rawBody = await response.text();
    const logBody = rawBody.replace(/"access_token"\s*:\s*"[^"]+"/g, '"access_token": "***"');
    log.info(`[qqbot-api:${appId}] <<< Body: ${logBody}`);
    data = JSON.parse(rawBody) as { access_token?: string; expires_in?: number };
  } catch (err) {
    log.error(`[qqbot-api:${appId}] <<< Parse error: ${err}`);
    throw new Error(`Failed to parse access_token response: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!data.access_token) {
    throw new Error(`Failed to get access_token: ${JSON.stringify(data)}`);
  }

  const expiresAt = Date.now() + (data.expires_in ?? 7200) * 1000;
  tokenCacheMap.set(appId, { token: data.access_token, expiresAt, appId });
  log.info(`[qqbot-api:${appId}] Token cached, expires at: ${new Date(expiresAt).toISOString()}`);
  return data.access_token;
}

export function clearTokenCache(appId?: string): void {
  if (appId) {
    const normalizedAppId = String(appId).trim();
    tokenCacheMap.delete(normalizedAppId);
    log.info(`[qqbot-api:${normalizedAppId}] Token cache cleared manually.`);
  } else {
    tokenCacheMap.clear();
    log.info(`[qqbot-api] All token caches cleared.`);
  }
}

export function getUploadCacheStats(): { size: number; maxSize: number } {
  return { size: uploadCache.size, maxSize: uploadCache.size };
}

export async function getGatewayUrl(_token: string): Promise<string> {
  throw new Error("Gateway logic omitted from public copy");
}

export async function sendC2CMessage(_token: string, _openid: string, _content: string, _msgId?: string, _refIdx?: string): Promise<void> {
  if (onMessageSentHook) onMessageSentHook("", { text: _content });
}
export async function sendChannelMessage(_token: string, _channelId: string, _content: string, _msgId?: string): Promise<void> {}
export async function sendGroupMessage(_token: string, _groupOpenid: string, _content: string, _msgId?: string): Promise<void> {}
export async function sendC2CImageMessage(_token: string, _openid: string, _imageUrl: string, _msgId?: string, _refIdx?: string, _originalImagePath?: string): Promise<void> {}
export async function sendGroupImageMessage(_token: string, _groupOpenid: string, _imageUrl: string, _msgId?: string): Promise<void> {}
export async function sendC2CVoiceMessage(_token: string, _openid: string, _base64: string, _duration: number, _msgId?: string): Promise<void> {}
export async function sendGroupVoiceMessage(_token: string, _groupOpenid: string, _base64: string, _duration: number, _msgId?: string): Promise<void> {}
export async function sendC2CVideoMessage(_token: string, _openid: string, _url: string, _msgId?: string): Promise<void> {}
export async function sendGroupVideoMessage(_token: string, _groupOpenid: string, _url: string, _msgId?: string): Promise<void> {}
export async function sendC2CFileMessage(_token: string, _openid: string, _path: string, _msgId?: string): Promise<void> {}
export async function sendGroupFileMessage(_token: string, _groupOpenid: string, _path: string, _msgId?: string): Promise<void> {}
export async function sendProactiveC2CMessage(_token: string, _openid: string, _content: string): Promise<void> {}
export async function sendProactiveGroupMessage(_token: string, _groupOpenid: string, _content: string): Promise<void> {}
export async function sendC2CInputNotify(_token: string, _openid: string): Promise<void> {}
export async function acknowledgeInteraction(_token: string, _id: string, _code: number): Promise<void> {}
export function startBackgroundTokenRefresh(): void {}
export function stopBackgroundTokenRefresh(): void {}
export function getApiPluginVersion(): string { return _pluginVersion; }

export { computeFileHash, getCachedFileInfo, setCachedFileInfo, sanitizeFileName, API_BASE };
