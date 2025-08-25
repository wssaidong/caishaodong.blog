---
title: Kong Least-Connections
date: 2025-08-15 13:49:51
tags:
  - kong
---

# Kong Least-Connections 负载均衡算法分析报告

## 1. 概述

本报告基于 `kong/runloop/balancer/least_connections.lua` 源码，深入分析 least-connections 负载均衡算法的工作机制。

## 2. 核心数据结构分析

### 2.1 二叉堆的使用

```lua
-- 第188行：使用最小唯一堆
binaryHeap = binaryHeap.minUnique()
```

**关键特性**：
- **最小堆**：优先级值越小的元素在堆顶
- **唯一堆**：每个 payload（address对象）在堆中唯一存在
- **peek() 特性**：总是返回位置1的元素（堆顶）

### 2.2 优先级计算公式

```lua
-- 第28行和第44行：优先级计算
priority = (addr.connectionCount + 1) / addr.weight
```

**公式解析**：
- 连接数越少，优先级越高（值越小）
- 权重越大，优先级越高（值越小）
- `+1` 确保零连接时权重仍然有效

## 3. 流量分配机制分析

### 3.1 地址选择过程

```lua
-- 第96行：核心选择逻辑
address = self.binaryHeap:peek()
```

**选择规则**：
1. `peek()` 总是返回堆顶元素（位置1）
2. 堆顶元素是当前优先级最高的地址
3. 选中后连接数+1，优先级重新计算

### 3.2 堆重建过程

```lua
-- 第158-166行：afterHostUpdate方法
function lc:afterHostUpdate()
  clearHeap(self.binaryHeap)

  for _, target in ipairs(self.balancer.targets) do
    for _, address in ipairs(target.addresses) do
      insertAddr(self.binaryHeap, address)
    end
  end
end
```

**重要发现**：地址按照 `targets` 数组的顺序插入堆中。

## 4. 低并发场景问题分析

### 4.1 场景设定
- **8个target**：T1, T2, T3, T4, T5, T6, T7, T8
- **并发1-2**：同时只有1-2个活跃连接
- **相同权重**：所有target权重相同

### 4.2 流量分配模拟

#### 初始状态（所有target连接数为0）
```
Target  | 连接数 | 权重 | 优先级    | 堆位置
--------|--------|------|-----------|--------
T1      | 0      | 100  | 1/100=0.01| 1 (堆顶)
T2      | 0      | 100  | 1/100=0.01| 2
T3      | 0      | 100  | 1/100=0.01| 3
...     | ...    | ...  | ...       | ...
T8      | 0      | 100  | 1/100=0.01| 8
```

#### 并发为1的情况
```
请求序号 | 选择Target | T1连接数 | T2连接数 | ... | T8连接数 | 堆顶
---------|------------|----------|----------|-----|----------|------
1        | T1         | 1        | 0        | ... | 0        | T2
2        | T2         | 0(释放)  | 1        | ... | 0        | T1
3        | T1         | 1        | 0(释放)  | ... | 0        | T2
4        | T2         | 0(释放)  | 1        | ... | 0        | T1
```

**结果**：只有T1和T2获得流量，T3-T8没有流量！

#### 并发为2的情况
```
请求序号 | 选择Target | T1连接数 | T2连接数 | T3连接数 | 其他 | 堆顶
---------|------------|----------|----------|----------|------|------
1        | T1         | 1        | 0        | 0        | 0    | T2
2        | T2         | 1        | 1        | 0        | 0    | T3
3        | T3         | 0(释放)  | 1        | 1        | 0    | T1
4        | T1         | 1        | 0(释放)  | 1        | 0    | T2
```

**结果**：只有T1、T2、T3获得流量，T4-T8仍然没有流量！

## 5. 根本原因分析

### 5.1 二叉堆的位置稳定性

```lua
-- binaryheap 的比较函数（默认）
lt = function(a,b) return (a < b) end
```

**关键特性**：
- 当两个元素优先级相同时，`a < b` 返回 `false`
- 相同优先级的元素不会交换位置
- 堆的相对位置保持稳定

### 5.2 插入顺序的影响

