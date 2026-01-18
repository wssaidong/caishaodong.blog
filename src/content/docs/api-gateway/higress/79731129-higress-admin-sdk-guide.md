---
title: Higress Admin SDK 使用指南
description: Higress Admin SDK 使用指南相关技术文档
pubDate: 2026-01-02

---


## 1. 概述

### 1.1 背景

Higress 是一个遵循开源 Ingress/Gateway API 标准，提供流量调度、服务治理、安全防护三合一的高集成、易使用、易扩展、热更新的下一代云原生网关。

配置管理在网关运维工作中扮演着重要的角色。如何让配置管理自动化，尤其是与其他运维系统进行对接，是一个迫切需求。Higress Admin SDK 专门用于解决此类问题。

### 1.2 SDK 简介

Higress Admin SDK 脱胎于 Higress Console，原作为 Higress Console 的一部分为前端界面提供功能支持。后来考虑到对接外部系统等需求，将配置管理部分剥离出来，形成独立的逻辑组件，便于各系统进行对接。

**支持功能：**
- 服务来源管理
- 服务管理
- 路由管理
- 域名管理
- 证书管理
- 插件管理

**技术要求：**
- 语言：Java
- JDK 版本：不低于 17

## 2. 快速开始

### 2.1 环境准备

以本地基于 Kind 搭建的 K8s 集群作为实验环境。

