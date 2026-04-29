---
name: qqbot-channel
description: QQ 频道管理技能。查询频道列表、子频道、成员、发帖、公告、日程等操作。使用 qqbot_channel_api 工具代理 QQ 开放平台 HTTP 接口，自动处理 Token 鉴权。当用户需要查看频道、管理子频道、查询成员、发布帖子/公告/日程时使用此技能。
metadata: {"openclaw":{"emoji":"📡","requires":{"config":["channels.qqbot"]}}}
---

# QQ 频道 API 请求指导

`qqbot_channel_api` 是一个 QQ 开放平台 HTTP 代理工具，自动填充鉴权 Token。你只需要指定 HTTP 方法、API 路径、请求体和查询参数。

## 工具参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `method` | string | 是 | HTTP 方法：`GET`, `POST`, `PUT`, `PATCH`, `DELETE` |
| `path` | string | 是 | API 路径（不含域名），如 `/guilds/{guild_id}/channels`，需替换占位符为实际值 |
| `body` | object | 否 | 请求体 JSON（POST/PUT/PATCH 使用） |
| `query` | object | 否 | URL 查询参数键值对，值为字符串类型 |

> 基础 URL：`https://api.sgroup.qq.com`，鉴权头 `Authorization: QQBot {token}` 由工具自动填充。

## 接口速查

### 频道（Guild）

| 操作 | 方法 | 路径 | 参数说明 |
|------|------|------|----------|
| 获取频道列表 | `GET` | `/users/@me/guilds` | query: `before`, `after`, `limit`(最大100) |
| 获取频道 API 权限 | `GET` | `/guilds/{guild_id}/api_permission` | — |

### 子频道（Channel）

| 操作 | 方法 | 路径 | 参数说明 |
|------|------|------|----------|
| 获取子频道列表 | `GET` | `/guilds/{guild_id}/channels` | — |
| 获取子频道详情 | `GET` | `/channels/{channel_id}` | — |
| 创建子频道 | `POST` | `/guilds/{guild_id}/channels` | body: `name`*, `type`*, `position`*, `sub_type`, `parent_id`, `private_type`, `private_user_ids`, `speak_permission`, `application_id` |
| 修改子频道 | `PATCH` | `/channels/{channel_id}` | body: `name`, `position`, `parent_id`, `private_type`, `speak_permission` |
| 删除子频道 | `DELETE` | `/channels/{channel_id}` | 不可逆 |

### 成员（Member）

| 操作 | 方法 | 路径 | 参数说明 |
|------|------|------|----------|
| 获取成员列表 | `GET` | `/guilds/{guild_id}/members` | query: `after`(首次填0), `limit`(1-400) |
| 获取成员详情 | `GET` | `/guilds/{guild_id}/members/{user_id}` | — |
| 获取身份组成员列表 | `GET` | `/guilds/{guild_id}/roles/{role_id}/members` | query: `start_index`(首次填0), `limit`(1-400) |
| 获取在线成员数 | `GET` | `/channels/{channel_id}/online_nums` | — |

### 公告（Announces）

| 操作 | 方法 | 路径 | 参数说明 |
|------|------|------|----------|
| 创建公告 | `POST` | `/guilds/{guild_id}/announces` | body: `message_id`, `channel_id`, `announces_type`, `recommend_channels` |
| 删除公告 | `DELETE` | `/guilds/{guild_id}/announces/{message_id}` | `all` 删除所有 |

### 论坛（Forum）

| 操作 | 方法 | 路径 | 参数说明 |
|------|------|------|----------|
| 获取帖子列表 | `GET` | `/channels/{channel_id}/threads` | — |
| 获取帖子详情 | `GET` | `/channels/{channel_id}/threads/{thread_id}` | — |
| 发表帖子 | `PUT` | `/channels/{channel_id}/threads` | body: `title`*, `content`*, `format` |
| 删除帖子 | `DELETE` | `/channels/{channel_id}/threads/{thread_id}` | 不可逆 |
| 发表评论 | `POST` | `/channels/{channel_id}/threads/{thread_id}/comment` | body: `thread_author`*, `content`* |

### 日程（Schedule）

| 操作 | 方法 | 路径 | 参数说明 |
|------|------|------|----------|
| 创建日程 | `POST` | `/channels/{channel_id}/schedules` | body: `{ schedule: { name*, start_timestamp*, end_timestamp*, jump_channel_id, remind_type } }` |
| 修改日程 | `PATCH` | `/channels/{channel_id}/schedules/{schedule_id}` | body: `{ schedule: { name*, start_timestamp*, end_timestamp*, jump_channel_id, remind_type } }` |
| 删除日程 | `DELETE` | `/channels/{channel_id}/schedules/{schedule_id}` | 不可逆 |
