---
slug: kiro-gateway-usage-guide
title: Kiro Gateway：一个代理网关，让你在任何工具中使用Kiro API
description: 全面介绍Kiro Gateway开源项目，涵盖快速部署、认证配置、API使用示例，支持OpenAI和Anthropic兼容接口
date: 2026-03-31
authors: caishaodong
tags: [AI, API网关, 开源工具, Kiro, Claude, AWS]
---

## 引言

今天要介绍的是一个非常实用的开源项目——[Kiro Gateway](https://github.com/jwadow/kiro-gateway)。这是一个由 [@Jwadow](https://github.com/jwadow) 开发的代理网关，专门用于将 Kiro API（底层基于 Amazon Q Developer / AWS CodeWhisperer）转换为 OpenAI 和 Anthropic 兼容的 API 接口。

这意味着什么？你可以把它想象成一个"翻译器"——Kiro 原本只能在 Kiro IDE 或 Kiro CLI 中使用，但通过 Kiro Gateway，你可以把它接入任何支持 OpenAI 或 Anthropic API 的工具，比如：

- Claude Code / OpenCode / Codex app
- Cursor
- Cline / Roo Code / Kilo Code
- Obsidian
- LangChain
- Continue
- 甚至是 OpenAI SDK

**完全开源，AGPL-3.0 协议。**

## 支持的模型

> ⚠️ 模型可用性取决于你的 Kiro 订阅等级（免费/付费）。免费用户目前可以使用以下模型：

| 模型 | 特点 |
|------|------|
| **Claude Sonnet 4.5** | 平衡性能，适合编程、写作和通用任务（主力推荐） |
| **Claude Haiku 4.5** | 极速响应，适合简单任务和快速对话 |
| Claude Sonnet 4 | 上一代模型，仍可靠 |
| Claude 3.7 Sonnet | 兼容legacy |
| DeepSeek-V3.2 | 开源 MoE 模型（685B参数，37B活跃） |
| MiniMax M2.1 | 开源 MoE 模型（230B参数，10B活跃） |
| Qwen3-Coder-Next | 开源 MoE 模型（80B参数，3B活跃），编程专用 |

> 🔒 注意：Claude Opus 4.5 已于 2026年1月17日 从免费版移除。

**智能模型名称解析**：支持任意格式的模型名，如 `claude-sonnet-4-5`、`claude-sonnet-4.5`、甚至带日期版本 `claude-sonnet-4-5-20250929`，网关会自动标准化。

## 核心功能

| 功能 | 说明 |
|------|------|
| 🔌 OpenAI 兼容 API | `/v1/chat/completions` |
| 🔌 Anthropic 兼容 API | `/v1/messages` 原生端点 |
| 🌐 VPN/代理支持 | 支持 HTTP/SOCKS5，适合中国用户 |
| 🧠 Extended Thinking | （该项目独有） |
| 👁️ 视觉支持 | 可发送图片给模型 |
| 🛠️ 工具调用 | 支持 function calling |
| 💬 完整消息历史 | 传递完整对话上下文 |
| 📡 流式输出 | 完整 SSE 流式响应 |
| 🔄 重试机制 | 自动处理 403、429、5xx 错误 |
| 🔐 智能 Token 管理 | 过期前自动刷新 |

## 快速开始

### 方式一：原生 Python 部署

**前置要求：**
- Python 3.10+
- 已登录 Kiro IDE 的账号，或已配置 Kiro CLI（AWS SSO）

**安装步骤：**

```bash
# 克隆仓库
git clone https://github.com/jwadow/kiro-gateway.git
cd kiro-gateway

# 安装依赖
pip install -r requirements.txt

# 复制配置文件
cp .env.example .env
# 编辑 .env，填入你的凭证

# 启动服务
python main.py

# 或指定端口（默认8000被占用时）
python main.py --port 9000
```

服务启动后访问 `http://localhost:8000`。

### 方式二：Docker 部署（推荐）

```bash
# 1. 克隆并配置
git clone https://github.com/jwadow/kiro-gateway.git
cd kiro-gateway
cp .env.example .env
# 编辑 .env

# 2. 一键启动
docker-compose up -d

# 3. 检查状态
docker-compose logs -f
curl http://localhost:8000/health
```

或直接用 Docker Run：

```bash
docker run -d \
  -p 8000:8000 \
  --env-file .env \
  --name kiro-gateway \
  ghcr.io/jwadow/kiro-gateway:latest
```

## 配置详解：四种认证方式

这是最关键的部分。Kiro Gateway 支持四种认证方式，根据你的使用场景选择其一即可。

### 方式一：JSON 凭证文件（Kiro IDE）

```env
KIRO_CREDS_FILE="~/.aws/sso/cache/kiro-auth-token.json"
PROXY_API_KEY="my-super-secret-password-123"
```

适用于 Kiro IDE 个人账号或企业 SSO 账号。Kiro IDE 登录后会自动生成该文件。

### 方式二：环境变量

```env
REFRESH_TOKEN="your_kiro_refresh_token"
PROXY_API_KEY="my-super-secret-password-123"
PROFILE_ARN="arn:aws:codewhisperer:us-east-1:..."
KIRO_REGION="us-east-1"
```

### 方式三：AWS SSO 凭证（Kiro CLI）

```env
KIRO_CREDS_FILE="~/.aws/sso/cache/your-sso-cache-file.json"
PROXY_API_KEY="my-super-secret-password-123"
```

> 注意：AWS SSO 用户（Builder ID 和企业账号）**不需要** `PROFILE_ARN`，网关会自动处理。

### 方式四：kiro-cli SQLite 数据库

```env
KIRO_CLI_DB_FILE="~/.local/share/kiro-cli/data.sqlite3"
PROXY_API_KEY="my-super-secret-password-123"
```

数据库位置：

| CLI 工具 | 路径 |
|----------|------|
| kiro-cli | `~/.local/share/kiro-cli/data.sqlite3` |
| amazon-q-developer-cli | `~/.local/share/amazon-q/data.sqlite3` |

## 🌐 中国用户必备：VPN/代理配置

如果你在中国大陆或使用企业网络，需要配置代理才能访问 AWS 终端节点。

在 `.env` 中添加：

```env
# HTTP 代理
VPN_PROXY_URL=http://127.0.0.1:7890

# SOCKS5 代理
VPN_PROXY_URL=socks5://127.0.0.1:1080

# 带认证的企业代理
VPN_PROXY_URL=http://username:password@proxy.company.com:8080
```

支持的协议：HTTP、HTTPS、SOCKS5（常见 VPN 软件如 Clash、Sing-box、V2Ray 等都支持）。

## API 使用示例

### OpenAI 接口

**cURL：**

```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer my-super-secret-password-123" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

**Python OpenAI SDK：**

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="my-super-secret-password-123"
)

response = client.chat.completions.create(
    model="claude-sonnet-4-5",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"}
    ],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

**LangChain：**

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="http://localhost:8000/v1",
    api_key="my-super-secret-password-123",
    model="claude-sonnet-4-5"
)

response = llm.invoke("Hello, how are you?")
print(response.content)
```

### Anthropic 接口

**cURL：**

```bash
curl http://localhost:8000/v1/messages \
  -H "x-api-key: my-super-secret-password-123" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

**Python Anthropic SDK：**

```python
import anthropic

client = anthropic.Anthropic(
    api_key="my-super-secret-password-123",
    base_url="http://localhost:8000"
)

response = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.content[0].text)
```

### 工具调用（Function Calling）

```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer my-super-secret-password-123" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "What is the weather in London?"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get weather for a location",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {"type": "string", "description": "City name"}
          },
          "required": ["location"]
        }
      }
    }]
  }'
