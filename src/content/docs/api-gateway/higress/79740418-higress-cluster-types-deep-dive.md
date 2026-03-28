---
title: Higress 插件集群类型详解：FQDN、DNS、K8s、Nacos、Consul
date: 2026-03-28
description: 深入解析 Higress Wasm 插件中使用的各种集群类型，包括 FQDNCluster、DnsCluster、K8sCluster、NacosCluster、ConsulCluster 等，介绍其区别、用途和适用场景。
---

在 Higress Wasm 插件开发中，HTTP 和 Redis 调用都是通过**集群（Cluster）**来识别并连接目标服务的。Higress 支持多种服务发现机制，不同的集群类型对应不同的使用场景。

## 一、集群类型概述

Higress 插件 SDK 定义了 `Cluster` 接口，所有集群类型都实现这个接口：

```go
type Cluster interface {
    // 返回 Envoy 集群名称
    ClusterName() string
    // 返回 Hostname，用于设置 HTTP 请求的 Host 头
    HostName() string
}
```

### 集群类型对比表

| 集群类型 | 集群名称格式 | 服务发现方式 | 适用场景 |
|---------|-------------|------------|---------|
| `FQDNCluster` | `outbound\|<Port>\|\|<FQDN>` | 泛化调用 | 通用场景，支持所有服务发现类型后缀 |
| `DnsCluster` | `outbound\|<Port>\|\|<ServiceName>.dns` | DNS 解析 | 纯 DNS 服务发现 |
| `StaticIpCluster` | `outbound\|<port>\|\|<ServiceName>.static` | 静态 IP | 固定 IP 地址配置 |
| `K8sCluster` | `outbound\|<Port>\|<Version>\|<ServiceName>.<Namespace>.svc.cluster.local` | Kubernetes API | K8s 集群内部服务 |
| `NacosCluster` | `outbound\|<Port>\|<Version>\|<ServiceName>.<Group>.<NamespaceID>.nacos` | Nacos 注册中心 | 微服务注册与发现 |
| `ConsulCluster` | `outbound\|<Port>\|\|<ServiceName>.<Datacenter>.consul` | Consul 注册中心 | Consul 服务发现 |
| `RouteCluster` | 当前路由目标集群 | 路由上下文 | 调用当前正在路由的服务 |

## 二、集群类型详解

### 2.1 FQDNCluster

```go
type FQDNCluster struct {
    FQDN string   // 完全限定域名
    Host string   // 实际请求使用的域名（可选）
    Port int64    // 端口
}
```

**集群名称**：`outbound|<Port>||<FQDN>`

**特点**：
- FQDN 是最通用的集群类型，适用于所有服务发现类型
- 支持后缀识别服务类型：`.static`、`.dns`、K8s 服务名、Nacos 服务名等
- `Host` 字段用于设置 HTTP 请求的缺省 Host 头

**使用示例**：

```go
// 调用 Nacos 服务
config.client = wrapper.NewClusterClient(wrapper.FQDNCluster{
    FQDN: "user-service.DEFAULT-GROUP.public.nacos",
    Port: 8080,
})

// 调用 K8s 服务
config.client = wrapper.NewClusterClient(wrapper.FQDNCluster{
    FQDN: "user-service.default.svc.cluster.local",
    Port: 8080,
})

// 调用 DNS 服务
config.client = wrapper.NewClusterClient(wrapper.FQDNCluster{
    FQDN: "my-service.dns",
    Port: 8080,
})
```

**适用场景**：
- 通用场景，推荐优先使用
- 不确定服务发现类型时使用 FQDNCluster
- 插件需要支持多种服务发现机制

### 2.2 DnsCluster

```go
type DnsCluster struct {
    ServiceName string   // 服务名称
    Domain      string   // DNS 域名
    Port        int64    // 端口
}
```

**集群名称**：`outbound|<Port>||<ServiceName>.dns`

**特点**：
- 专门用于 DNS 服务发现
- 通过 DNS 解析获取服务 endpoints
- 支持泛域名匹配

**HostName 规则**：
- 如果设置了 `Host`，返回 `Host`
- 否则返回 `<Domain>`

