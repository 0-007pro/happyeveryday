import {
  type ChannelPlugin,
  type OpenClawConfig,
  applyAccountNameToChannelSection,
  deleteAccountFromConfigSection,
  setAccountEnabledInConfigSection,
} from "openclaw/plugin-sdk/core";

import type { ResolvedQQBotAccount } from "./types.js";
import {
  DEFAULT_ACCOUNT_ID,
  listQQBotAccountIds,
  resolveQQBotAccount,
  applyQQBotAccountConfig,
  resolveDefaultQQBotAccountId,
  resolveRequireMention,
  resolveToolPolicy,
  resolveGroupConfig,
} from "./config.js";
import { getQQBotRuntime } from "./runtime.js";

export const TEXT_CHUNK_LIMIT = 5000;

export function chunkText(text: string, limit: number): string[] {
  const runtime = getQQBotRuntime();
  return runtime.channel.text.chunkMarkdownText(text, limit);
}

export function stripMentionText(
  text: string,
  mentions?: Array<{ member_openid?: string; id?: string; user_openid?: string; is_you?: boolean; nickname?: string; username?: string }>,
): string {
  if (!text || !mentions?.length) return text;
  let cleaned = text;
  for (const m of mentions) {
    const openid = m.member_openid ?? m.id ?? m.user_openid;
    if (!openid) continue;
    if (m.is_you) {
      cleaned = cleaned.replace(new RegExp(`<@!?${openid}>`, "g"), "").trim();
    } else {
      const displayName = m.nickname ?? m.username;
      if (displayName) {
        cleaned = cleaned.replace(new RegExp(`<@!?${openid}>`, "g"), `@${displayName}`);
      }
    }
  }
  return cleaned;
}

export function detectWasMentioned({ eventType, mentions, content, mentionPatterns }: {
  eventType?: string;
  mentions?: Array<{ is_you?: boolean }>;
  content?: string;
  mentionPatterns?: string[];
}): boolean {
  if (mentions?.some((m) => m.is_you)) return true;
  if (eventType === "GROUP_AT_MESSAGE_CREATE") return true;
  if (mentionPatterns?.length && content) {
    for (const pattern of mentionPatterns) {
      try {
        if (new RegExp(pattern, "i").test(content)) return true;
      } catch {
      }
    }
  }
  return false;
}

