---
title: Higress 插件阶段详解：理解插件链与 HTTP 处理流程
date: 2026-03-28
description: 深入解析 Higress Wasm 插件的两套阶段体系——插件链阶段（AUTHN/AUTHZ/STATS）与 HTTP 处理阶段（请求头/Body/响应头/响应体），包括各阶段的作用、区别与适用场景。
---

# Higress 插件阶段详解：理解插件链与 HTTP 处理流程

Higress 的 Wasm 插件系统设计了两套相互正交的阶段体系，分别控制**插件在过滤器链中的位置**和**插件内部处理请求的时机**。理解这两套机制的区别与配合，是掌握 Higress 插件开发的关键。

## 一、两套阶段体系概述

Higress 插件阶段分为两个维度：

| 维度 | 阶段类型 | 作用 |
|------|---------|------|
| **插件链阶段** | `UNSPECIFIED_PHASE`、`AUTHN`、`AUTHZ`、`STATS` | 控制插件在 Envoy 过滤器链中的**插入位置** |
| **HTTP 处理阶段** | 请求头、请求体、响应头、响应体 | 控制插件**何时被调用**，以及可以处理请求/响应的哪部分数据 |

```
┌─────────────────────────────────────────────────────────────────┐
│                      Envoy HTTP Filter Chain                     │
├─────────────────────────────────────────────────────────────────┤
│  CORS → [Phase: AUTHN] → [Phase: AUTHZ] → RBAC → RateLimit      │
│                              ↓                                   │
│                    [Phase: STATS] → Fault → Router              │
│                                                                  │
│  UNSPECIFIED_PHASE: 插入在 Router 之前（过滤器链末端）            │
└─────────────────────────────────────────────────────────────────┘
```

## 二、插件链阶段（Phase）

### 2.1 阶段定义

插件链阶段定义了插件在 Envoy 过滤器链中的位置，基于 Istio WasmPlugin 的标准设计：

| 阶段 | 说明 | 典型用途 |
|------|------|---------|
| `AUTHN` | 插入在 Istio 认证过滤器**之前** | 请求认证（如 JWT、Basic Auth） |
| `AUTHZ` | 插入在 Istio 授权过滤器**之前**，认证过滤器**之后** | 权限校验、IP 白名单 |
| `STATS` | 插入在 Istio 统计过滤器**之前**，授权过滤器**之后** | 日志记录、监控埋点 |
| `UNSPECIFIED_PHASE` | 默认值，插入在过滤器链**末端**，路由器**之前** | 响应改写、流量标记 |

### 2.2 优先级（Priority）

在相同阶段内，`priority` 值越大，插件在插件链中位置越靠前（请求阶段先执行，响应阶段后执行）。

```yaml
spec:
  phase: AUTHN      # 插件链阶段
  priority: 200     # 阶段内优先级，值越大越靠前
```

### 2.3 各阶段适用场景

**AUTHN 阶段**——认证鉴权
- 要求在请求到达后端服务**之前**完成身份验证
- 典型插件：`jwt-auth`、`basic-auth`、`hmac-auth`
- 场景：验证用户身份、解析认证 Token

**AUTHZ 阶段**——授权控制
- 认证通过后，进行权限检查
- 典型插件：`ip-restriction`、`cors`
- 场景：IP 黑/白名单、跨域控制

**STATS 阶段**——日志与监控
- 在请求处理末端进行数据采集
- 典型插件：`key-rate-limit`、`easy-logger`
- 场景：限流计数、访问日志

**UNSPECIFIED_PHASE 阶段**——响应处理
- 插件位于过滤器链末端，适合**修改响应**
- 典型插件：`custom-response`、`transformer`
- 场景：响应状态码改写、响应体修改

## 三、HTTP 处理阶段

### 3.1 四种处理阶段

在插件链阶段确定后，插件内部的请求处理会依次经过以下四个阶段：

| 阶段 | 触发时机 | 挂载方法 |
|------|---------|---------|
| **HTTP 请求头处理** | 网关接收到客户端请求头数据时 | `ProcessRequestHeadersBy` |
| **HTTP 请求体处理** | 网关接收到客户端请求体数据时 | `ProcessRequestBodyBy` |
| **HTTP 响应头处理** | 网关接收到后端服务响应头时 | `ProcessResponseHeadersBy` |
| **HTTP 响应体处理** | 网关接收到后端服务响应体时 | `ProcessResponseBodyBy` |

### 3.2 各阶段可操作的数据

