// ── QQ 消息类型常量（message_type 枚举值） ──
/** 普通文本消息 */
export const MSG_TYPE_TEXT = 0;
/** 引用（回复）消息 */
export const MSG_TYPE_QUOTE = 103;

export interface QQBotConfig {
  appId: string;
  clientSecret?: string;
  clientSecretFile?: string;
}

export interface ResolvedQQBotAccount {
  accountId: string;
  name?: string;
  enabled: boolean;
  appId: string;
  clientSecret: string;
  secretSource: "config" | "file" | "env" | "none";
  systemPrompt?: string;
  imageServerBaseUrl?: string;
  markdownSupport: boolean;
  config: QQBotAccountConfig;
}

export type GroupPolicy = "open" | "allowlist" | "disabled";
export type ToolPolicy = "full" | "restricted" | "none";

export interface GroupConfig {
  requireMention?: boolean;
  ignoreOtherMentions?: boolean;
  toolPolicy?: ToolPolicy;
  name?: string;
  prompt?: string;
  historyLimit?: number;
}

export interface QQBotAccountConfig {
  enabled?: boolean;
  name?: string;
  appId?: string;
  clientSecret?: string;
  clientSecretFile?: string;
  dmPolicy?: "open" | "pairing" | "allowlist";
  allowFrom?: string[];
  groupPolicy?: GroupPolicy;
  groupAllowFrom?: string[];
  groups?: Record<string, GroupConfig>;
  systemPrompt?: string;
  imageServerBaseUrl?: string;
  markdownSupport?: boolean;
}
