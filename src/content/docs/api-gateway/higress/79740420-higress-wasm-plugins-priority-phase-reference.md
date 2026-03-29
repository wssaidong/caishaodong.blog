---
title: Higress WASM 插件优先级与阶段配置参考手册
date: 2026-03-29
description: 详细说明 Higress WASM-Go 插件系统中每个插件的优先级（Priority）和使用阶段（Phase），提供清晰的配置参考。
---

## 一、阶段与优先级概述

### 1.1 插件链四阶段

| 阶段 | 说明 | 典型用途 |
|------|------|---------|
| `AUTHN` | 插入在 Istio 认证过滤器**之前** | 身份验证（JWT、Basic Auth） |
| `AUTHZ` | 插入在 Istio 授权过滤器**之前** | 权限校验、IP 白名单、WAF |
| `STATS` | 插入在 Istio 统计过滤器**之前** | 日志记录、监控埋点、限流计数 |
| `UNSPECIFIED_PHASE` | 默认值，插入在过滤器链**末端** | 响应改写、AI 代理、流量标记 |

### 1.2 优先级规则

- **值越大越靠前**：在相同阶段内，`priority` 值越大，插件在插件链中位置越靠前
- **请求阶段先执行，响应阶段后执行**
- **推荐范围**：
  - `0-100`：基础处理（JWT 默认 0，transformer 默认 100）
  - `200-400`：认证授权（bot-detect 310，basic-auth 320，key-auth 321，waf 330，cors 340，oidc 350）
  - `400-600`：AI 处理（ai-rag 400，ai-transformer 410，cache-control 420，ai-search 440，ai-prompt-decorator 450）
  - `600+`：安全防护（ai-token-ratelimit 600，replay-protection 800）

## 二、认证类插件（AUTHN Phase）

| 插件 | 优先级 | 说明 |
|------|--------|------|
| `jwt-auth` | `0` | JWT 认证，默认最低优先级 |
| `ai-history` | `10` | AI 对话历史缓存 |
| `basic-auth` | `320` | HTTP Basic 认证 |
| `key-auth` | `321` | API Key 认证 |
| `hmac-auth-apisix` | 未指定 | HMAC 认证（APISIX 兼容） |
| `bot-detect` | `310` | 机器人检测 |
| `geo-ip` | 未指定 | 地理 IP 路由 |
| `ai-intent` | `1000` | AI 意图识别，最高优先级认证插件 |

### 配置示例

```yaml
apiVersion: extensions.higress.io/v1alpha1
kind: WasmPlugin
metadata:
  name: basic-auth
spec:
  phase: AUTHN
  priority: 320
  defaultConfig:
    # basic-auth 配置
```

## 三、授权类插件（AUTHZ Phase）

| 插件 | 优先级 | 说明 |
|------|--------|------|
| `ip-restriction` | `210` | IP 黑/白名单 |
| `waf` | `330` | Web 应用防火墙（Coraza/OWASP CRS） |
| `request-block` | 未指定 | 请求阻断（URL/Header/Body 模式匹配） |
| `cors` | `340` | 跨域资源共享 |
| `opa` | 未指定 | Open Policy Agent 集成 |

### 配置示例

```yaml
apiVersion: extensions.higress.io/v1alpha1
kind: WasmPlugin
metadata:
  name: waf
spec:
  phase: AUTHZ
  priority: 330
  defaultConfig:
    # WAF 配置
```

## 四、AI 代理插件（UNSPECIFIED_PHASE）

AI 类插件大多工作在 `UNSPECIFIED_PHASE` 阶段，通过 `priority` 控制执行顺序。

### 4.1 AI 核心插件

| 插件 | 优先级 | 说明 |
|------|--------|------|
| `ai-proxy` | `100` | AI 代理网关，支持 OpenAI/Anthropic/Cohere/Gemini 等 |
| `ai-quota` | `250/280/300` | AI 配额管理（Redis 后端） |
| `ai-statistics` | `250` | AI 使用统计 |
| `ai-token-ratelimit` | `100/600` | Token 限流（全局 100，规则 600） |