**使用示例**：

```go
// DNS 服务调用
config.client = wrapper.NewClusterClient(wrapper.DnsCluster{
    ServiceName: "token-server",
    Domain:      "token-server.higress-course.svc.cluster.local",
    Port:        9090,
})
```

**适用场景**：
- 纯 DNS 服务发现环境
- 调用集群外部的 DNS 服务
- McpBridge 配置的 `type: dns` 服务

### 2.3 StaticIpCluster

```go
type StaticIpCluster struct {
    ServiceName string   // 服务名称
    Port        int64    // 端口
    Host        string   // 主机地址
}
```

**集群名称**：`outbound|<port>||<ServiceName>.static`

**特点**：
- 使用静态 IP 配置
- 不依赖服务发现，直接连接固定地址
- 适用于开发测试环境或固定 IP 服务

**HostName 规则**：
- 默认为 `<ServiceName>`

**使用示例**：

```yaml
# envoy.yaml 中配置静态集群
clusters:
  - name: outbound|6379||redis.static
    type: STATIC
    load_assignment:
      cluster_name: outbound|6379||redis.static
      endpoints:
        - lb_endpoints:
            - endpoint:
                address:
                  socket_address:
                    address: 172.20.0.100
                    port_value: 6379
```

```go
// 插件中使用
config.client = wrapper.NewClusterClient(wrapper.StaticIpCluster{
    ServiceName: "redis",
    Port:        6379,
    Host:        "172.20.0.100",
})
```

**适用场景**：
- 固定 IP 地址的后端服务
- 开发测试环境
- 无法使用服务发现的场景

### 2.4 K8sCluster

```go
type K8sCluster struct {
    ServiceName string   // K8s 服务名称
    Namespace   string   // K8s 命名空间
    Port        int64    // 端口
    Version     string   // 版本（可选）
    Host        string   // 主机（可选）
}
```

**集群名称**：`outbound|<Port>|<Version>|<ServiceName>.<Namespace>.svc.cluster.local`

**特点**：
- 专门用于 Kubernetes 内部服务发现
- 通过 K8s API 获取 Pod endpoints
- 支持多版本服务（通过 Version 字段）

**HostName 规则**：
- 如果设置了 `Host`，返回 `Host`
- 否则返回 `<ServiceName>.<Namespace>.svc.cluster.local`

**使用示例**：

```go
// 调用 K8s 集群内部服务
config.client = wrapper.NewClusterClient(wrapper.K8sCluster{
    ServiceName: "user-service",
    Namespace:   "default",
    Port:        8080,
    Version:     "v1",
})
```

**适用场景**：
- 调用 Kubernetes 集群内部的其他服务
- 需要支持多版本服务（灰度发布）
- 生产环境的标准用法

### 2.5 NacosCluster

```go
type NacosCluster struct {
    ServiceName  string   // Nacos 服务名称
    Group        string   // Nacos 分组（默认 DEFAULT-GROUP）
    NamespaceID  string   // Nacos 命名空间 ID
    Port         int64    // 端口
    IsExtRegistry bool    // 是否为 EDAS/SAE 注册中心
    Version      string   // 版本（可选）
    Host         string   // 主机（可选）
}
```

**集群名称**：`outbound|<Port>|<Version>|<ServiceName>.<Group>.<NamespaceID>.nacos`

**特点**：
- 专用于 Alibaba Nacos 注册中心
- 支持分组（Group）和命名空间（Namespace）隔离
- 支持 EDAS/SAE 兼容模式

**HostName 规则**：
- 如果设置了 `Host`，返回 `Host`
- 否则返回 `<ServiceName>`

**使用示例**：

```go
// 调用 Nacos 注册的服务
config.client = wrapper.NewClusterClient(wrapper.NacosCluster{
    ServiceName: "user-service",
    Group:       "DEFAULT-GROUP",
    NamespaceID:  "public",
    Port:        8080,
    Version:     "v1",
})
```

**McpBridge 配置示例**：

