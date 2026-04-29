# HappyEveryday 公开版 QQBot

这是基于本地 `openclaw-qqbot` 插件整理出的公开仓库版本，用于展示 QQBot 通道插件的核心源码结构与脱敏后的真实运行日志。

## 包含内容

- 公开可展示的 TypeScript 源码
- 插件元数据与入口文件
- 可公开的技能目录
- 基础升级脚本与命令行入口
- 脱敏后的多日运行日志
- License

## 已排除内容

- `node_modules`
- `dist`
- `logs`
- `sessions`
- `data`
- `tts`
- 凭证备份
- 已知用户数据
- 私人投喂数据
- 个性化 persona / `mi` 风格逻辑
- 与私聊风格、情绪投喂、个人关系设定相关的源码与引用

## 目录说明

- `index.ts`：插件入口
- `src/`：公开保留的核心源码
- `skills/`：可公开展示的技能文件
- `scripts/`：基础脚本
- `bin/`：命令行入口
- `openclaw.plugin.json`：插件元数据
- `happyeveryday_qqbot_runtime_log_multiday.txt`：脱敏后的多日运行日志

## 说明

这个版本是面向 GitHub 公开展示整理的安全副本，重点保留插件通道、配置、工具与日志证明材料，不包含任何个人信息、密钥、会话数据、用户数据或私有风格逻辑。

如果需要完整运行版本，应基于私有环境重新配置凭证、运行目录和业务逻辑。