---
title: Kong Rate-Limiting Redis 策略边界效应分析
description: 基于 Kong 3.0.1 源码，深入分析 Redis 固定窗口限流在滑动窗口语义下的 7 个边界效应及数学证明
pubDate: 2026-05-20
---

## 前言

使用 Kong 的 `rate-limiting` 插件（Redis 策略）时，配置 `second=100`，但实测 90 QPS 就能打满。表面看是"限流不准"，根源是固定窗口算法本身存在天然的边界效应，加上 Kong 实现中的几个工程细节，共同导致了**实际通过的请求数远大于配置的 limit**。

本文从 Kong 3.0.1 源码出发，完整梳理所有边界效应，方向全部指向"多放"。

<!-- more -->

## 请求执行路径

```
请求到达
  │
  ├─ handler.lua:121   current_timestamp = ngx.time() * 1000
  ├─ handler.lua:124   identifier = get_identifier(conf)
  ├─ handler.lua:137   get_usage() ─→ policies.redis.usage()
  │                        │
  │                        └─ policies/init.lua:241  red:get(key)  ← Redis GET（同步）
  │
  │   remaining = limit - counter
  │   remaining ≤ 0 ? ──→ 429
  │   remaining > 0  ──→ 放行，设置 headers
  │
  └─ handler.lua:201   timer_at(0, increment, ...)   ← 异步！
                          │
                          └─ policies/init.lua:181  redis.increment()
                                ├─ L194  red:exists(key)         ← Redis EXISTS（同步）
                                ├─ L206  red:init_pipeline()
                                ├─ L208  red:incrby(key, 1)      ← Redis INCRBY
                                ├─ L210  red:expire(key, TTL)     ← Redis EXPIRE
                                └─ L216  red:commit_pipeline()
```

关键特征：
- **检查阶段**（`get_usage`）是同步的，直接读 Redis
- **递增阶段**（`increment`）是异步的，通过 `ngx.timer.at(0, ...)` 在响应之后执行
- 每个 Redis key：`ratelimit:{route_id}:{service_id}:{identifier}:{period_date}:{period}`

## 边界效应清单

### 效应 1：异步递增（TOCTOU）

**位置**：`handler.lua:201`

```lua
local ok, err = timer_at(0, increment, conf, limits, identifier, current_timestamp, 1)
```

计数器在请求响应之后才更新。在 `get_usage()` 读取和 `INCRBY` 写入之间，其他请求读到过时（偏低）的 counter。

**影响方向**：多放（under-limiting）

```
T=0ms   R1: get_usage()→0, remaining=100, 通过
T=1ms   R2: get_usage()→0, remaining=100, 通过  ← R1 的 timer 还没 fire
T=2ms   R3: get_usage()→0, remaining=100, 通过  ← 同上
...
T=10ms  R1 的 timer fire, counter→1
```

定量分析：假设 timer 延迟为 `d`（典型值 5-15ms），流量率为 λ QPS，一个 timer 周期内到达的请求数 = λ × d / 1000，这些请求全部看到同一个过时 counter。

示例：λ=90 QPS, d=10ms → 每个周期多放 ~0.9 个请求，影响较小。

---

### 效应 2：固定窗口对齐（最严重）

**位置**：`timestamp.lua:50-51`

```lua
timetable.sec = math_floor(timetable.sec)
stamps.second = timetable:timestamp() * 1000  -- 对齐到整秒
```

窗口按整秒对齐。秒 N 末尾 + 秒 N+1 开头可各通过 `config` 个请求。

**影响方向**：多放（under-limiting），严重程度**高**

```
秒 N   [──────config──────]│
秒 N+1                      │[──────config──────]
                            ↑
              滑动 1 秒窗口: 最多 2×config 个请求
```

任意滑动 1 秒窗口内的最大通过量 = **2 × config**。这是配置 `second=100` 但实测 90 QPS 就打满的核心原因。

---

### 效应 3：EXISTS + INCRBY 非原子

**位置**：`policies/init.lua:194-216`

```lua
local exists, err = red:exists(cache_key)    -- ① 同步查询
-- ... 其他请求可能在此期间操作 key ...
red:init_pipeline()
red:incrby(keys[i], value)                   -- ② pipeline 提交
red:expire(keys[i], expiration[i])
red:commit_pipeline()
```

EXISTS 检查和后续 pipeline 之间有时间间隙。并发请求可能同时判断 key 不存在，都设置 EXPIRE。

**影响方向**：TTL 轻微延长，counter 值不受影响（INCRBY 是原子操作）。**可忽略。**

---

### 效应 4：Pipeline 重复构建

**位置**：`policies/init.lua:206-213`

```lua
for period, period_date in pairs(periods) do
  if limits[period] then
    red:init_pipeline()          -- 每次循环重置，丢弃之前的命令
    for i = 1, idx do
      red:incrby(keys[i], value) -- 重新添加所有 keys
    end
  end
end
```

`init_pipeline()` 在循环内调用，每次丢弃上一轮的命令再重建。最终提交的 pipeline 是正确的（每个 key 恰好一次 INCRBY）。

**影响方向**：仅性能浪费（CPU），不影响计数准确性。

---

### 效应 5：Timer 创建失败

