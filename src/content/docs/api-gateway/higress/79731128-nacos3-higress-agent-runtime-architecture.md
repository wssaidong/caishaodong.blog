---
title: Nacos 3.0 与 Higress 构建 AI Agent Runtime 平台架构设计
description: 深入探讨如何利用 Nacos 3.0 的 MCP Registry 和 A2A 能力与 Higress 网关集成，构建支持多租户的 AI Agent 运行时平台
pubDate: 2026-02-01
authors: caishaodong
tags: [Nacos, Higress, AI Agent, MCP Registry, A2A, 架构设计]
---

## 引言

随着大语言模型（LLM）技术的迅猛发展，AI Agent 已成为企业智能化转型的核心载体。Agent Runtime 旨在构建一个支持多租户的 AI Agent 运行时平台，为开发者和企业提供稳定、可扩展、安全的执行平台。

本架构设计文档描述如何利用 **Nacos 3.0** 的 MCP Registry 能力和 **Higress** 网关的服务发现机制，实现 Agent Runtime 的服务注册、发现和统一流量管理。

### 核心目标

| 目标 | 说明 |
|------|------|
| 低代码开箱即用 | 通过声明式配置创建 Agent，无需编写代码 |
| Agent 服务自动注册 | Agent 实例自动注册到 Nacos 3.0 MCP Registry |
| 统一流量入口 | 通过 Higress 网关实现流量的安全、可观测管理 |
| 多租户资源隔离 | 租户级别的资源配额、权限控制和数据隔离 |
| 弹性扩缩容 | 支持按需启动、Scale 0 能力 |

---

## 整体架构

### 架构分层

```mermaid
graph TB
    subgraph controller["Agent Runtime Controller 控制平面"]
        subgraph agent_ctrl["Agent Controller Agent 控制器"]
            watch_agent["监听 Agent CRD"]
            create_deploy["创建部署"]
        end

        subgraph nacos_ctrl["Nacos Registry Controller 注册中心控制器"]
            watch_svc["监听服务"]
            register["注册到 Nacos"]
            sync_meta["同步元数据"]
        end

        agent_res["Agent 资源"]
        deploy_res["Deployment 资源"]
        svc_res["Service 资源"]
        nacos_reg["Nacos 注册信息"]
        skill_meta["Skills 元数据"]

        watch_agent --> agent_res
        create_deploy --> deploy_res
        watch_svc --> svc_res
        register --> nacos_reg
        sync_meta --> skill_meta
    end

    subgraph nacos["Nacos 3.0 MCP Registry"]
        registry["Nacos Server<br/>服务注册中心"]
    end

    subgraph higress["Higress 网关"]
        gateway["Higress Gateway<br/>API 网关"]
    end

    nacos_reg -.注册.-> registry
    skill_meta -.注册.-> registry
    registry -.服务发现.-> gateway
```

### 核心组件说明

#### Higress 网关层

Higress 是基于 Envoy + Istio 的云原生 API 网关，实现了"三网合一"：

| 能力 | 说明 |
|------|------|
| 流量网关 | 负载均衡、熔断降级、限流 |
| 微服务网关 | 基于 Nacos 的服务发现、动态路由 |
| 安全网关 | 认证授权、提示词注入防护 |

通过 McpBridge 配置 Nacos 3.0 MCP Registry，实现服务注册与发现的集成。

#### Nacos 3.0 MCP Registry 与 A2A 能力

Nacos 3.0 新增的 **MCP Registry** 能力是本架构的核心。更重要的是，Nacos 从 **3.1.0 版本**开始正式支持 **A2A (Agent-to-Agent) Registry**，这是由 Google 开发并捐赠给 Linux 基金会的开放标准，旨在实现 AI Agent 之间的无缝通信与协作。

**Nacos 3.1.0 提供的 A2A Registry 核心能力：**

