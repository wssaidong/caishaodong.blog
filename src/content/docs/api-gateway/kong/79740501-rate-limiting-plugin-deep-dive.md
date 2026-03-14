---
title: Kong Rate-Limiting 插件深度分析
description: 深入分析 Kong rate-limiting 限流插件的算法原理、源码实现与边界问题
pubDate: 2026-03-13
---

## 1. 概述

Kong 的 `rate-limiting` 插件是 API 网关中最常用的限流组件之一。本文基于 Kong 3.0.x 版本源码，深入分析其算法原理、核心实现以及潜在问题。

**源码位置**：`kong/plugins/rate-limiting/`

## 2. 算法识别：固定窗口计数器

### 2.1 结论

Kong 的 `rate-limiting` 插件使用的是 **固定窗口计数器算法（Fixed Window Counter）**，**不是**令牌桶（Token Bucket）也不是漏桶（Leaky Bucket）。

### 2.2 三种限流算法对比

| 特性 | 固定窗口计数器 | 令牌桶 | 漏桶 |
|------|----------------|--------|------|
| Kong rate-limiting | ✅ 使用 | ❌ 未使用 | ❌ 未使用 |
| 核心机制 | 时间窗口内计数 | 令牌生成与消耗 | 请求队列恒定流出 |
| 应对突发 | ❌ 窗口边界突发 | ✅ 可积累令牌 | ✅ 恒定速率 |
| 实现复杂度 | 简单 | 中等 | 复杂 |
| 内存占用 | 低 | 中（需存储桶状态） | 高（需维护队列） |

## 3. 源码结构分析

### 3.1 插件目录结构

```
kong/plugins/rate-limiting/
├── handler.lua      # 核心处理逻辑
├── policies/
│   ├── init.lua     # 策略路由与实现
│   └── cluster.lua  # 集群策略（数据库存储）
├── daos.lua         # 数据访问对象定义
├── expiration.lua   # 时间窗口过期配置
├── schema.lua       # 插件配置 Schema
└── migrations/      # 数据库迁移脚本
```

### 3.2 核心文件职责

| 文件 | 职责 |
|------|------|
| `handler.lua` | 请求拦截、限流判断、响应头设置 |
| `policies/init.lua` | 三种存储策略实现（local/cluster/redis） |
| `expiration.lua` | 定义各时间窗口的过期秒数 |
| `schema.lua` | 插件配置参数定义 |

## 4. 核心实现分析

### 4.1 时间窗口配置

```lua
-- expiration.lua
return {
  second = 1,
  minute = 60,
  hour   = 3600,
  day    = 86400,
  month  = 2592000,
  year   = 31536000,
}
```

每个时间窗口独立计数，窗口结束后计数器自动过期。

### 4.2 请求处理流程

```lua
-- handler.lua:access()
function RateLimitingHandler:access(conf)
  local current_timestamp = time() * 1000

  -- 1. 获取客户端标识
  local identifier = get_identifier(conf)

  -- 2. 加载配置的限流值
  local limits = {
    second = conf.second,
    minute = conf.minute,
    hour   = conf.hour,
    day    = conf.day,
    month  = conf.month,
    year   = conf.year,
  }

  -- 3. 获取当前使用量
  local usage, stop, err = get_usage(conf, identifier, current_timestamp, limits)

  -- 4. 超限则返回 429
  if stop then
    return kong.response.error(429, "API rate limit exceeded", headers)
  end

  -- 5. 异步增加计数器
  timer_at(0, increment, conf, limits, identifier, current_timestamp, 1)
end
```

### 4.3 限流判断逻辑

```lua
-- handler.lua:get_usage()
local function get_usage(conf, identifier, current_timestamp, limits)
  local usage = {}
  local stop

  for period, limit in pairs(limits) do
    -- 获取当前窗口的计数值
    local current_usage, err = policies[conf.policy].usage(conf, identifier, period, current_timestamp)

    -- 计算剩余配额
    local remaining = limit - current_usage

    usage[period] = {
      limit = limit,
      remaining = remaining,
    }

    -- 标记是否超限
    if remaining <= 0 then
      stop = period
    end
  end

  return usage, stop
end
```

**关键发现**：限流判断仅通过简单的 `limit - current_usage` 计算，没有令牌桶的"桶"概念，也没有漏桶的队列机制。

### 4.4 三种存储策略

#### 4.4.1 Local 策略（共享内存）

```lua
-- policies/init.lua - local 策略
["local"] = {
  increment = function(conf, limits, identifier, current_timestamp, value)
    local cache_key = get_local_key(conf, identifier, period, period_date)
    -- 使用 ngx.shared.DICT 的 incr 方法
    local newval, err = shm:incr(cache_key, value, 0, EXPIRATION[period])
  end,
  usage = function(conf, identifier, period, current_timestamp)
    local current_metric, err = shm:get(cache_key)
    return current_metric or 0
  end
}
```