```

## 调试模式

默认调试日志是关闭的。在 `.env` 中启用：

```env
DEBUG_MODE=errors   # 只记录失败请求（推荐）
# DEBUG_MODE=all    # 记录所有请求
```

调试文件会保存在 `debug_logs/` 目录下，包含请求体、Kiro API 原始响应、转换后的响应、应用日志和错误详情。

## 实际应用场景

1. **在 Cursor 中使用 Claude Sonnet 4.5** —— 不需要 Anthropic API Key，通过 Kiro 免费使用
2. **在 LangChain 项目中接入 Kiro** —— 只需改 base_url，其他代码不变
3. **企业内网环境** —— 配置代理后通过公司防火墙访问 AWS
4. **本地开发调试** —— 通过流式输出实时查看 AI 响应

## 总结

Kiro Gateway 是一个非常巧妙的"桥接器"项目，它利用 Kiro（基于 Amazon Q Developer）的免费额度，让你可以在任何 OpenAI/Anthropic 兼容工具中使用 Claude 系列模型。项目支持四种认证方式、Docker 一键部署、VPN 代理绕过，非常适合：

- 想要在各种 IDE 中免费使用 Claude 的开发者
- 需要在企业内网使用 AI 工具的团队
- 想用 LangChain 等框架接入 Kiro 的 AI 工程师

唯一的限制是模型可用性取决于 Kiro 的免费配额，但对于日常开发来说，Claude Sonnet 4.5 和 Haiku 4.5 的组合已经能覆盖大部分场景。

**项目地址：** https://github.com/jwadow/kiro-gateway