| 能力类别 | 具体能力 | 说明 |
|---------|---------|------|
| **Agent 注册** | AgentCard 注册 | 符合 A2A 协议的 AgentCard 标准定义 |
| | 命名空间隔离 | 通过 namespaceId 实现环境/租户级隔离 |
| | 名称管理 | 同一命名空间内 Agent name 唯一性保证 |
| | 版本管理 | 支持 Agent 的多版本管理与共存 |
| **Agent 发现** | 服务查询 | 通过 Nacos Client 查询订阅 Agent |
| | 多维筛选 | 按标签、能力、版本等维度检索 |
| | 订阅机制 | 实时接收 Agent 变更通知 |
| **A2A 协议支持** | AgentCard 标准 | 完全兼容 A2A 协议的 AgentCard 定义 |
| | 官方 Registry Protocol | 支持 A2A 官方 Registry Protocol (RoadMap) |
| | 多语言客户端 | Python/Go/Rust 等多语言支持 (RoadMap) |

**Nacos A2A Registry 与传统服务注册的对比：**

| 维度 | 传统服务注册 | A2A Registry (Nacos 3.1.0+) |
|------|-------------|----------------------------|
| 注册实体 | 微服务实例 | AI Agent (AgentCard) |
| 发现内容 | 服务地址 + 端口 | Agent 能力 + Skills 元数据 |
| 通信协议 | HTTP/gRPC | A2A 协议 + JSONRPC |
| 能力描述 | 简单服务名 | 结构化 AgentCard + Input/Output Schema |
| 版本管理 | 服务版本 | Agent 版本 + Skill 版本 |
| 调用方式 | 负载均衡路由 | 意图匹配 + Skill 路由 |

---

## 服务注册与发现流程

### Agent 服务注册流程

```mermaid
sequenceDiagram
    autonumber
    participant User as 用户/管理员
    participant K8s as Kubernetes
    participant Controller as Agent Controller
    participant Nacos as Nacos 3.0
    participant Higress as Higress 网关

    User->>K8s: 创建 Agent CRD
    activate K8s
    K8s->>Controller: 监听资源创建事件
    activate Controller
    Controller->>Controller: 解析 Agent 配置
    Controller->>K8s: 创建 Deployment/Service
    K8s-->>Controller: 创建成功
    deactivate K8s

    Controller->>Nacos: 注册 Agent 服务
    activate Nacos
    Note over Nacos: 包含 A2A Skills 元数据<br/>服务名、版本、能力等
    Nacos->>Higress: 推送服务变更
    activate Higress
    Higress->>Higress: 更新路由规则
    deactivate Higress
    Nacos-->>Controller: 注册成功
    deactivate Nacos

    Controller->>User: 返回创建成功
    deactivate Controller
```

### 服务发现与调用流程

```mermaid
sequenceDiagram
    autonumber
    participant Client as 客户端
    participant Higress as Higress 网关
    participant Nacos as Nacos 3.0
    participant Agent as Agent 实例
    participant MCP as MCP Server

    Client->>Higress: HTTPS 请求 (带 JWT)
    activate Higress
    Higress->>Higress: 身份认证与授权
    Note over Higress: 验证 JWT Token<br/>检查租户权限

    Higress->>Nacos: 查询目标 Agent 服务
    activate Nacos
    Nacos-->>Higress: 返回服务地址 + 元数据
    deactivate Nacos

    Higress->>Agent: 转发请求
    activate Agent
    Agent->>MCP: 调用 MCP 工具
    activate MCP
    MCP-->>Agent: 返回工具执行结果
    deactivate MCP

    Agent->>Higress: 返回响应 (流式 SSE)
    deactivate Agent
    Higress->>Client: 返回最终结果
    deactivate Higress
```

---

## A2A (Agent-to-Agent) 调用

### A2A 能力概述

**A2A (Agent-to-Agent)** 是 Agent Runtime 的核心能力之一，允许 Agent 之间相互调用，形成协作式的智能体网络。

基于 Nacos 3.1.0+ 的 A2A Registry，系统实现以下能力：

| 特性 | 说明 |
|------|------|
| **AgentCard 发现** | 通过 Nacos 3.1.0+ A2A Registry 查询 AgentCard，获取 Agent 的完整信息 |
| **Skill 发现** | 从 AgentCard.skills 字段获取 Agent 暴露的所有 Skills |
| **声明式引用** | 在 Agent 配置中直接引用其他 Agent 的 Skill |
| **A2A 协议调用** | 基于 A2A 协议标准调用目标 Agent 的 Skill |
| **安全调用** | 基于内部 JWT 的 Agent 间认证授权 |
| **流式响应** | 支持子 Agent 的流式输出传递给主 Agent |
| **链路追踪** | 完整的调用链路可观测性 |

