---
name: qqbot-media
description: QQBot 富媒体收发能力。使用 <qqmedia> 标签，系统根据文件扩展名自动识别类型（图片/语音/视频/文件）。
metadata: {"openclaw":{"emoji":"📸","requires":{"config":["channels.qqbot"]}}}
---

# QQBot 富媒体收发

## 用法

```
<qqmedia>路径或URL</qqmedia>
```

系统根据文件扩展名自动识别类型并路由：
- 图片：`.jpg/.png/.gif/.webp/.bmp`
- 语音：`.silk/.wav/.mp3/.ogg/.aac/.flac`
- 视频：`.mp4/.mov/.avi/.mkv/.webm`
- 其他扩展名：文件
- 无扩展名 URL：默认按图片处理

## 规则

1. 路径必须是绝对路径，或以 `http` 开头
2. 必须使用成对标签：`<qqmedia>路径</qqmedia>`
3. 多个媒体用多个标签
4. 发送前检查文件大小
5. 图片、语音、视频、文件的大小上限分别为 30MB、20MB、100MB、100MB
