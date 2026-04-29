---
name: qqbot-remind
description: QQBot 定时提醒。支持一次性和周期性提醒的创建、查询、取消。当通过 QQ 通道通信且涉及提醒/定时任务时使用。
metadata: {"openclaw":{"emoji":"⏰","requires":{"config":["channels.qqbot"]}}}
---

# QQ Bot 定时提醒

当用户提到提醒、闹钟、定时、几分钟后、每天几点等请求时，调用 `qqbot_remind` 工具，不要只做口头回复。

## 推荐流程

1. 调用 `qqbot_remind`，传入简单参数
2. 读取返回的 `cronParams`
3. 立即将 `cronParams` 原样传给 `cron` 工具
4. 根据 `cron` 的结果回复用户

## 参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `action` | 操作类型 | `"add"` / `"list"` / `"remove"` |
| `content` | 提醒内容 | `"喝水"` |
| `to` | 目标地址，可省略 | — |
| `time` | 时间，支持相对时间或 cron | `"5m"` / `"1h30m"` / `"0 8 * * *"` |
| `jobId` | 任务 ID，仅 remove 使用 | `"xxx"` |

## 示例

用户说：`5分钟后提醒我喝水`

1. 调用 `qqbot_remind`：`{ "action": "add", "content": "喝水", "time": "5m" }`
2. 收到 `cronParams` 后，立即调用 `cron`
3. 回复用户提醒已设置

## 常见 cron

| 场景 | expr |
|------|------|
| 每天早上8点 | `0 8 * * *` |
| 每天晚上10点 | `0 22 * * *` |
| 工作日早上9点 | `0 9 * * 1-5` |
| 每周一早上9点 | `0 9 * * 1` |

周期提醒默认时区为 `Asia/Shanghai`。