### A2A 架构设计

```mermaid
graph TB
    subgraph gateway["Higress 网关层"]
        subgraph route_ctrl["Route Controller 路由控制器"]
            a2a_route["A2A 路由规则"]
            jwt_auth["JWT 认证"]
        end

        route_match["路由匹配"]
        auth_check["权限检查"]
        trace_inject["链路追踪注入"]

        a2a_route --> route_match
        jwt_auth --> auth_check
        route_match --> trace_inject
    end

    subgraph registry["Nacos 3.1.0+ A2A Registry (Agent 注册中心)"]
        subgraph agentcard_a["AgentCard: conversation-agent"]
            card_a_meta["name: conversation-agent<br/>version: 1.2.0<br/>url: http://...:8080/a2a"]
            card_a_skills["skills: [chat-v1, compose-v1]"]
        end

        subgraph agentcard_b["AgentCard: order-agent"]
            card_b_meta["name: order-agent<br/>version: 2.0.0<br/>url: http://...:8080/a2a"]
            card_b_skills["skills: [query-v1, analyze-v1]"]
        end
    end

    subgraph agents["Agent 实例层"]
        subgraph main_agent["主 Agent orchestrator-agent"]
            tool1["Tool: MCP Server"]
            tool2["Tool: AgentSkill 引用"]
        end

        subgraph sub_agent["子 Agent conversation-agent 暴露 A2A 端点"]
            skill1["Skill 处理器: chat-v1"]
            skill2["Skill 处理器: compose-v1"]
        end
    end

    trace_inject -.AgentCard 查询.-> registry
    registry -.返回 AgentCard + url.-> agents
    main_agent ==>|A2A 调用<br/>基于 AgentCard.url| sub_agent
```

### A2A 调用 API 规范

A2A 调用使用标准的 HTTP POST 请求格式：

**请求格式：**
- 路径：`POST /internal/a2a/{target-agent}/{skill-id}`
- 请求头：Authorization（内部 JWT）、X-A2A-Trace-ID、X-A2A-Parent-Agent、X-A2A-Parent-Request-ID
- 请求体：包含 input（输入数据）、context（会话上下文）、options（流式、超时等选项）

**响应格式（流式 SSE）：**
- 响应头：Content-Type: text/event-stream、X-A2A-Trace-ID、X-A2A-Agent-Name、X-A2A-Skill-ID
- 响应体：SSE 事件流，包含 start、chunk、done 等事件类型

### A2A 安全与认证

A2A 调用的安全机制包括：

1. **内部 JWT 认证**：使用专用的内部 JWT 进行 Agent 间认证
2. **权限策略**：默认策略、跨租户调用、敏感 Agent 保护、Skill 级别权限
3. **限流配置**：根据 Agent 的 tier 设置不同的调用频率限制

### A2A 可观测性

A2A 调用的可观测性配置包括：

1. **链路追踪**：采样率配置、追踪数据上报、Span 属性提取
2. **监控指标**：a2a_calls_total、a2a_call_duration_ms、a2a_calls_failed_total

### A2A 高级特性

1. **Skill 版本管理**：支持调用特定版本的 Skill，并可配置回退版本
2. **Skill 组合调用**：通过工作流配置协调多个 Agent 的 Skills
3. **A2A 缓存**：确定性缓存、语义缓存、可配置 TTL

### A2A 故障处理

1. **重试与超时**：默认重试策略、Skill 级别策略、熔断配置
2. **降级策略**：替代 Skill、缓存响应

---

## 安全架构

### 端到端安全链路

