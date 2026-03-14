---
title: Kong API 网关
description: Kong API 网关配置与优化
pubDate: 2026-01-02

---

Kong 是一个云原生、快速、可扩展的分布式微服务抽象层（也称为 API 网关、API 中间件或在某些情况下称为服务网格）。

## 核心特性

- **高性能**：基于 Nginx 和 OpenResty，提供卓越的性能
- **插件生态**：丰富的插件系统，支持认证、限流、监控等功能
- **云原生**：支持 Kubernetes、Docker 等容器化部署
- **多协议支持**：HTTP/HTTPS、gRPC、WebSocket 等

## 文档目录

### 插件深度分析

| 文档 | 描述 |
|------|------|
| [Rate-Limiting 插件深度分析](./79740501-rate-limiting-plugin-deep-dive.md) | 限流插件算法原理、源码实现与边界问题分析 |
| [插件开发架构指南](./79740500-kong-architecture-plugin-development-guide.md) | Kong 架构与插件开发指南 |

### 负载均衡算法

| 文档 | 描述 |
|------|------|
| [Consistent-Hashing 一致性哈希深度解析](./79740417-consistent-hashing-deep-dive.md) | 一致性哈希算法源码实现，Hash Key 映射到节点的完整机制 |
| [Least-Connections 负载均衡分析](./79740416-least-connections-analysis.md) | 最小连接数负载均衡算法分析与问题 |

## 官方资源

- [Kong 官方文档](https://docs.konghq.com/)
- [Kong GitHub](https://github.com/Kong/kong)
