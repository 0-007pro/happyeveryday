import type { ResolvedQQBotAccount, QQBotAccountConfig, ToolPolicy, GroupConfig } from "./types.js";
import type { OpenClawConfig, GroupPolicy } from "openclaw/plugin-sdk";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type AgentEntry = { id?: string; groupChat?: { mentionPatterns?: string[]; historyLimit?: number } };

export function resolveMentionPatterns(cfg: OpenClawConfig, agentId?: string): string[] {
  if (agentId) {
    const agents = (cfg as Record<string, unknown>).agents as { list?: AgentEntry[] } | undefined;
    const entry = agents?.list?.find((a) => a.id?.trim().toLowerCase() === agentId.trim().toLowerCase());
    const agentGroupChat = entry?.groupChat;
    if (agentGroupChat && Object.hasOwn(agentGroupChat, "mentionPatterns")) {
      return agentGroupChat.mentionPatterns ?? [];
    }
  }
  const globalGroupChat = (cfg as any)?.messages?.groupChat;
  if (globalGroupChat && typeof globalGroupChat === "object" && Object.hasOwn(globalGroupChat, "mentionPatterns")) {
    return (globalGroupChat as { mentionPatterns?: string[] }).mentionPatterns ?? [];
  }
  return [];
}

export const DEFAULT_ACCOUNT_ID = "default";

type MatchedGroupAccessReason = "allowed" | "disabled" | "missing_match_input" | "empty_allowlist" | "not_allowlisted";

interface MatchedGroupAccessDecision {
  allowed: boolean;
  groupPolicy: GroupPolicy;
  reason: MatchedGroupAccessReason;
}

function evaluateMatchedGroupAccessForPolicy(params: {
  groupPolicy: GroupPolicy;
  allowlistConfigured: boolean;
  allowlistMatched: boolean;
  requireMatchInput?: boolean;
  hasMatchInput?: boolean;
}): MatchedGroupAccessDecision {
  if (params.groupPolicy === "disabled") {
    return { allowed: false, groupPolicy: params.groupPolicy, reason: "disabled" };
  }
  if (params.groupPolicy === "allowlist") {
    if (params.requireMatchInput && !params.hasMatchInput) {
      return { allowed: false, groupPolicy: params.groupPolicy, reason: "missing_match_input" };
    }
    if (!params.allowlistConfigured) {
      return { allowed: false, groupPolicy: params.groupPolicy, reason: "empty_allowlist" };
    }
    if (!params.allowlistMatched) {
      return { allowed: false, groupPolicy: params.groupPolicy, reason: "not_allowlisted" };
    }
  }
  return { allowed: true, groupPolicy: params.groupPolicy, reason: "allowed" };
}

interface QQBotChannelConfig extends QQBotAccountConfig {
  accounts?: Record<string, QQBotAccountConfig>;
}

function hasConfiguredAccounts(accounts?: Record<string, QQBotAccountConfig>): boolean {
  if (!accounts) return false;
  return Object.values(accounts).some((account) => normalizeAppId(account?.appId).length > 0);
}

function readOpenClawConfigFromDisk(): OpenClawConfig | undefined {
  try {
    const configPath = join(homedir(), ".openclaw", "openclaw.json");
    if (!existsSync(configPath)) return undefined;
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as OpenClawConfig;
  } catch {
    return undefined;
  }
}

function resolveQQBotChannelSection(cfg: OpenClawConfig): QQBotChannelConfig | undefined {
  const inMemory = cfg.channels?.qqbot as QQBotChannelConfig | undefined;
  const hasInMemoryConfig = normalizeAppId(inMemory?.appId).length > 0 || hasConfiguredAccounts(inMemory?.accounts);
  if (hasInMemoryConfig) return inMemory;

  const diskCfg = readOpenClawConfigFromDisk();
  const fromDisk = diskCfg?.channels?.qqbot as QQBotChannelConfig | undefined;
  if (!fromDisk) return inMemory;
  if (!inMemory) return fromDisk;

  return {
    ...fromDisk,
    ...inMemory,
    accounts: {
      ...(fromDisk.accounts ?? {}),
      ...(inMemory.accounts ?? {}),
    },
  };
}