```mermaid
graph TB
    subgraph layer1["Layer 1: 网关安全 (Higress)"]
        subgraph gateway_sec["Gateway Security"]
            prompt_filter["提示词注入防护"]
            jwt_oauth["JWT/OAuth 认证"]
        end

        ip_control["IP 黑白名单"]
        waf["WAF 防护"]

        prompt_filter --> ip_control
        jwt_oauth --> waf
    end

    subgraph layer2["Layer 2: 服务安全 (Agent Runtime)"]
        subgraph runtime_sec["Runtime Security"]
            tenant_iso["租户级别资源隔离"]
            agent_acl["Agent 访问控制"]
        end

        audit_log["调用链审计日志"]

        tenant_iso --> audit_log
        agent_acl --> audit_log
    end

    subgraph layer3["Layer 3: 工具安全 (MCP Tools)"]
        subgraph tool_sec["Tool Security"]
            tool_perm["工具级权限控制"]
            confirm["敏感操作二次确认"]
        end

        sandbox["沙箱隔离执行"]

        tool_perm --> sandbox
        confirm --> sandbox
    end

    subgraph layer4["Layer 4: 数据安全"]
        subgraph data_sec["Data Security"]
            data_iso["用户对话数据隔离"]
            encrypt["加密存储"]
        end

        compliance["审计与合规"]

        data_iso --> compliance
        encrypt --> compliance
    end

    layer1 --> layer2
    layer2 --> layer3
    layer3 --> layer4
```

### 认证授权流程

```mermaid
sequenceDiagram
    autonumber
    participant Client as 客户端
    participant Higress as Higress 网关
    participant Auth as 统一权限平台
    participant Agent as Agent Runtime

    Client->>Higress: 请求 + JWT Token
    activate Higress
    Higress->>Auth: 验证 Token + 权限查询
    activate Auth
    Note over Auth: 验证 JWT 签名<br/>查询用户权限
    Auth-->>Higress: 返回用户信息 + 权限
    deactivate Auth

    Higress->>Higress: 检查租户配额
    Note over Higress: 验证并发数<br/>Token 配额等

    Higress->>Agent: 转发请求 (带用户上下文)
    activate Agent
    Agent->>Auth: 工具级权限校验
    activate Auth
    Note over Auth: 检查工具访问权限<br/>验证操作范围
    Auth-->>Agent: 返回工具访问权限
    deactivate Auth

    Agent->>Higress: 返回响应
    deactivate Agent
    Higress->>Client: 返回最终结果
    deactivate Higress
```

---

## 可观测性

### 监控指标

| 层级 | 监控指标 |
|------|----------|
| 网关层 | QPS、延迟、错误率、并发连接数 |
| Agent 层 | 调用量、Token 消耗、响应时间、成功率 |
| 工具层 | MCP 调用次数、执行耗时、失败率 |
| 资源层 | CPU、内存、GPU 使用率 |

### 日志与链路追踪

```mermaid
graph TB
    client["客户端请求<br/>带 JWT Token"]

    subgraph gateway["Higress 网关层"]
        subgraph gateway_log["Gateway Logging"]
            access_log["访问日志记录"]
            trace_inject["链路追踪注入"]
        end

        perf_mon["性能监控"]

        access_log --> perf_mon
        trace_inject --> perf_mon
    end

    subgraph agent["Agent Runtime 层"]
        subgraph agent_log["Agent Logging"]
            call_log["调用日志"]
            token_log["Token 使用记录"]
        end

        tool_trace["工具调用追踪"]

        call_log --> tool_trace
        token_log --> tool_trace
    end

    subgraph backend["后端服务层"]
        mcp["MCP Tools<br/>工具执行日志"]
        mem["Memory DB<br/>向量检索日志"]
        kb["Knowledge Base<br/>知识查询日志"]
    end

    client --> gateway
    gateway --> agent
    agent --> mcp
    agent --> mem
    agent --> kb
```

---

## 部署架构

### Kubernetes 部署

部署架构包括：
- Namespace：agent-runtime、higress-system
- Nacos 3.0：使用 StatefulSet 部署 3 副本集群，支持认证
- Higress 网关：生产环境配置 3 副本，资源配置 CPU 2000m、内存 4Gi

### 服务资源配置

Agent 服务资源配置包含：

1. **资源限制**：CPU 和内存的 requests/limits，可选 GPU 支持
2. **自动扩缩容**：最小/最大副本数、CPU/内存利用率目标、Scale to Zero 支持、冷却时间

---

## API 规范

### Agent 调用 API

