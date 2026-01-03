---
title: Dotenvx 文档
description: Dotenvx 环境变量管理工具完整文档和最佳实践
pubDate: 2026-01-02

---

Dotenvx 是由 dotenv 原作者开发的下一代环境变量管理工具，提供了加密、多环境支持等高级功能。

## 核心特性

- **🔐 加密支持**：使用 AES-256 加密和椭圆曲线密码学
- **🌍 跨平台运行**：支持 Node.js、Python、Go、Rust、Java 等多种语言
- **🔄 多环境管理**：支持开发、测试、生产等多环境配置
- **⚡ 高级功能**：变量扩展、命令替换、预提交钩子等

## 快速开始

```bash
# 安装 dotenvx
npm install @dotenvx/dotenvx --save

# 创建环境文件
echo "HELLO=World" > .env

# 运行应用
dotenvx run -- node app.js
```

## 相关资源

- [官方文档](https://dotenvx.com/docs)
- [GitHub 仓库](https://github.com/dotenvx/dotenvx)
- [NPM 包](https://www.npmjs.com/package/@dotenvx/dotenvx)