```lua
-- 按targets数组顺序插入
for _, target in ipairs(self.balancer.targets) do
  for _, address in ipairs(target.addresses) do
    insertAddr(self.binaryHeap, address)  -- 先插入的更可能在前面
  end
end
```

**结果**：配置中靠前的target更容易占据堆的前部位置。

### 5.3 peek()的固定性

```lua
-- peek()总是返回位置1的元素
address = self.binaryHeap:peek()
```

**问题**：在低并发场景下，只有堆顶附近的少数元素会被选中。

## 6. 源码验证

### 6.1 连接计数更新逻辑

```lua
-- 第32-45行：updateConnectionCount函数
local function updateConnectionCount(bh, addr, delta)
  addr.connectionCount = addr.connectionCount + delta

  if not addr.available or not bh then
    return
  end

  bh:update(addr, (addr.connectionCount + 1) / addr.weight)
end
```

### 6.2 连接分配和释放

```lua
-- 第130行：分配连接
updateConnectionCount(self.binaryHeap, address, 1)

-- 第49行：释放连接
updateConnectionCount(handle.binaryHeap, handle.address, -1)
```

## 7. 问题总结

### 7.1 核心问题
在低并发场景下，least-connections算法会导致**流量集中在少数几个target上**，后加入的target可能长期没有流量。

### 7.2 影响因素
1. **二叉堆的位置稳定性**：相同优先级元素位置不变
2. **peek()的固定性**：总是选择位置1的元素
3. **插入顺序**：先插入的target更容易获得流量
4. **低并发特性**：活跃连接少，优先级差异小

### 7.3 数学证明
在并发为N的场景下，理论上最多只有前N+1个target会获得流量：
- N个target各有1个连接（优先级：2/weight）
- 1个target有0个连接（优先级：1/weight，位于堆顶）

## 8. 多网关节点场景问题分析

### 8.1 问题场景描述

在多网关节点部署的环境中，least-connections算法面临更严重的流量分配不均问题：

**场景设定**：
- **多个Kong网关节点**：Gateway1, Gateway2, Gateway3...
- **多个后端Target**：Target1, Target2, Target3...
- **轮询请求分发**：客户端或负载均衡器将请求轮询分发到各个网关节点
- **独立堆管理**：每个网关节点维护自己的二叉堆，不共享连接状态

### 8.2 核心问题：堆状态不同步

#### 8.2.1 问题机制

多网关节点场景下的问题可以通过以下架构图和时序图来理解：

**架构图**：展示了多个Kong网关节点各自维护独立的二叉堆，导致所有节点都选择相同的Target，造成过载。

**时序图**：详细展示了请求分配过程中，由于堆状态不同步导致的流量集中问题。

#### 8.2.2 具体示例

**初始状态**（所有网关节点）：
```
Target  | 连接数 | 权重 | 优先级    | 堆位置
--------|--------|------|-----------|--------
T1      | 0      | 100  | 1/100=0.01| 1 (堆顶)
T2      | 0      | 100  | 1/100=0.01| 2
T3      | 0      | 100  | 1/100=0.01| 3
```

**时间线分析**：

| 时间 | 事件 | Gateway1状态 | Gateway2状态 | Target1实际负载 |
|------|------|-------------|-------------|----------------|
| T1   | 请求1→GW1 | T1:1连接,堆顶:T2 | T1:0连接,堆顶:T1 | 1个连接 |
| T2   | 请求2→GW2 | T1:1连接,堆顶:T2 | T1:1连接,堆顶:T2 | **2个连接**（过载！） |
| T3   | 请求3→GW1 | T1:0连接,堆顶:T1 | T1:1连接,堆顶:T2 | 1个连接 |
| T4   | 请求4→GW2 | T1:1连接,堆顶:T2 | T1:0连接,堆顶:T1 | **2个连接**（再次过载！） |

### 8.3 问题严重性分析

#### 8.3.1 流量集中效应放大

在单网关节点场景下，流量集中在少数target；在多网关节点场景下，这种集中效应被**显著放大**：

```
单网关场景：Target1获得50%流量
多网关场景：Target1可能获得80%+流量
```
