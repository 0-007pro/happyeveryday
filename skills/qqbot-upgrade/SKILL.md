---
name: qqbot-upgrade
description: 通过官方脚本将 openclaw-qqbot 插件升级到最新 npm 版本。当用户要求更新 QQ 机器人插件、升级 qqbot 扩展或同步官方最新版时使用。
metadata: {"openclaw":{"emoji":"⬆️","requires":{"config":["channels.qqbot"]}}}
---

# QQBot 插件升级

## 标准命令

在 bash 环境执行：

```bash
curl -fsSL https://raw.githubusercontent.com/tencent-connect/openclaw-qqbot/main/scripts/upgrade-via-npm.sh | bash
```

## 说明

- 脚本来源：`tencent-connect/openclaw-qqbot`
- 升级流程通过 npm 完成
- 仅在用户明确要求升级时执行
- 根据终端输出汇报成功或失败