**位置**：`handler.lua:201-204`

```lua
local ok, err = timer_at(0, increment, ...)
if not ok then
  kong.log.err("failed to create timer: ", err)
  -- 没有重试！请求已通过，但 counter 未递增
end
```

高负载下 timer 队列满时，`timer_at` 失败。请求已通过但 counter 不更新。

**影响方向**：多放（under-limiting）

---

### 效应 6：Worker 关闭丢增量

**位置**：`handler.lua:111-114`

```lua
local function increment(premature, conf, ...)
  if premature then
    return  -- worker 正在关闭，跳过递增
  end
  policies[conf.policy].increment(conf, ...)
end
```

Worker 关闭时，pending timer 的 `premature=true`，递增被跳过。

**影响方向**：多放（under-limiting）

---

### 效应 7：Key 过期竞态

**位置**：`expiration.lua:2` + `policies/init.lua:194`

如果 late timer 在 key 过期（TTL=1s）后才 fire：

```
T=N+10ms:   第一个 timer fire, INCRBY 创建 key, TTL=1s
T=N+1010ms: key 过期
T=N+1050ms: 某个 late timer fire:
            EXISTS(key_N) → 0（已过期）
            INCRBY key_N 1 → key 被重建为 1
            EXPIRE key_N 1 → 新 TTL
```

**影响方向**：无功能影响。此时已在新的一秒（使用不同的 key），旧 key 的重建是孤儿 key。

---

## 影响方向总结

| 效应 | 方向 | 能导致 429 吗？ | 严重程度 |
|------|------|:---:|:---:|
| 1. 异步递增 TOCTOU | 多放 | 不能 | 中 |
| 2. 固定窗口对齐 | 多放 | **不能** | **高** |
| 3. EXISTS+INCRBY 非原子 | TTL 偏移 | 不能 | 低 |
| 4. Pipeline 重复构建 | 性能浪费 | 不能 | 低 |
| 5. Timer 创建失败 | 多放 | 不能 | 中 |
| 6. Worker 关闭丢增量 | 多放 | 不能 | 低 |
| 7. Key 过期竞态 | 无影响 | 不能 | 无 |

**所有 7 个边界效应，方向全部是"多放"。没有任何效应能让 counter 超过实际通过请求数。**

## 数学证明：90 QPS + second=100 不可能产生 429

### 不变量

对于任意时刻 t：

```
counter(t) = 已提交到 Redis 的 INCRBY 总次数
           ≤ 已通过请求总数（每个通过的请求最多触发一次 INCRBY）
           ≤ 该秒窗口内的峰值 QPS
```

### 证明

```
前提：
  - 配置 second = 100
  - 实际峰值 QPS = 90

对于任意时刻 t：

  counter(t) ≤ 峰值 QPS = 90

  remaining(t) = 100 - counter(t)
               ≥ 100 - 90
               = 10
               > 0

  ∴ stop 永远不被设置
  ∴ handler.lua:190 的 if stop then 分支永远不执行
  ∴ 429 永远不会触发
```

### 为什么 counter 不可能超过实际通过数

1. 每个通过的请求调用 `timer_at(0, increment, ...)` 恰好一次（`handler.lua:201`）
2. Timer callback `increment` 调用 `policies.redis.increment` 恰好一次（`handler.lua:116`）
3. `redis.increment` 对每个 period 的 key 执行恰好一次 `INCRBY`（`policies/init.lua:208`）
4. 即使 Pipeline 重复构建（效应 4），最终 `commit_pipeline` 只提交每个 key 一次 INCRBY

因此：`counter = 通过的请求数`（假设所有 timer 成功 fire）
     `counter ≤ 通过的请求数`（如果有 timer 失败）

## 配置建议

由于边界效应方向全部是多放，配置值用于控制"最多允许通过的请求量"。

### 从目标 QPS 推导配置值

**精确限流公式**（控制滑动窗口内不超过 T）：

```
config_second = ⌊ T / 2 ⌋
```

因为固定窗口边界效应允许任意滑动 1 秒窗口内通过 2×config。

**宽松限流公式**（控制固定窗口内不超过 T）：

```
config_second = T
```

### 配置查表

以 T=90 QPS 为例：

| 保障语义 | config_second | 实际最大通过量 |
|---------|--------------|-------------|
| 固定窗口内 ≤90 | 90 | 滑动窗口瞬时可达 **180** |
| 滑动窗口内 ≤90 | 45 | 严格 ≤90 |

### 改进建议

如果需要精确限流，当前实现有以下局限：

1. **异步递增**：改为同步递增可消除 TOCTOU，但会增加延迟
2. **固定窗口**：改用滑动窗口算法（如 Kong 的 `rate-limiting-advanced` 插件）
3. **非原子操作**：使用 Redis Lua 脚本将 check + increment 合并为原子操作

Redis Lua 脚本示例（原子 check + increment）：

```lua
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
if current > tonumber(ARGV[2]) then
  return 0  -- 拒绝
end
return 1   -- 放行
```

## 参考

- Kong Rate-Limiting 插件源码：`kong/plugins/rate-limiting/`
- Kong Rate-Limiting Advanced 插件（滑动窗口实现）