```yaml
apiVersion: networking.higress.io/v1
kind: McpBridge
metadata:
  name: default
  namespace: higress-system
spec:
  registries:
    - name: user-service
      domain: user-service.default.svc.cluster.local
      port: 8080
      type: nacos
      nacosClusterId: default
```

**适用场景**：
- 微服务架构使用 Nacos 作为注册中心
- 需要分组隔离的微服务调用
- 阿里云 EDAS/SAE 环境

### 2.6 ConsulCluster

```go
type ConsulCluster struct {
    ServiceName string   // Consul 服务名称
    Datacenter  string   // Consul 数据中心
    Port        int64    // 端口
    Host        string   // 主机（可选）
}
```

**集群名称**：`outbound|<Port>||<ServiceName>.<Datacenter>.consul`

**特点**：
- 专用于 HashiCorp Consul 注册中心
- 支持数据中心隔离
- 支持 KV 存储和服务目录

**HostName 规则**：
- 如果设置了 `Host`，返回 `Host`
- 否则返回 `<ServiceName>`

**使用示例**：

```go
// 调用 Consul 注册的服务
config.client = wrapper.NewClusterClient(wrapper.ConsulCluster{
    ServiceName: "user-service",
    Datacenter:  "dc1",
    Port:        8080,
})
```

**适用场景**：
- 使用 Consul 作为服务注册中心
- 多数据中心架构
- 需要服务健康检查的场景

### 2.7 RouteCluster

```go
type RouteCluster struct {
    Host string   // 主机
}
```

**集群名称**：直接获取当前路由目标集群

**特点**：
- 特殊集群类型，不创建新集群
- 直接使用当前请求正在路由的目标集群
- 用于需要调用当前后端服务的场景

**使用示例**：

```go
// 调用当前路由目标服务
config.client = wrapper.NewClusterClient(wrapper.RouteCluster{
    Host: "current",
})
```

**适用场景**：
- 插件需要获取原始路由目标信息
- 流量镜像/复制场景
- 需要在插件中调用当前后端服务

## 三、选择指南

### 3.1 集群类型选择决策树

```
                    ┌─────────────────────┐
                    │ 需要调用外部服务？    │
                    └──────────┬──────────┘
                             │
              ┌──────────────┴──────────────┐
              │ 是                          │ 否
              ▼                             ▼
    ┌─────────────────────┐       ┌─────────────────────┐
    │ 固定 IP 地址？       │       │ 使用 K8s 内部服务？   │
    └──────────┬──────────┘       └──────────┬──────────┘
               │                            │
      ┌────────┴────────┐          ┌─────────┴─────────┐
      │ 是              │ 否       │ 是                │ 否
      ▼                 ▼         ▼                   ▼
┌───────────┐   ┌───────────┐ ┌───────────┐   ┌─────────────────┐
│StaticIp   │   │ FQDN     │ │ K8sCluster│   │ 使用什么注册中心？│
│Cluster    │   │ Cluster   │ │           │   └────────┬────────┘
└───────────┘   └───────────┘ └───────────┘            │
                                             ┌─────────┼─────────┐
                                             │         │         │
                                             ▼         ▼         ▼
                                      ┌──────────┐┌─────────┐┌──────────┐
                                      │  Nacos   ││ Consul  ││   DNS   │
                                      └──────────┘└─────────┘└─────────┘
```

### 3.2 场景推荐

| 场景 | 推荐集群类型 | 说明 |
|------|-------------|------|
| K8s 集群内部调用 | `K8sCluster` | 利用 K8s 原生服务发现 |
| Nacos 注册中心 | `NacosCluster` | 支持分组和命名空间隔离 |
| Consul 注册中心 | `ConsulCluster` | 支持数据中心隔离 |
| 纯 DNS 服务 | `DnsCluster` | DNS 解析服务 |
| 固定 IP 服务 | `StaticIpCluster` | 静态地址配置 |
| 不确定服务类型 | `FQDNCluster` | 通用类型，支持所有后缀 |
| 调用当前路由目标 | `RouteCluster` | 特殊场景 |

## 四、实际开发示例

### 4.1 HTTP 调用示例