const DEFAULT_GROUP_POLICY: GroupPolicy = "open";
const DEFAULT_GROUP_HISTORY_LIMIT = 50;
const DEFAULT_GROUP_CONFIG: Omit<Required<GroupConfig>, "prompt"> = {
  requireMention: true,
  ignoreOtherMentions: false,
  toolPolicy: "restricted",
  name: "",
  historyLimit: DEFAULT_GROUP_HISTORY_LIMIT,
};
const DEFAULT_GROUP_PROMPT = [
  "若发送者为机器人，仅在对方明确@你提问或请求协助具体任务时，以简洁明了的内容回复，",
  "避免与其他机器人产生抢答或多轮无意义对话。",
  "在群聊中优先让人类用户的消息得到响应，机器人之间保持协作而非竞争，确保对话有序不刷屏。",
].join("");

export function resolveGroupPolicy(cfg: OpenClawConfig, accountId?: string): GroupPolicy {
  const account = resolveQQBotAccount(cfg, accountId);
  return account.config?.groupPolicy ?? DEFAULT_GROUP_POLICY;
}

export function resolveGroupAllowFrom(cfg: OpenClawConfig, accountId?: string): string[] {
  const account = resolveQQBotAccount(cfg, accountId);
  return (account.config?.groupAllowFrom ?? []).map((id) => String(id).trim().toUpperCase());
}

export function isGroupAllowed(cfg: OpenClawConfig, groupOpenid: string, accountId?: string): boolean {
  const policy = resolveGroupPolicy(cfg, accountId);
  const allowList = resolveGroupAllowFrom(cfg, accountId);
  const allowlistConfigured = allowList.length > 0;
  const allowlistMatched = allowList.some((id) => id === "*" || id === groupOpenid.toUpperCase());

  return evaluateMatchedGroupAccessForPolicy({
    groupPolicy: policy,
    allowlistConfigured,
    allowlistMatched,
  }).allowed;
}

type ResolvedGroupConfig = Omit<Required<GroupConfig>, "prompt"> & Pick<GroupConfig, "prompt">;

export function resolveGroupConfig(cfg: OpenClawConfig, groupOpenid: string, accountId?: string): ResolvedGroupConfig {
  const account = resolveQQBotAccount(cfg, accountId);
  const groups = account.config?.groups ?? {};

  const wildcardCfg = groups["*"] ?? {};
  const specificCfg = groups[groupOpenid] ?? {};

  return {
    requireMention: specificCfg.requireMention ?? wildcardCfg.requireMention ?? DEFAULT_GROUP_CONFIG.requireMention,
    ignoreOtherMentions: specificCfg.ignoreOtherMentions ?? wildcardCfg.ignoreOtherMentions ?? DEFAULT_GROUP_CONFIG.ignoreOtherMentions,
    toolPolicy: specificCfg.toolPolicy ?? wildcardCfg.toolPolicy ?? DEFAULT_GROUP_CONFIG.toolPolicy,
    name: specificCfg.name ?? wildcardCfg.name ?? DEFAULT_GROUP_CONFIG.name,
    prompt: specificCfg.prompt ?? wildcardCfg.prompt,
    historyLimit: specificCfg.historyLimit ?? wildcardCfg.historyLimit ?? DEFAULT_GROUP_CONFIG.historyLimit,
  };
}

export function resolveHistoryLimit(cfg: OpenClawConfig, groupOpenid: string, accountId?: string): number {
  return Math.max(0, resolveGroupConfig(cfg, groupOpenid, accountId).historyLimit);
}

export function resolveGroupPrompt(cfg: OpenClawConfig, groupOpenid: string, accountId?: string): string {
  const account = resolveQQBotAccount(cfg, accountId);
  const groups = account.config?.groups ?? {};
  return groups[groupOpenid]?.prompt ?? groups["*"]?.prompt ?? DEFAULT_GROUP_PROMPT;
}

export function resolveRequireMention(cfg: OpenClawConfig, groupOpenid: string, accountId?: string): boolean {
  return resolveGroupConfig(cfg, groupOpenid, accountId).requireMention;
}

export function resolveIgnoreOtherMentions(cfg: OpenClawConfig, groupOpenid: string, accountId?: string): boolean {
  return resolveGroupConfig(cfg, groupOpenid, accountId).ignoreOtherMentions;
}

export function resolveToolPolicy(cfg: OpenClawConfig, groupOpenid: string, accountId?: string): ToolPolicy {
  return resolveGroupConfig(cfg, groupOpenid, accountId).toolPolicy;
}