export const qqbotPlugin: ChannelPlugin<ResolvedQQBotAccount> = {
  id: "qqbot",
  meta: {
    id: "qqbot",
    label: "QQ Bot",
    selectionLabel: "QQ Bot",
    docsPath: "/docs/channels/qqbot",
    blurb: "Connect to QQ via official QQ Bot API",
    order: 50,
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    reactions: false,
    threads: false,
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.qqbot"] },
  groups: {
    resolveRequireMention: ({ cfg, accountId, groupId }) => {
      if (!groupId) return undefined;
      return resolveRequireMention(cfg, groupId, accountId ?? undefined);
    },
    resolveToolPolicy: ({ cfg, accountId, groupId }) => {
      if (!groupId) return undefined;
      const policy = resolveToolPolicy(cfg, groupId, accountId ?? undefined);
      if (policy === "full") return undefined;
      if (policy === "none") return { allow: [], deny: ["*"] };
      return { allow: [] };
    },
    resolveGroupIntroHint: ({ cfg, accountId, groupId }) => {
      if (!groupId) return undefined;
      const groupCfg = resolveGroupConfig(cfg, groupId, accountId ?? undefined);
      const hints: string[] = [];
      if (groupCfg.name) hints.push(`当前群: ${groupCfg.name}`);
      return hints.join(" ") || undefined;
    },
  },
  mentions: {
    stripMentions: ({ text, ctx }) => {
      const mentions = (ctx as any)?.mentions as Array<{ member_openid?: string; id?: string; user_openid?: string; is_you?: boolean; nickname?: string; username?: string }> | undefined;
      return stripMentionText(text, mentions);
    },
  },
  config: {
    listAccountIds: (cfg) => listQQBotAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveQQBotAccount(cfg, accountId),
    defaultAccountId: (cfg) => resolveDefaultQQBotAccountId(cfg),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg,
        sectionKey: "qqbot",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg,
        sectionKey: "qqbot",
        accountId,
        clearBaseFields: ["appId", "clientSecret", "clientSecretFile", "name"],
      }),
    isConfigured: (account) => Boolean(account?.appId && account?.clientSecret),
    describeAccount: (account) => ({
      accountId: account?.accountId ?? DEFAULT_ACCOUNT_ID,
      name: account?.name,
      enabled: account?.enabled ?? false,
      configured: Boolean(account?.appId && account?.clientSecret),
      tokenSource: account?.secretSource,
    }),
    resolveAllowFrom: ({ cfg, accountId }: { cfg: OpenClawConfig; accountId?: string | null }) => {
      const account = resolveQQBotAccount(cfg, accountId ?? undefined);
      return (account.config?.allowFrom ?? []).map((entry: string | number) => String(entry)) as (string | number)[];
    },
    formatAllowFrom: ({ allowFrom }: { allowFrom: Array<string | number> }) =>
      allowFrom
        .map((entry: string | number) => String(entry).trim())
        .filter(Boolean)
        .map((entry: string) => entry.replace(/^qqbot:/i, ""))
        .map((entry: string) => entry.toUpperCase()),
  },
  setup: {
    resolveAccountId: ({ accountId }) => accountId?.trim().toLowerCase() || DEFAULT_ACCOUNT_ID,
    applyAccountName: ({ cfg, accountId, name }) =>
      applyAccountNameToChannelSection({
        cfg,
        channelKey: "qqbot",
        accountId,
        name,
      }),
    validateInput: ({ input }) => {
      if (!input.token && !input.tokenFile && !input.useEnv) {
        return "QQBot requires --token (format: appId:clientSecret) or --use-env";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      let appId = "";
      let clientSecret = "";
      if (input.token) {
        const parts = input.token.split(":");
        if (parts.length === 2) {
          appId = parts[0];
          clientSecret = parts[1];
        }
      }
      return applyQQBotAccountConfig(cfg, accountId, {
        appId,
        clientSecret,
        clientSecretFile: input.tokenFile,
        name: input.name,
        imageServerBaseUrl: (input as Record<string, unknown>).imageServerBaseUrl as string | undefined,
      }) as OpenClawConfig;
    },
  },
  messaging: {
    normalizeTarget: (target: string): string | undefined => {
      const id = target.replace(/^qqbot:/i, "");
      if (id.startsWith("c2c:") || id.startsWith("group:") || id.startsWith("channel:")) {
        return `qqbot:${id}`;
      }
      const openIdHexPattern = /^[0-9a-fA-F]{32}$/;
      if (openIdHexPattern.test(id)) return `qqbot:c2c:${id}`;
      const openIdUuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      if (openIdUuidPattern.test(id)) return `qqbot:c2c:${id}`;
      return undefined;
    },
    targetResolver: {
      looksLikeId: (id: string): boolean => {
        if (/^qqbot:(c2c|group|channel):/i.test(id)) return true;
        if (/^(c2c|group|channel):/i.test(id)) return true;
        if (/^[0-9a-fA-F]{32}$/.test(id)) return true;
        return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
      },
      hint: "QQ Bot 目标格式: qqbot:c2c:openid (私聊) 或 qqbot:group:groupid (群聊)",
    },
  },
  outbound: {
    deliveryMode: "direct",
    chunker: (text, limit) => getQQBotRuntime().channel.text.chunkMarkdownText(text, limit),
    chunkerMode: "markdown",
    textChunkLimit: 5000,
    sendText: async () => ({ channel: "qqbot" as const, messageId: "" }),
    sendMedia: async () => ({ channel: "qqbot" as const, messageId: "" }),
  },
  gateway: {
    startAccount: async () => {
      throw new Error("Gateway/runtime behavior omitted from public copy");
    },
    logoutAccount: async () => ({ ok: true, cleared: false, envToken: Boolean(process.env.QQBOT_CLIENT_SECRET), loggedOut: true }),
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      connected: false,
      lastConnectedAt: null,
      lastError: null,
      lastInboundAt: null,
      lastOutboundAt: null,
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      tokenSource: snapshot.tokenSource ?? "none",
      running: snapshot.running ?? false,
      connected: snapshot.connected ?? false,
      lastConnectedAt: snapshot.lastConnectedAt ?? null,
      lastError: snapshot.lastError ?? null,
    }),
    buildAccountSnapshot: ({ account, runtime }) => ({
      accountId: account?.accountId ?? DEFAULT_ACCOUNT_ID,
      name: account?.name,
      enabled: account?.enabled ?? false,
      configured: Boolean(account?.appId && account?.clientSecret),
      tokenSource: account?.secretSource,
      running: Boolean(runtime?.running ?? false),
      connected: Boolean(runtime?.connected ?? false),
      lastConnectedAt: runtime?.lastConnectedAt ?? null,
      lastError: runtime?.lastError ?? null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
    }),
  },
};
