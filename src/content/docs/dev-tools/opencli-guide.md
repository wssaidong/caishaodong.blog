---
title: OpenCLI 完全指南：把任何网站变成命令行工具
description: 详解 OpenCLI 的安装配置、79+ 平台适配器、AI Agent 集成，以及 8 大实战使用场景。零成本、零风控、复用浏览器登录态。
pubDate: 2026-04-06
tags: [AI, CLI, 自动化, 开发工具]
keywords: [OpenCLI, 命令行, 浏览器自动化, AI Agent, B站, 知乎, 小红书]
---

# OpenCLI 完全指南：把任何网站变成命令行工具

> **OpenCLI**（[github.com/jackwener/opencli](https://github.com/jackwener/opencli)）是一个开源 CLI 工具，能够把任何**网站**（B站、知乎、小红书、Twitter 等 79+ 平台）、**Electron 桌面应用**（Cursor、ChatGPT、Antigravity）以及**本地 CLI 工具**统一转化为命令行接口。

**核心特点：零风控 · 复用 Chrome 登录态 · AI 原生 · 零 LLM 成本**

## 亮点功能一览

- **79+ 网站适配器** — 覆盖 B站、知乎、小红书、Twitter、Reddit、HackerNews 等国内外主流平台
- **Electron 应用控制** — 通过 CDP 协议直接控制 Cursor、ChatGPT、Antigravity 等桌面应用
- **CLI 枢纽** — 统一入口调用 gh、docker、vercel 等本地 CLI，支持自动安装缺失工具
- **AI Agent 原生** — 可被 Claude Code、Cursor 等 AI Agent 直接调用，实现浏览器自动化
- **零成本运行** — 运行时不消耗任何 LLM Token，调用无限次也不花钱
- **账户安全** — 复用 Chrome/Chromium 登录态，凭证不离开浏览器

## 安装与配置

### 前置要求

- **Node.js**: >= 20.0.0（或 **Bun** >= 1.0）
- **Chrome 或 Chromium** 浏览器正在运行，且**已登录目标网站**

> ⚠️ **重要**：大多数命令复用你的 Chrome/Chromium 登录状态。运行命令前，必须先在 Chrome 中登录目标网站。

### 第一步：安装 Browser Bridge 扩展

OpenCLI 通过轻量级 Chrome 扩展与浏览器通信：

1. 到 [GitHub Releases](https://github.com/jackwener/opencli/releases) 下载最新的 `opencli-extension.zip` 并解压
2. 打开 `chrome://extensions`，启用右上角**开发者模式**
3. 点击**加载已解压的扩展程序**，选择解压后的文件夹

### 第二步：安装 OpenCLI

```bash
npm install -g @jackwener/opencli

# 安装 AI Skills（供 Claude Code / Cursor 使用）
npx skills add jackwener/opencli
```

### 第三步：验证

```bash
opencli doctor          # 检查扩展 + daemon 连通性
opencli daemon status   # 查看 daemon 运行状态
opencli list           # 查看所有可用命令
```

## 8 大实战使用场景

### 场景一：社交媒体管理

```bash
# B站热门视频 TOP10
opencli bilibili hot --limit 10

# Twitter 热搜前5
opencli twitter trending --limit 5

# Reddit 热门帖子
opencli reddit hot --limit 10

# 小红书搜索
opencli xiaohongshu search 程序员穿搭 --limit 10

# 知乎热榜
opencli zhihu hot --limit 5

# HackerNews（公共 API，无需浏览器）
opencli hackernews top --limit 5
```

### 场景二：内容下载

从各平台下载图片、视频、文章为本地文件。

```bash
# 小红书笔记（图片 + 视频）
opencli xiaohongshu download <笔记ID> --output ./downloads

# B站视频（需先安装 yt-dlp）
brew install yt-dlp
opencli bilibili download BV1xxx --output ./bilibili --quality 1080p

# Twitter 用户媒体
opencli twitter download elonmusk --limit 20 --output ./twitter

# 导出知乎文章为 Markdown（可下载图片）
opencli zhihu download "https://zhuanlan.zhihu.com/p/xxx" --output ./zhihu

# 微信公众号文章
opencli weixin download <文章链接> --output ./weixin

# Pixiv 插画（支持多页作品）
opencli pixiv download 12345678 --output ./pixiv
```

### 场景三：AI 应用控制

通过命令行控制 Cursor、ChatGPT、Antigravity 等 AI 应用。

```bash
# Cursor IDE
opencli cursor status                    # 查看状态
opencli cursor send "用 Python 写快速排序"   # 向 Composer 发指令
opencli cursor screenshot               # 截取当前界面
opencli cursor composer "重构这段代码"     # 使用 Composer

# ChatGPT 桌面客户端
opencli chatgpt new "解释什么是微服务架构"  # 新建对话
opencli chatgpt send "继续"              # 继续对话

# Antigravity Ultra
opencli antigravity status
opencli antigravity send "分析这篇文档"
```

### 场景四：开发者工具枢纽

OpenCLI 作为统一入口，调用本地 CLI 工具，支持**自动安装**缺失工具。

```bash
# GitHub CLI
opencli gh pr list --limit 5
opencli gh repo list

# Docker
opencli docker ps
opencli docker images

# Vercel
opencli vercel deploy --prod
opencli vercel logs

# 飞书 CLI（200+ 命令）
opencli lark-cli calendar +agenda
opencli lark-cli doc create --title "我的文档"

# 钉钉 / 企业微信
opencli dingtalk msg send --to user "hello"
opencli wecom msg send --to user "hello"
```

> **零配置透传**：OpenCLI 会把你的输入原样转发给底层二进制，保留原生 stdout/stderr 行为。如果工具未安装，会自动尝试通过包管理器安装后再执行。

### 场景五：AI Agent 浏览器自动化

给 AI Agent（Claude Code、Cursor）加载 `opencli-operate` skill，实现直接控制浏览器操作任意网站：

```bash
# 安装 operate skill
npx skills add jackwener/opencli --skill opencli-operate
```

之后 AI Agent 即可使用以下命令操作浏览器：

```bash
opencli operate open https://bilibili.com      # 打开页面
opencli operate click .video-card              # 点击元素
opencli operate type input[name=search] "程序员"  # 输入文字
opencli operate screenshot                     # 截图
opencli operate get .title                    # 获取文本
opencli operate scroll 300                    # 滚动
opencli operate network                       # 查看网络请求
```

### 场景六：金融数据查询

```bash
# 雪球热门股票
opencli xueqiu hot --limit 10

# 雅虎财经行情
opencli yahoo-finance quote AAPL

# 豆瓣电影 TOP250
opencli douban top250 --limit 10
```

### 场景七：求职招聘

```bash
# Boss 直聘搜索
opencli boss search 前端工程师 --city 广州

# LinkedIn 搜索
opencli linkedin search "software engineer" --limit 10
```

### 场景八：输出格式控制

```bash
# JSON 输出（方便脚本处理）
opencli hackernews top --limit 5 -f json

# YAML 输出
opencli zhihu hot --limit 5 -f yaml

# 默认表格输出（人类可读）
opencli bilibili hot --limit 5
```

## 内置命令速查表

| 平台 | 命令 | 模式 |
|------|------|------|
| B站 | `hot`, `search`, `ranking`, `download`, `dynamic` | 浏览器 |
| 知乎 | `hot`, `search`, `question`, `download` | 浏览器 |
| 小红书 | `search`, `feed`, `user`, `download`, `publish` | 浏览器 |
| Twitter/X | `trending`, `search`, `timeline`, `post`, `like` | 浏览器 |
| Reddit | `hot`, `frontpage`, `popular`, `search`, `subreddit` | 浏览器 |
| HackerNews | `top`, `new`, `best`, `ask`, `show`, `jobs` | 公共 API |
| Cursor | `status`, `send`, `composer`, `screenshot`, `dump` | 桌面端 |
| ChatGPT | `status`, `new`, `send`, `read`, `model` | 桌面端 |
| Antigravity | `status`, `send`, `dump`, `watch` | 桌面端 |
| GitHub (gh) | `pr list`, `repo`, `issue`, `workflow` | 透传 |
| Spotify | `auth`, `play`, `pause`, `search`, `queue` | OAuth API |
| Notion | `status`, `search`, `read`, `write`, `export` | 桌面端 |

> 完整 79+ 适配器列表请查看：[github.com/jackwener/opencli/docs/adapters/index.md](https://github.com/jackwener/opencli/blob/main/docs/adapters/index.md)

## 常见问题

### Q: 为什么返回空数据？

大多数命令依赖 Chrome 的登录态。请确认：
1. Chrome/Chromium 已打开并登录目标网站
2. 运行命令时浏览器没有被其他进程占用

### Q: 如何诊断问题？

```bash
opencli doctor          # 自动诊断并修复问题
opencli daemon status   # 查看 daemon 是否正常运行
opencli daemon stop     # 停止 daemon
opencli daemon start    # 手动启动 daemon
```

### Q: 如何自定义适配器？

使用 `opencli record` 可以记录浏览器操作自动生成适配器代码。也支持直接向 `clis/` 目录放入 `.ts` 或 `.yaml` 文件实现自动注册。

### Q: 视频下载需要什么？

B站等平台需要先安装 `yt-dlp`：

```bash
brew install yt-dlp
# 或
pip install yt-dlp
```

## 总结

OpenCLI 是一个极具创新性的工具，用**统一 CLI 接口**打破了网站、应用、工具之间的边界：

- ✅ **零配置**：安装即用，不需要 API Key
- ✅ **零成本**：运行不消耗 Token
- ✅ **账户安全**：复用浏览器登录，凭证不外泄
- ✅ **79+ 平台**：覆盖全球和中国主流平台
- ✅ **AI 原生**：天然支持 AI Agent 调用
- ✅ **可扩展**：支持自定义适配器和注册本地 CLI

**项目地址**：[github.com/jackwener/opencli](https://github.com/jackwener/opencli)