```
客户端请求                    网关插件处理                      后端服务
    │                            │                              │
    ├── 请求头 ──────────────────→ [RequestHeaders]              │
    │                            │   可读取/修改/添加/删除请求头    │
    │                            │                              │
    ├── 请求体 ──────────────────→ [RequestBody]                 │
    │                            │   可读取/修改请求体            │
    │                            │                              │
    │                            ├──────────────────────────────→│
    │                            │                              │
    │                            ←── [ResponseHeaders] ──────────┤
    │                            │   可读取/修改/添加/删除响应头   │
    │                            │                              │
    │                            ←── [ResponseBody] ─────────────┤
    │                            │   可读取/修改响应体            │
```

### 3.3 各阶段典型使用场景

**请求头处理阶段**
- 读取或修改请求头（如添加 `X-Request-ID`）
- 早期拦截请求（如认证检查）
- 调用外部服务进行验证（如调用 SSO 验证 Token）

**请求体处理阶段**
- 读取并修改请求体（如 JSON 数据改写）
- 提取请求体中的信息进行限流判断
- 请求体级别的安全检查

**响应头处理阶段**
- 添加响应头（如 `X-Easy-Logger: 1.0.0`）
- 读取或修改后端返回的状态码
- 响应级别的流量标记

**响应体处理阶段**
- 读取或修改响应体内容
- 根据响应内容决定是否记录日志
- 响应体级别的数据脱敏

## 四、插件链阶段与 HTTP 处理阶段的配合

这两个维度是**正交**的：插件链阶段决定「哪个插件先执行」，HTTP 处理阶段决定「插件内部的处理顺序」。

### 4.1 处理流程图

```
┌──────────────────────────────────────────────────────────────────┐
│                        请求处理流程                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [AUTHN Phase]  ──────────────────────────────────────────────►  │
│       │                                                          │
│       ├──► onHttpRequestHeaders()                                │
│       ├──► onHttpRequestBody()                                   │
│                                                                   │
│  [AUTHZ Phase]  ──────────────────────────────────────────────►  │
│       │                                                          │
│       ├──► onHttpRequestHeaders()                                │
│       ├──► onHttpRequestBody()                                   │
│                                                                   │
│  [STATS Phase]  ──────────────────────────────────────────────►  │
│       │                                                          │
│       ├──► onHttpRequestHeaders()                               │
│       ├──► onHttpRequestBody()                                   │
│                                                                   │
│  [UNSPECIFIED Phase] ──────────────────────────────────────────► │
│       │                                                          │
│       ├──► onHttpRequestHeaders()                                │
│       ├──► onHttpRequestBody()                                   │
│                                                                   │
│                              后端服务处理...                        │
│                                                                   │
│  [UNSPECIFIED Phase] ◄────────────────────────────────────────── │
│       │                                                          │
│       ├──► onHttpResponseHeaders()                              │
│       ├──► onHttpResponseBody()                                 │
│                                                                   │
│  [STATS Phase]  ◄────────────────────────────────────────────── │
│       │                                                          │
│       ├──► onHttpResponseHeaders()                               │
│       ├──► onHttpResponseBody()                                  │
│                                                                   │
│  [AUTHZ Phase]  ◄────────────────────────────────────────────── │
│       │                                                          │
│       ├──► onHttpResponseHeaders()                               │
│       ├──► onHttpResponseBody()                                  │
│                                                                   │
│  [AUTHN Phase]  ◄────────────────────────────────────────────── │
│       │                                                          │
│       ├──► onHttpResponseHeaders()                               │
│       └──► onHttpResponseBody()                                  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 典型插件配置示例

以下是一个完整的插件配置示例，展示了 phase 和 HTTP 处理阶段的配合：

```yaml
apiVersion: extensions.higress.io/v1alpha1
kind: WasmPlugin
metadata:
  name: my-plugin
  namespace: higress-system
spec:
  phase: AUTHN        # 插件链阶段：认证阶段
  priority: 200       # 优先级
  defaultConfig:
    enabled: true
  url: oci://higress-registry.cn-hangzhou.cr.aliyuncs.com/plugins/my-plugin:1.0.0