**特点**：
- 基于 Nginx 共享内存（`ngx.shared.kong_rate_limiting_counters`）
- 单节点有效，不支持分布式
- 性能最高，但数据不持久

#### 4.4.2 Cluster 策略（数据库）

```lua
-- policies/init.lua - cluster 策略
["cluster"] = {
  increment = function(conf, limits, identifier, current_timestamp, value)
    local policy = policy_cluster[db.strategy]
    local ok, err = policy.increment(db.connector, limits, identifier,
                                     current_timestamp, service_id, route_id, value)
  end,
  usage = function(conf, identifier, period, current_timestamp)
    local row, err = policy.find(identifier, period, current_timestamp,
                                 service_id, route_id)
    return row and row.value or 0
  end
}
```

**特点**：
- 支持 PostgreSQL、Cassandra 等数据库
- 集群级别限流，所有节点共享计数
- 性能较低，依赖数据库连接

#### 4.4.3 Redis 策略

```lua
-- policies/init.lua - redis 策略
["redis"] = {
  increment = function(conf, limits, identifier, current_timestamp, value)
    local red, err = get_redis_connection(conf)

    red:init_pipeline()
    for i = 1, idx do
      red:incrby(keys[i], value)      -- 原子自增
      if expiration[i] then
        red:expire(keys[i], expiration[i])  -- 设置过期时间
      end
    end
    red:commit_pipeline()
  end,
  usage = function(conf, identifier, period, current_timestamp)
    local current_metric, err = red:get(cache_key)
    return current_metric or 0
  end
}
```

**特点**：
- 高性能分布式限流
- 支持集群级别限流
- 推荐生产环境使用

## 5. 限流标识策略

```lua
-- handler.lua:get_identifier()
local function get_identifier(conf)
  local identifier

  if conf.limit_by == "service" then
    identifier = (kong.router.get_service() or EMPTY).id

  elseif conf.limit_by == "consumer" then
    identifier = (kong.client.get_consumer() or
                  kong.client.get_credential() or EMPTY).id

  elseif conf.limit_by == "credential" then
    identifier = (kong.client.get_credential() or EMPTY).id

  elseif conf.limit_by == "header" then
    identifier = kong.request.get_header(conf.header_name)

  elseif conf.limit_by == "path" then
    local req_path = kong.request.get_path()
    if req_path == conf.path then
      identifier = req_path
    end
  end

  -- 默认使用客户端 IP
  return identifier or kong.client.get_forwarded_ip()
end
```

| limit_by 值 | 限流维度 |
|-------------|----------|
| `ip`（默认） | 客户端 IP 地址 |
| `service` | 服务 ID |
| `consumer` | 消费者或凭证 ID |
| `credential` | 凭证 ID |
| `header` | 指定请求头的值 |
| `path` | 请求路径 |

## 6. 响应头设计

插件会在响应中添加标准的限流头：

```lua
-- handler.lua
local RATELIMIT_LIMIT     = "RateLimit-Limit"
local RATELIMIT_REMAINING = "RateLimit-Remaining"
local RATELIMIT_RESET     = "RateLimit-Reset"
local RETRY_AFTER         = "Retry-After"

local X_RATELIMIT_LIMIT = {
  second = "X-RateLimit-Limit-Second",
  minute = "X-RateLimit-Limit-Minute",
  hour   = "X-RateLimit-Limit-Hour",
  day    = "X-RateLimit-Limit-Day",
  month  = "X-RateLimit-Limit-Month",
  year   = "X-RateLimit-Limit-Year",
}
```

**示例响应头**：

```
HTTP/1.1 200 OK
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 45
X-RateLimit-Limit-Second: 10
X-RateLimit-Remaining-Second: 8
X-RateLimit-Limit-Minute: 100
X-RateLimit-Remaining-Minute: 95
```

## 7. 边界突发问题分析

### 7.1 问题描述

固定窗口计数器算法存在 **边界突发问题（Boundary Burst Problem）**：

```
时间线: |----窗口1 (0-1s)----|----窗口2 (1-2s)----|
限制:   每秒 100 个请求

实际请求分布:
         90个请求              90个请求
            ↓                     ↓
时间:    0.9s                  1.1s
         |----|                |----|
              ↑                    ↑
           窗口1末尾           窗口2开头

结果: 0.2秒内允许了 180 个请求（远超 100/秒 的限制）
```

### 7.2 场景模拟

假设配置 `second: 100`（每秒 100 个请求）：