### 4.2 AI 增强插件

| 插件 | 优先级 | 说明 |
|------|--------|------|
| `ai-history` | `10` | 对话历史缓存（Redis） |
| `ai-cache` | 未指定 | AI 语义缓存（向量数据库） |
| `ai-rag` | `400` | 检索增强生成 |
| `ai-search` | `440` | AI 搜索与引用注入 |
| `ai-transformer` | `410` | HTTP 协议转换 |
| `ai-prompt-template` | 未指定 | Prompt 模板 |
| `ai-prompt-decorator` | `450` | Prompt 装饰（前置/后置消息） |
| `ai-json-resp` | `150` | JSON 响应验证与优化 |
| `ai-intent` | `1000` | 意图识别 |
| `ai-agent` | `200` | AI Agent（ReAct 模式） |
| `ai-image-reader` | 未指定 | AI 图片 OCR |
| `ai-security-guard` | 未指定 | AI 内容安全审核 |

### AI 插件执行顺序

```
ai-proxy (100)
    ↓
ai-json-resp (150)
    ↓
ai-history (10) ──────────────────→ ai-quota (250)
    ↓                               ↓
ai-agent (200)                   ai-statistics (250)
    ↓
ai-intent (1000)
    ↓
ai-rag (400)
    ↓
ai-transformer (410)
    ↓
ai-search (440)
    ↓
ai-prompt-decorator (450)
    ↓
ai-token-ratelimit (600)
```

## 五、限流与安全插件

### 5.1 限流插件

| 插件 | 优先级 | 阶段 | 说明 |
|------|--------|------|------|
| `cluster-key-rate-limit` | `20` | 未指定 | 集群 Key 限流（Redis） |
| `ip-restriction` | `210` | AUTHZ | IP 限制 |
| `ai-token-ratelimit` | `100/600` | 未指定 | Token 限流 |
| `replay-protection` | `800` | 未指定 | 重放攻击防护（Nonce） |

### 5.2 安全插件

| 插件 | 优先级 | 阶段 | 说明 |
|------|--------|------|------|
| `bot-detect` | `310` | AUTHN | 机器人检测 |
| `waf` | `330` | AUTHZ | WAF（Coraza） |
| `ai-security-guard` | 未指定 | 未指定 | AI 内容安全 |
| `hmac-auth-apisix` | 未指定 | AUTHN | HMAC 认证 |

## 六、流量处理插件

### 6.1 请求/响应转换

| 插件 | 优先级 | 阶段 | 说明 |
|------|--------|------|------|
| `transformer` | `100` | UNSPECIFIED | 请求/响应转换（Header/Query/Body） |
| `de-graphql` | 未指定 | 未指定 | GraphQL 转 REST |
| `jsonrpc-converter` | 未指定 | 未指定 | JSON-RPC 转换（MCP 协议） |

### 6.2 流量标记与路由

| 插件 | 优先级 | 阶段 | 说明 |
|------|--------|------|------|
| `traffic-tag` | `400` | 默认 | 流量标记（权重/内容） |
| `frontend-gray` | 未指定 | 未指定 | 前端灰度/AB 测试 |
| `geo-ip` | 未指定 | AUTHN | 地理 IP路由 |

### 6.3 缓存与响应

| 插件 | 优先级 | 说明 |
|------|--------|------|
| `cache-control` | `420` | Cache-Control 头处理 |
| `custom-response` | 未指定 | 自定义响应（Mock） |
| `ai-cache` | 未指定 | AI 语义缓存 |

## 七、日志与监控插件

| 插件 | 优先级 | 阶段 | 说明 |
|------|--------|------|------|
| `log-request-response` | 未指定 | 未指定 | 请求/响应日志 |
| `ai-statistics` | `250` | UNSPECIFIED | AI 使用统计 |
| `ai-quota` | `250/280/300` | UNSPECIFIED | 配额统计 |

## 八、外部集成插件