```

对应的 Go 插件代码：

```go
func main() {
    wrapper.SetCtx(
        "my-plugin",
        wrapper.ParseConfigBy(parseConfig),
        wrapper.ProcessRequestHeadersBy(onHttpRequestHeaders),  // 请求头阶段
        wrapper.ProcessRequestBodyBy(onHttpRequestBody),         // 请求体阶段
        wrapper.ProcessResponseHeadersBy(onHttpResponseHeaders), // 响应头阶段
        wrapper.ProcessResponseBodyBy(onHttpResponseBody),       // 响应体阶段
    )
}
```

## 五、阶段选择决策指南

### 5.1 插件链阶段选择

| 需求 | 推荐阶段 | 原因 |
|------|---------|------|
| 身份验证（Token 校验） | `AUTHN` | 在所有业务逻辑之前验证身份 |
| 权限检查（黑白名单） | `AUTHZ` | 认证通过后立即进行授权 |
| 限流控制 | `STATS` | 在业务处理后进行统计计数 |
| 响应改写 | `UNSPECIFIED_PHASE` | 在过滤器链末端，可访问完整响应 |
| 请求/响应日志 | `STATS` | 在业务处理后记录完整日志 |

### 5.2 HTTP 处理阶段选择

| 需求 | 推荐阶段 | 原因 |
|------|---------|------|
| 快速拦截无效请求 | `RequestHeaders` | 仅处理头信息，性能开销小 |
| 需要读取 Body 进行判断 | `RequestBody` | 可访问完整请求体 |
| 修改后端响应头 | `ResponseHeaders` | 在收到后端响应头时处理 |
| 脱敏或缓存响应 | `ResponseBody` | 可访问完整响应体 |

## 六、实际开发示例

### 6.1 场景：开发一个请求日志插件

需求：
1. 记录请求和响应的详细信息
2. 在 AUTHN 阶段之前记录原始请求
3. 在响应返回前完成日志记录

```go
func main() {
    wrapper.SetCtx(
        "request-logger",
        wrapper.ParseConfigBy(parseConfig),
        wrapper.ProcessRequestHeadersBy(onHttpRequestHeaders),
        wrapper.ProcessRequestBodyBy(onHttpRequestBody),
        wrapper.ProcessResponseHeadersBy(onHttpResponseHeaders),
        wrapper.ProcessResponseBodyBy(onHttpResponseBody),
    )
}

// 请求头处理：生成请求 ID，记录请求头
func onHttpRequestHeaders(ctx wrapper.HttpContext, config LoggerConfig, log wrapper.Log) types.Action {
    requestId := uuid.New().String()
    ctx.SetContext("requestId", requestId)

    headers, _ := proxywasm.GetHttpRequestHeaders()
    log.Infof("Request [%s] headers: %v", requestId, headers)
    return types.ActionContinue
}

// 请求体处理：记录请求体
func onHttpRequestBody(ctx wrapper.HttpContext, config LoggerConfig, body []byte, log wrapper.Log) types.Action {
    requestId := ctx.GetContext("requestId").(string)
    log.Infof("Request [%s] body: %s", requestId, string(body))
    return types.ActionContinue
}

// 响应头处理：添加追踪头
func onHttpResponseHeaders(ctx wrapper.HttpContext, config LoggerConfig, log wrapper.Log) types.Action {
    proxywasm.AddHttpResponseHeader("X-Logger", "1.0.0")
    return types.ActionContinue
}

// 响应体处理：记录响应内容
func onHttpResponseBody(ctx wrapper.HttpContext, config LoggerConfig, body []byte, log wrapper.Log) types.Action {
    requestId := ctx.GetContext("requestId").(string)
    log.Infof("Response [%s] body: %s", requestId, string(body))
    return types.ActionContinue
}
```

### 6.2 场景：开发一个响应改写插件

需求：在 UNSPECIFIED_PHASE 阶段，修改后端返回的响应

```yaml
spec:
  phase: UNSPECIFIED_PHASE
  priority: 100
```

```go
func main() {
    wrapper.SetCtx(
        "response-rewriter",
        wrapper.ParseConfigBy(parseConfig),
        wrapper.ProcessResponseHeadersBy(onHttpResponseHeaders),
        wrapper.ProcessResponseBodyBy(onHttpResponseBody),
    )
}

// 响应头处理：修改状态码
func onHttpResponseHeaders(ctx wrapper.HttpContext, config RewriterConfig, log wrapper.Log) types.Action {
    if config.rewriteStatus {
        proxywasm.ReplaceHttpResponseHeader(":status", "200")
    }
    return types.HeaderContinue
}

// 响应体处理：修改响应体
func onHttpResponseBody(ctx wrapper.HttpContext, config RewriterConfig, body []byte, log wrapper.Log) types.Action {
    if config.rewriteBody {
        proxywasm.ReplaceHttpResponseBody([]byte(`{"status":"success"}`))
    }
    return types.ActionContinue
}
```

## 七、总结

理解 Higress 插件的两套阶段体系是开发有效插件的基础：

1. **插件链阶段（Phase）**：决定插件在 Envoy 过滤器链中的位置，影响插件的执行顺序
2. **HTTP 处理阶段**：决定插件内部处理请求/响应的时机，影响可以访问和修改的数据

合理选择这两个阶段，可以实现：
- 在正确的时机进行认证、授权、限流等操作
- 访问和修改请求/响应的各个部分
- 多插件协同工作，形成完整的流量处理链

> 更多 Higress 插件开发信息，请参考 [Higress 官方文档](https://higress.cn/docs/latest/user/wasm-go/)。