1. 参考 [Higress 官方文档](https://higress.cn/docs/latest/user/quickstart/#%E5%9C%BA%E6%99%AF%E4%BA%8C%E5%9C%A8%E6%9C%AC%E5%9C%B0-k8s%E7%8E%AF%E5%A2%83%E4%B8%AD%E4%BD%BF%E7%94%A8) 在本地完成 K8s 集群的搭建和 Higress 的安装

2. 创建测试用的 K8s 服务，将以下 YAML 保存为 `test.yaml`：

```yaml
kind: Pod
apiVersion: v1
metadata:
  name: higress-demo-app
  namespace: default
  labels:
    app: higress-demo
spec:
  containers:
    - name: higress-demo-app
      image: mendhak/http-https-echo:29
---
kind: Service
apiVersion: v1
metadata:
  name: higress-demo-service
  namespace: default
spec:
  selector:
    app: higress-demo
  ports:
    - port: 8080
```

3. 执行命令创建资源：

```bash
kubectl apply -f test.yaml
```

### 2.2 配置依赖

根据项目所使用的构建工具添加 Higress Admin SDK 依赖：

**Maven:**

```xml
<dependency>
    <groupId>io.higress.api</groupId>
    <artifactId>higress-admin-sdk</artifactId>
    <version>0.0.2</version>
</dependency>
```

**Gradle:**

```groovy
implementation 'io.higress.api:higress-admin-sdk:0.0.2'
```

## 3. SDK 使用

### 3.1 创建 SDK 实例

```java
String kubeConfigFile = Paths.get(System.getProperty("user.home"), "/.kube/config").toString();
HigressServiceConfig config = HigressServiceConfig.builder()
    .withKubeConfigPath(kubeConfigFile)
    .build();
HigressServiceProvider provider = HigressServiceProvider.create(config);
```

> **说明：** 这里使用的是 K8s 集群外的配置方式，所以需要设置 kubeConfig 文件的路径，以便 SDK 操作 K8s 内的各类资源。

### 3.2 域名管理

创建域名配置，使用 `DomainService` 创建域名：

```java
Domain domain = Domain.builder()
    .name("www.test.com")
    .enableHttps(Domain.EnableHttps.OFF)
    .build();
provider.domainService().add(domain);
```

### 3.3 路由管理

创建路由配置，使用 `RouteService` 创建路由：

```java
Route route = Route.builder()
    .name("higress-demo")
    .domains(Collections.singletonList("www.test.com"))
    .path(RoutePredicate.builder()
        .matchType(RoutePredicateTypeEnum.PRE.name())
        .matchValue("/")
        .build())
    .services(Collections.singletonList(
        UpstreamService.builder()
            .name("higress-demo-service.default.svc.cluster.local:8080")
            .build()
    ))
    .build();
provider.routeService().add(route);
```

**路由配置说明：**
- 路由名称：`higress-demo`
- 绑定域名：`www.test.com`
- 匹配规则：所有以 `/` 开头的请求
- 转发目标：`higress-demo-service.default.svc.cluster.local:8080`

## 4. 测试验证

### 4.1 执行代码

运行编写的代码，确认一切正常。

### 4.2 验证路由

在 Shell 中执行以下命令，检查请求路由情况：

```bash
curl -svk http://localhost/ -H "Host: www.test.com"
```

### 4.3 预期结果

能够以 JSON 格式返回请求的详细信息，说明路由配置已经可以正常工作：

```json
{
  "path": "/",
  "headers": {
    "host": "www.test.com",
    "user-agent": "curl/8.4.0",
    "accept": "*/*",
    "x-forwarded-for": "10.42.0.230",
    "x-forwarded-proto": "http",
    "x-envoy-internal": "true",
    "x-request-id": "4a3db96b-c46c-4c8a-a60f-a513f258736d",
    "x-envoy-decorator-operation": "higress-demo-service.default.svc.cluster.local:8080/*",
    "x-envoy-attempt-count": "1",
    "x-b3-traceid": "a426d189c027371957f008c2cb2e9e8f",
    "x-b3-spanid": "57f008c2cb2e9e8f",
    "x-b3-sampled": "0",
    "req-start-time": "1707363093608",
    "original-host": "www.test.com"
  },
  "method": "GET",
  "body": "",
  "fresh": false,
  "hostname": "www.test.com",
  "ip": "10.42.0.230",
  "ips": [
    "10.42.0.230"
  ],
  "protocol": "http",
  "query": {},
  "subdomains": [
    "www"
  ],
  "xhr": false,
  "os": {
    "hostname": "higress-demo-app"
  },
  "connection": {}
}
```

## 5. 核心 API

### 5.1 服务提供者

`HigressServiceProvider` 是 SDK 的入口点，提供各类服务的访问：

| 方法 | 说明 |
|------|------|
| `domainService()` | 域名管理服务 |
| `routeService()` | 路由管理服务 |
| `serviceService()` | 服务管理服务 |
| `certificateService()` | 证书管理服务 |
| `pluginService()` | 插件管理服务 |

### 5.2 配置选项

`HigressServiceConfig` 支持以下配置选项：

| 选项 | 说明 |
|------|------|
| `withKubeConfigPath()` | KubeConfig 文件路径 |
| `withNamespace()` | 目标命名空间 |
| `withKubeConfig()` | 直接传入 KubeConfig 对象 |

## 6. 多实例管理

### 6.1 应用场景

在实际生产环境中，通常需要管理多个 Higress 实例，常见的场景包括：

| 场景 | 说明 |
|------|------|
| 多环境隔离 | 开发、测试、生产环境使用不同的 Higress 实例 |
| 多集群部署 | 跨多个 Kubernetes 集群部署 Higress |
| 多租户隔离 | 不同业务线使用独立的 Higress 实例 |
| 多地域部署 | 不同地域部署独立的网关实例 |

### 6.2 配置多实例

SDK 支持为每个 Higress 实例创建独立的 `HigressServiceProvider`，通过不同的 KubeConfig 或命名空间来区分不同的实例。

#### 方式一：不同 KubeConfig 文件

适用于跨多个 Kubernetes 集群的场景：

```java
// 实例 1 - 生产环境集群
String prodKubeConfig = "/path/to/prod-kubeconfig";
HigressServiceConfig prodConfig = HigressServiceConfig.builder()
    .withKubeConfigPath(prodKubeConfig)
    .withNamespace("higress-system")
    .build();
HigressServiceProvider prodProvider = HigressServiceProvider.create(prodConfig);

// 实例 2 - 测试环境集群
String testKubeConfig = "/path/to/test-kubeconfig";
HigressServiceConfig testConfig = HigressServiceConfig.builder()
    .withKubeConfigPath(testKubeConfig)
    .withNamespace("higress-system")
    .build();
HigressServiceProvider testProvider = HigressServiceProvider.create(testConfig);
```

#### 方式二：同一集群不同命名空间

适用于同一 K8s 集群中多租户隔离的场景：

```java
String kubeConfigFile = Paths.get(System.getProperty("user.home"), "/.kube/config").toString();

// 租户 A 的 Higress 实例
HigressServiceConfig tenantAConfig = HigressServiceConfig.builder()
    .withKubeConfigPath(kubeConfigFile)
    .withNamespace("tenant-a-higress")
    .build();
HigressServiceProvider tenantAProvider = HigressServiceProvider.create(tenantAConfig);

// 租户 B 的 Higress 实例
HigressServiceConfig tenantBConfig = HigressServiceConfig.builder()
    .withKubeConfigPath(kubeConfigFile)
    .withNamespace("tenant-b-higress")
    .build();
HigressServiceProvider tenantBProvider = HigressServiceProvider.create(tenantBConfig);
```

#### 方式三：使用 Context

适用于同一 kubeconfig 文件中包含多个集群上下文的场景：

```java
// 从 kubeconfig 中加载特定的 context
KubeConfig kubeConfigProd = KubeConfig.loadKubeConfig(
    new File(Paths.get(System.getProperty("user.home"), "/.kube/config").toString()),
    "prod-cluster"
);

HigressServiceConfig configProd = HigressServiceConfig.builder()
    .withKubeConfig(kubeConfigProd)
    .withNamespace("higress-system")
    .build();
HigressServiceProvider prodProvider = HigressServiceProvider.create(configProd);
```

### 6.3 统一管理多实例

创建管理类来统一管理多个 Higress 实例：

```java
public class HigressInstanceManager {
    private final Map<String, HigressServiceProvider> providers = new ConcurrentHashMap<>();

    public void registerInstance(String instanceName, String kubeConfigPath, String namespace) {
        HigressServiceConfig config = HigressServiceConfig.builder()
            .withKubeConfigPath(kubeConfigPath)
            .withNamespace(namespace)
            .build();
        HigressServiceProvider provider = HigressServiceProvider.create(config);
        providers.put(instanceName, provider);
    }

    public HigressServiceProvider getProvider(String instanceName) {
        return providers.get(instanceName);
    }

    public List<String> listInstances() {
        return new ArrayList<>(providers.keySet());
    }
}
```

使用示例：

```java
HigressInstanceManager manager = new HigressInstanceManager();

// 注册多个实例
manager.registerInstance("prod", "/path/to/prod-kubeconfig", "higress-system");
manager.registerInstance("test", "/path/to/test-kubeconfig", "higress-system");
manager.registerInstance("dev", "/path/to/dev-kubeconfig", "higress-system");

// 向指定实例添加配置
HigressServiceProvider prodProvider = manager.getProvider("prod");
Domain domain = Domain.builder()
    .name("api.example.com")
    .enableHttps(Domain.EnableHttps.ON)
    .build();
prodProvider.domainService().add(domain);
```

### 6.4 跨实例配置同步

实现跨实例配置同步，将一个实例的配置同步到其他实例：

```java
public void syncConfiguration(String sourceInstance, String targetInstance) {
    HigressServiceProvider sourceProvider = manager.getProvider(sourceInstance);
    HigressServiceProvider targetProvider = manager.getProvider(targetInstance);

    // 同步域名配置
    List<Domain> domains = sourceProvider.domainService().list();
    for (Domain domain : domains) {
        try {
            targetProvider.domainService().add(domain);
        } catch (Exception e) {
            // 处理已存在的域名
            targetProvider.domainService().update(domain);
        }
    }

    // 同步路由配置
    List<Route> routes = sourceProvider.routeService().list();
    for (Route route : routes) {
        try {
            targetProvider.routeService().add(route);
        } catch (Exception e) {
            targetProvider.routeService().update(route);
        }
    }
}
```

### 6.5 多实例操作最佳实践

1. **配置隔离**
   - 每个实例使用独立的配置文件或命名空间
   - 避免不同实例间的配置冲突

2. **错误处理**
   - 单个实例的操作失败不应影响其他实例
   - 实现重试机制和熔断机制

3. **监控告警**
   - 监控每个实例的健康状态
   - 配置操作失败时及时告警

4. **配置审计**
   - 记录跨实例的所有配置变更
   - 支持配置变更的追溯和回滚

```java
// 错误处理示例
public void safeAddRoute(String instanceName, Route route) {
    try {
        HigressServiceProvider provider = manager.getProvider(instanceName);
        provider.routeService().add(route);
        log.info("路由添加成功: 实例={}, 路由={}", instanceName, route.getName());
    } catch (Exception e) {
        log.error("路由添加失败: 实例={}, 路由={}", instanceName, route.getName(), e);
        // 发送告警通知
        alertService.sendAlert("路由配置失败", instanceName, route.getName());
    }
}
```

## 7. 参考资源

- [Higress 官方文档](https://higress.cn/docs/latest/)
- [Higress Console GitHub](https://github.com/higress-group/higress-console)
- [Higress Admin SDK 示例代码](https://github.com/higress-group/higress-group.github.io/blob/main/src/content/blog/admin-sdk-intro.md)