```go
package main

import (
    "github.com/higress-group/wasm-go/pkg/wrapper"
    "github.com/higress-group/proxy-wasm-go-sdk/proxywasm"
)

func main() {
    wrapper.SetCtx(
        "http-caller",
        wrapper.ParseConfigBy(parseConfig),
        wrapper.ProcessRequestHeadersBy(onHttpRequestHeaders),
    )
}

type MyConfig struct {
    client wrapper.HttpClient
}

func parseConfig(json gjson.Result, config *MyConfig, log wrapper.Log) error {
    serviceName := json.Get("serviceName").String()
    servicePort := json.Get("servicePort").Int()

    // 使用 FQDNCluster 通用类型
    config.client = wrapper.NewClusterClient(wrapper.FQDNCluster{
        FQDN: serviceName,
        Port: servicePort,
    })
    return nil
}

func onHttpRequestHeaders(ctx wrapper.HttpContext, config MyConfig, log wrapper.Log) types.Action {
    err := config.client.Get("/api/health", nil,
        func(statusCode int, headers http.Header, body []byte) {
            if statusCode == 200 {
                proxywasm.AddHttpResponseHeader("X-Health", "ok")
            }
            proxywasm.ResumeHttpRequest()
        })

    if err != nil {
        return types.ActionContinue
    }
    return types.HeaderStopAllIterationAndWatermark
}
```

### 4.2 Redis 调用示例

```go
func parseConfig(json gjson.Result, config *LimitConfig, log wrapper.Log) error {
    serviceName := json.Get("redis.service_name").String()
    servicePort := int(json.Get("redis.service_port").Int())

    // 使用 FQDNCluster 调用 Redis
    config.RedisClient = wrapper.NewRedisClusterClient(wrapper.FQDNCluster{
        FQDN: serviceName,
        Port: int64(servicePort),
    })

    return config.RedisClient.Init(username, password, int64(timeout))
}
```

### 4.3 McpBridge 配置示例

```yaml
apiVersion: networking.higress.io/v1
kind: McpBridge
metadata:
  name: default
  namespace: higress-system
spec:
  registries:
    # DNS 类型服务
    - name: token-server
      domain: token-server.higress-course.svc.cluster.local
      port: 9090
      type: dns

    # Nacos 类型服务
    - name: user-service
      domain: user-service.default.svc.cluster.local
      port: 8080
      type: nacos
      nacosClusterId: default

    # Kubernetes 类型服务
    - name: backend-service
      domain: backend-service.default.svc.cluster.local
      port: 8080
      type: kubernetes
```

## 五、常见问题

### 5.1 Envoy Cluster 不存在

**问题**：插件调用时提示 Cluster 不存在

**原因**：默认情况下，Higress 只下发与路由关联的服务到 Envoy Cluster

**解决方案**：

1. 修改 Helm 参数：
   ```bash
   helm install higress -n higress-system --set global.onlyPushRouteCluster=false
   ```

2. 创建新路由关联到目标服务

3. 通过 McpBridge 配置添加服务

### 5.2 集群名称格式

Envoy 集群名称遵循特定格式：
- `outbound|<Port>||<ServiceName>.<Type>`：无版本
- `outbound|<Port>|<Version>|<ServiceName>.<Type>`：有版本

理解集群名称格式有助于调试和配置。

## 六、总结

| 集群类型 | 使用建议 |
|---------|---------|
| `FQDNCluster` | **首选**，通用场景优先使用 |
| `K8sCluster` | K8s 内部服务调用 |
| `NacosCluster` | Nacos 注册中心 |
| `ConsulCluster` | Consul 注册中心 |
| `DnsCluster` | 纯 DNS 服务发现 |
| `StaticIpCluster` | 固定 IP 服务 |
| `RouteCluster` | 调用当前路由目标 |

在实际开发中，建议：
1. 优先使用 `FQDNCluster`，它支持所有服务发现类型
2. 明确知道服务类型时，使用对应的专用集群类型
3. 通过 McpBridge 正确配置服务发现

> 更多 Higress 插件开发信息，请参考 [Higress 官方文档](https://higress.cn/docs/latest/user/wasm-go/)。
