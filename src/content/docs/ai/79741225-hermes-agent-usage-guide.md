---
slug: hermes-agent-usage-guide
title: Hermes Agent：自进化AI Agent的开源之作
description: 全面介绍 Nous Research 开发的 Hermes Agent 开源项目，涵盖核心特性、安装配置、Skills 系统、内存管理、消息网关等
date: 2026-04-25
authors: caishaodong
tags: [AI, Agent, 开源工具, Nous Research, LLM]
---

## 引言

今天要介绍的是一个令人印象深刻的 AI Agent 开源项目——[Hermes Agent](https://github.com/NousResearch/hermes-agent)。这是由 [Nous Research](https://nousresearch.com) 团队开发的自进化 AI Agent，最大的亮点是内置了学习循环——它能从经验中创建 Skills，在使用中自我改进，主动记住知识，搜索历史对话，并在跨会话中建立对用户的深度认知模型。

**完全开源，MIT 协议。**

## 核心特性

| 特性 | 说明 |
|------|------|
| 🖥️ 真实终端界面 | 完整的 TUI，支持多行编辑、斜杠命令自动补全、对话历史、打断重定向、流式工具输出 |
| 🌐 多平台消息网关 | Telegram、Discord、Slack、WhatsApp、Signal、Email — 所有平台从一个网关进程驱动 |
| 🧠 闭合学习循环 | Agent 管理的记忆 + 周期性主动记忆、FTS5 会话搜索 + LLM 摘要、Honcho 方言用户建模 |
| ⏰ 定时自动化 | 内置 cron 调度器，支持任意平台交付。每日报告、深夜备份、每周审计——全用自然语言描述，无需值守 |
| 🎭 子 Agent 与并行化 | 生成隔离子 Agent 处理并行工作流。编写 Python 脚本通过 RPC 调用工具，将多步管道折叠为零上下文成本 |
| 🚀 随处运行 | 六种终端后端——本地、Docker、SSH、Daytona、Singularity、Modal。Daytona 和 Modal 提供无服务器持久化——空闲时休眠，按需唤醒，几乎零成本 |
| 📊 研究就绪 | 批量轨迹生成、Atropos RL 环境、轨迹压缩（用于训练下一代工具调用模型） |

## 支持的模型

Hermes Agent 不绑定任何特定模型，支持市面上几乎所有主流 LLM 提供商：

- [Nous Portal](https://portal.nousresearch.com)
- [OpenRouter](https://openrouter.ai)（200+ 模型）
- [NVIDIA NIM](https://build.nvidia.com)（Nemotron）
- [Xiaomi MiMo](https://platform.xiaomimimo.com)
- [z.ai/GLM](https://z.ai)
- [Kimi/Moonshot](https://platform.moonshot.ai)
- [MiniMax](https://www.minimax.io)
- [Hugging Face](https://huggingface.co)
- OpenAI
- 或任何兼容 OpenAI API 的自定义端点

切换模型只需 `hermes model`，无需代码修改，没有锁定。

## 快速开始

### 安装

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
```

支持 Linux、macOS、WSL2、Android（通过 Termux）。

安装后：

```bash
source ~/.bashrc    # 或 source ~/.zshrc
hermes              # 开始聊天！
```

### 基础命令

```bash
hermes              # 交互式 CLI — 开始对话
hermes model        # 选择 LLM 提供商和模型
hermes tools        # 配置启用的工具
hermes config set   # 设置单个配置值
hermes gateway      # 启动消息网关（Telegram、Discord 等）
hermes setup        # 运行完整设置向导（一键配置所有）
hermes claw migrate # 从 OpenClaw 迁移（如需）
hermes update       # 更新到最新版本
hermes doctor       # 诊断问题
```

## Skills 系统

Hermes Agent 的 Skills 系统是其最强大的特性之一——这是 Agent 的程序化记忆。

### 基本用法

- `/skills` — 浏览所有 Skills
- `/<skill-name>` — 使用特定 Skill

### 内置 Skill 示例

项目内置了大量实用的 Skills，涵盖：
- 代码开发（代码审查、重构建议）
- 数据处理（CSV 操作、JSON 处理）
- DevOps（Kubernetes、Docker）
- 研究辅助（论文摘要、知识图谱）

### 创建自定义 Skill

Skills 本质上是 Markdown 文件，位于 `~/.hermes/skills/` 目录。你可以用自然语言描述 Skill 的行为，Hermes 会自动解析并执行。

## 内存与用户建模

Hermes Agent 实现了多层次的记忆系统：

### 会话级记忆

- 自动总结对话要点
- 关键信息提取
- 上下文压缩（`/compress`）

### 跨会话记忆

- FTS5 全文搜索——搜索历史对话
- LLM 摘要——自动生成会话摘要
- 用户画像——通过 Honcho 方言持续学习用户偏好

### 持久化存储

所有记忆存储在 `~/.hermes/` 目录，可备份、可迁移。

## 消息网关

Hermes Agent 不仅是一个 CLI 工具，它还是一个消息网关。你可以在 Telegram、Discord、Slack、WhatsApp、Signal 等平台与它对话，而所有对话都会同步到同一个 Agent 实例。

### 配置示例：Telegram

```bash
hermes gateway setup  # 选择 Telegram，输入 Bot Token
hermes gateway start  # 启动网关
```

### 跨平台对话延续

在一个平台开始的对话，在另一个平台可以无缝继续。Agent 记得所有上下文，不受平台限制。

## 从 OpenClaw 迁移

如果你之前使用 OpenClaw，Hermes 提供了平滑迁移方案：

```bash
# 交互式迁移（完整预设）
hermes claw migrate

# 预览迁移内容
hermes claw migrate --dry-run

# 无敏感数据的迁移
hermes claw migrate --preset user-data

# 覆盖已有冲突
hermes claw migrate --overwrite
```

迁移内容：
- **SOUL.md** — persona 文件
- **Memories** — MEMORY.md 和 USER.md 条目
- **Skills** — 用户创建的 skills → `~/.hermes/skills/openclaw-imports/`
- **命令白名单** — 审批模式
- **消息设置** — 平台配置、允许用户、工作目录
- **API Keys** — 白名单密钥（Telegram、OpenRouter、OpenAI、Anthropic、ElevenLabs）
- **TTS 资产** — 工作区音频文件
- **工作区指令** — AGENTS.md

## 开发者指南

### 本地开发

```bash
git clone https://github.com/NousResearch/hermes-agent.git
cd hermes-agent
./setup-hermes.sh     # 安装 uv，创建 venv，安装 .[all]，符号链接 ~/.local/bin/hermes
./hermes              # 自动检测 venv
```

手动方式：

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uv venv venv --python 3.11
source venv/bin/activate
uv pip install -e ".[all,dev]"
scripts/run_tests.sh
```

### 项目结构

```
hermes-agent/
├── agent/            # Agent 核心逻辑
├── hermes_cli/      # CLI 命令实现
├── skills/          # 内置 Skills
├── tools/           # 工具集（40+）
├── environments/    # RL/Atropos 环境
├── gateway/         # 消息网关
├── ui-tui/          # 终端 UI
└── ...
```

## 应用场景

1. **个人 AI 助手** — 通过 Telegram/Discord 随时随地与 Agent 对话
2. **自动化任务** — 设置定时任务，自动执行复杂工作流
3. **代码助手** — 在终端中获取 AI 辅助编程支持
4. **跨平台统一体验** — 无论在哪个平台，都能获得一致的记忆和上下文
5. **研究工具** — 批量轨迹生成、RL 训练辅助

## 总结

Hermes Agent 是一个功能全面的自进化 AI Agent 平台。它的核心竞争力在于：

- **模型无关** — 自由选择提供商，不被锁定
- **自进化** — 内置学习循环，Agent 能从经验中成长
- **多平台** — CLI + 消息网关，任意平台随时访问
- **开源透明** — MIT 协议，完全透明

无论是想搭建个人 AI 助手，还是构建复杂的自动化工作流，Hermes Agent 都值得一试。

**项目地址：** https://github.com/NousResearch/hermes-agent
**文档：** https://hermes-agent.nousresearch.com/docs/