export function resolveGroupName(cfg: OpenClawConfig, groupOpenid: string, accountId?: string): string {
  const name = resolveGroupConfig(cfg, groupOpenid, accountId).name;
  return name || groupOpenid.slice(0, 8);
}

function normalizeAppId(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).trim();
}

export function listQQBotAccountIds(cfg: OpenClawConfig): string[] {
  const ids = new Set<string>();
  const qqbot = resolveQQBotChannelSection(cfg);

  if (qqbot?.appId) ids.add(DEFAULT_ACCOUNT_ID);
  if (qqbot?.accounts) {
    for (const accountId of Object.keys(qqbot.accounts)) {
      if (qqbot.accounts[accountId]?.appId) ids.add(accountId);
    }
  }
  return Array.from(ids);
}

export function resolveDefaultQQBotAccountId(cfg: OpenClawConfig): string {
  const ids = listQQBotAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) return DEFAULT_ACCOUNT_ID;
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

export function resolveQQBotAccount(cfg: OpenClawConfig, accountId?: string): ResolvedQQBotAccount {
  const qqbot = resolveQQBotChannelSection(cfg) ?? {};
  const resolvedAccountId = (accountId ?? resolveDefaultQQBotAccountId(cfg)).trim().toLowerCase() || DEFAULT_ACCOUNT_ID;
  const baseConfig = qqbot as QQBotAccountConfig;
  const nestedConfig = resolvedAccountId === DEFAULT_ACCOUNT_ID ? undefined : qqbot.accounts?.[resolvedAccountId];
  const config: QQBotAccountConfig = { ...baseConfig, ...(nestedConfig ?? {}) };

  let clientSecret = "";
  let secretSource: ResolvedQQBotAccount["secretSource"] = "none";
  if (config.clientSecret) {
    clientSecret = config.clientSecret;
    secretSource = "config";
  } else if (config.clientSecretFile && existsSync(config.clientSecretFile)) {
    clientSecret = readFileSync(config.clientSecretFile, "utf-8").trim();
    secretSource = "file";
  } else if (process.env.QQBOT_CLIENT_SECRET) {
    clientSecret = process.env.QQBOT_CLIENT_SECRET;
    secretSource = "env";
  }

  return {
    accountId: resolvedAccountId,
    name: config.name,
    enabled: config.enabled ?? true,
    appId: normalizeAppId(config.appId),
    clientSecret,
    secretSource,
    systemPrompt: config.systemPrompt,
    imageServerBaseUrl: config.imageServerBaseUrl,
    markdownSupport: config.markdownSupport !== false,
    config,
  };
}

export function applyQQBotAccountConfig(
  cfg: OpenClawConfig,
  accountId: string,
  input: {
    appId?: string;
    clientSecret?: string;
    clientSecretFile?: string;
    name?: string;
    imageServerBaseUrl?: string;
  },
): OpenClawConfig {
  const nextCfg = { ...cfg, channels: { ...(cfg.channels ?? {}) } } as OpenClawConfig;
  const current = (nextCfg.channels.qqbot as QQBotChannelConfig | undefined) ?? {};

  if (accountId === DEFAULT_ACCOUNT_ID) {
    nextCfg.channels.qqbot = {
      ...current,
      enabled: true,
      appId: input.appId ?? current.appId,
      clientSecret: input.clientSecret ?? current.clientSecret,
      clientSecretFile: input.clientSecretFile ?? current.clientSecretFile,
      name: input.name ?? current.name,
      imageServerBaseUrl: input.imageServerBaseUrl ?? current.imageServerBaseUrl,
    } as any;
    return nextCfg;
  }

  const accounts = { ...(current.accounts ?? {}) };
  accounts[accountId] = {
    ...(accounts[accountId] ?? {}),
    enabled: true,
    appId: input.appId ?? accounts[accountId]?.appId,
    clientSecret: input.clientSecret ?? accounts[accountId]?.clientSecret,
    clientSecretFile: input.clientSecretFile ?? accounts[accountId]?.clientSecretFile,
    name: input.name ?? accounts[accountId]?.name,
    imageServerBaseUrl: input.imageServerBaseUrl ?? accounts[accountId]?.imageServerBaseUrl,
  };

  nextCfg.channels.qqbot = {
    ...current,
    accounts,
  } as any;

  return nextCfg;
}