| 插件 | 优先级 | 说明 |
|------|--------|------|
| `ext-auth` | 未指定 | 外部认证服务（Envoy forward_auth 风格） |
| `http-call` | 未指定 | 外部 HTTP 调用 |
| `opa` | 未指定 | Open Policy Agent |
| `api-workflow` | 未指定 | API 工作流编排 |

## 九、完整优先级速查表

### 9.1 按优先级排序

| 优先级 | 插件 | 阶段 |
|--------|------|------|
| `0` | `jwt-auth` | UNSPECIFIED |
| `10` | `ai-history` | AUTHN |
| `20` | `cluster-key-rate-limit` | - |
| `100` | `ai-proxy`, `transformer` | UNSPECIFIED |
| `150` | `ai-json-resp` | - |
| `200` | `ai-agent` | - |
| `210` | `ip-restriction` | AUTHZ |
| `250` | `ai-quota`, `ai-statistics` | UNSPECIFIED |
| `280` | `ai-quota` | - |
| `300` | `ai-quota` | - |
| `310` | `bot-detect` | AUTHN |
| `320` | `basic-auth` | AUTHN |
| `321` | `key-auth` | AUTHN |
| `330` | `waf` | AUTHZ |
| `340` | `cors` | - |
| `350` | `oidc` | AUTHN |
| `400` | `traffic-tag`, `ai-rag` | 默认/UNSPECIFIED |
| `410` | `ai-transformer` | - |
| `420` | `cache-control` | - |
| `440` | `ai-search` | - |
| `450` | `ai-prompt-decorator` | - |
| `600` | `ai-token-ratelimit` | - |
| `800` | `replay-protection` | - |
| `1000` | `ai-intent` | AUTHN |

### 9.2 按阶段分组

**AUTHN 阶段**：
```
ai-history (10) → bot-detect (310) → basic-auth (320) → key-auth (321) → oidc (350) → ai-intent (1000)
```

**AUTHZ 阶段**：
```
ip-restriction (210) → waf (330)
```

**UNSPECIFIED_PHASE / 默认阶段**：
```
jwt-auth (0) → ai-proxy (100) → transformer (100) → ai-json-resp (150) → ai-agent (200)
→ ai-quota (250) → ai-statistics (250) → traffic-tag (400) → ai-rag (400)
→ ai-transformer (410) → cache-control (420) → ai-search (440) → ai-prompt-decorator (450)
→ ai-token-ratelimit (600) → replay-protection (800)
```

## 十、配置注意事项

### 10.1 阶段选择原则

| 需求 | 推荐阶段 | 原因 |
|------|---------|------|
| 身份验证 | `AUTHN` | 在业务逻辑之前完成 |
| 权限检查 | `AUTHZ` | 认证之后、统计之前 |
| 限流计数 | `STATS` | 业务处理后统计 |
| 响应改写 | `UNSPECIFIED` | 可访问完整响应 |
| AI 处理 | `UNSPECIFIED` | 大多数 AI 插件默认 |

### 10.2 优先级冲突处理

当多个插件需要处理同一请求时：

1. **相同阶段**：按优先级降序执行（值大先执行）
2. **不同阶段**：按 `AUTHN → AUTHZ → STATS → UNSPECIFIED` 顺序执行
3. **响应阶段**：执行顺序相反（UNSPECIFIED 先执行，AUTHN 后执行）

### 10.3 AI 插件串联

AI 插件通常需要按以下顺序串联：

```yaml
# 1. AI 代理（入口）
spec:
  phase: UNSPECIFIED_PHASE
  priority: 100

---
# 2. 请求处理（JSON 验证、意图识别、RAG）
spec:
  phase: UNSPECIFIED_PHASE
  priority: 150-400

---
# 3. 限流与配额
spec:
  phase: UNSPECIFIED_PHASE
  priority: 600
```

> 更多插件开发信息，请参考 [Higress 官方 Wasm 插件文档](https://higress.cn/docs/latest/user/wasm-go/)。