**请求格式：**
- 路径：`POST /api/v1/agents/{agent-name}/chat`
- 请求头：Authorization (JWT Token)、Content-Type
- 请求体：message、sessionId、stream、parameters（temperature、maxTokens）

**响应（流式 SSE）：**
- message 事件：流式返回内容片段
- done 事件：结束标记，包含 Token 使用量

### A2A 调用 API

**请求格式：**
- 路径：`POST /api/v1/internal/a2a/{agent-name}/{skill-id}`
- 请求头：Authorization (内部 JWT)、Content-Type
- 请求体：input（A2A 调用输入）、context（调用上下文）

---

## 配置管理

### ModelConfig 配置

模型配置包含：
- Provider：模型提供商（如 Anthropic）
- Model：模型名称
- API Key Secret：密钥引用
- 模型参数：temperature、maxTokens、topP、timeout
- 请求头配置

### Memory 配置

记忆配置包含：
- Provider：向量数据库提供商（如 Pinecone）
- API Key Secret：密钥引用
- 索引配置：indexHost、namespace、topK、scoreThreshold

### RemoteMCPServer 配置

远程 MCP 服务器配置包含：
- URL：MCP 服务器地址
- Protocol：通信协议（如 SSE）
- Timeout：超时时间
- 认证配置：从 Secret 获取认证 Token

---

## 沙箱隔离

### Sandbox 架构

```mermaid
graph TB
    subgraph main["Agent 主进程 (安全可信区域)"]
        subgraph dialog_mgr["Dialog Manager 对话管理"]
            session["会话管理"]
            context["上下文维护"]
        end

        subgraph tool_scheduler["Tool Scheduler 工具调度"]
            select["工具选择"]
            coord["调度协调"]
        end

        memory["Memory Manager<br/>记忆管理"]

        session --> memory
        select --> memory
    end

    subgraph sandbox["Sandbox Tool (动态创建临时 Pod)"]
        subgraph pod["临时 Sandbox Pod"]
            browser["浏览器环境<br/>Headless Chrome"]
            shell["Shell 环境<br/>bash / sh"]
            file["文件操作<br/>临时读写"]
            vscode["VSCode 环境<br/>代码编辑"]
        end

        subgraph isolation["多层隔离机制"]
            gvisor["gVisor / Kata<br/>内核级隔离"]
            quota["ResourceQuota<br/>CPU/Memory 限制"]
            network["NetworkPolicy<br/>网络访问控制"]
        end

        pod --> isolation
    end

    main ==>|需要执行危险操作| sandbox
```

### Sandbox 配置

沙箱配置包含：
- 镜像：沙箱容器镜像
- 运行时：gVisor 或 kata-containers
- 资源限制：CPU、内存、临时存储
- 网络策略：允许的外部访问地址
- 生命周期：TTL（自动销毁时间）

---

## 灰度发布与版本管理

### 灰度发布策略

灰度发布配置包含：
- 版本配置：多个版本及其流量权重
- 灰度规则：基于用户属性（用户组、地区等）的路由规则
- 版本回滚：通过调整流量权重实现快速回滚

---

## 参考资源

### 开源项目
- [kagent](https://github.com/kagent-dev/kagent) - Agent 参考实现
- [agent-sandbox](https://github.com/kubernetes-sigs/agent-sandbox) - Kubernetes 沙箱规范

### 技术栈
- **Higress**: https://higress.cn/
- **Nacos**: https://nacos.io/
- **MCP Protocol**: Model Context Protocol

---

## 附录：核心名词表

| 名词 | 说明 |
|------|------|
| System Prompt | Agent 的系统提示词，定义角色身份、能力边界、行为规范 |
| Skills | 可复用的专业能力模块，Agent 可按需加载 |
| Memory | Agent 的记忆系统，支持长短期记忆和跨会话上下文 |
| Knowledge | Agent 的知识库，访问特定领域文档 |
| MCP | Model Context Protocol，Agent 能力扩展协议 |
| A2A | Agent-to-Agent，Agent 之间的调用机制 |
| BYO | Bring Your Own Agent，用户自编写的 Agent |
| Declarative | 声明式 Agent，通过 YAML 配置定义 |