| 时间点 | 窗口 | 已用 | 剩余 | 请求结果 |
|--------|------|------|------|----------|
| 0.0s | 窗口1 | 0 | 100 | ✅ 允许 |
| 0.5s | 窗口1 | 50 | 50 | ✅ 允许 |
| 0.9s | 窗口1 | 99 | 1 | ✅ 允许 |
| 1.0s | 窗口2 | 0 | 100 | ✅ 允许（窗口重置）|
| 1.1s | 窗口2 | 50 | 50 | ✅ 允许 |

**关键问题**：在 0.9s-1.1s 这 0.2 秒内，可以发送约 100 个请求（99 + 1），远超预期的 100/秒。

### 7.3 攻击场景

恶意用户可以利用这个漏洞：

```python
import requests
import time

# 在窗口边界附近发送请求
while True:
    # 等待到窗口末尾
    now = time.time()
    wait_time = 1.0 - (now % 1.0) - 0.05  # 窗口结束前 50ms
    if wait_time > 0:
        time.sleep(wait_time)

    # 窗口1末尾发送 100 个请求
    for _ in range(100):
        requests.get(url)

    # 窗口2开头发送 100 个请求
    time.sleep(0.1)  # 等待窗口切换
    for _ in range(100):
        requests.get(url)

    # 0.15秒内发送了 200 个请求，是限制的 2 倍
```

## 8. 与 Rate-Limiting-Advanced 对比

Kong 企业版提供了 `rate-limiting-advanced` 插件，解决了部分问题：

| 特性 | rate-limiting | rate-limiting-advanced |
|------|---------------|------------------------|
| 算法 | 固定窗口计数器 | 滑动窗口 / 令牌桶 |
| 边界突发 | ❌ 存在 | ✅ 解决 |
| 精确限流 | ❌ 不精确 | ✅ 精确 |
| 支持策略 | local/cluster/redis | redis（必需） |
| 支持多限流维度 | ❌ 单一维度 | ✅ 多维度组合 |
| 企业版 | ❌ 开源版 | ✅ 企业版 |

## 9. 最佳实践建议

### 9.1 策略选择

```
┌─────────────────────────────────────────────────────────────┐
│                    存储策略选择决策树                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  单节点部署？                                                │
│     ├── 是 → local 策略（性能最优）                          │
│     └── 否 → 需要精确限流？                                  │
│                ├── 是 → redis 策略                          │
│                └── 否 → cluster 策略（不推荐，性能差）        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 配置建议

```yaml
# 推荐配置示例
plugins:
  - name: rate-limiting
    config:
      minute: 1000           # 分钟级限流
      policy: redis          # 使用 Redis 分布式限流
      limit_by: consumer     # 按消费者限流
      fault_tolerant: true   # 容错模式
      hide_client_headers: false  # 返回限流头

      # Redis 配置
      redis_host: redis.example.com
      redis_port: 6379
      redis_password: ${REDIS_PASSWORD}
      redis_database: 0
      redis_timeout: 2000
```

### 9.3 多级限流策略

建议使用多级限流来缓解边界突发问题：

```yaml
# 多级限流配置
plugins:
  - name: rate-limiting
    config:
      second: 20     # 秒级限流
      minute: 1000   # 分钟级限流
      hour: 50000    # 小时级限流
```

**原理**：即使秒级限流被绕过，分钟级限流仍然有效。

### 9.4 监控告警

```yaml
# 建议监控指标
metrics:
  - kong_http_requests_total{status="429"}  # 429 错误计数
  - rate_limit_usage_remaining               # 剩余配额
  - rate_limit_window_reset                  # 窗口重置时间
```

## 10. 总结

### 10.1 核心发现

1. **算法类型**：Kong `rate-limiting` 使用固定窗口计数器算法，实现简单但存在边界突发问题
2. **存储策略**：提供 local/cluster/redis 三种策略，生产环境推荐 Redis
3. **限流维度**：支持 IP、服务、消费者、凭证、请求头、路径等多种维度

### 10.2 局限性

1. **边界突发**：无法精确限流，允许短时 2x 突发
2. **单时间窗口**：不支持令牌桶的流量整形能力
3. **无平滑限流**：不支持请求排队或延迟处理

### 10.3 适用场景

- ✅ API 保护（防止恶意调用）
- ✅ 简单的流量控制
- ✅ 对精确限流要求不高的场景
- ❌ 需要精确限流的金融/支付场景
- ❌ 需要流量整形的场景

### 10.4 替代方案

对于需要更精确限流的场景，可考虑：

1. **Kong rate-limiting-advanced**（企业版）：滑动窗口算法
2. **自定义插件**：实现令牌桶或漏桶算法
3. **外部限流服务**：如 Envoy 的限流过滤器
