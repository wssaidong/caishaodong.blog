---
title: Dotenvx 使用指南
description: Dotenvx 完整使用指南，从基础安装到高级功能的详细介绍
pubDate: 2026-01-02

---

## 概述

Dotenvx 是由 dotenv 原作者开发的下一代环境变量管理工具，提供了加密、多环境支持等高级功能。它是传统 dotenv 的安全升级版本，特别适合生产环境使用。

## 架构图

```mermaid
graph TB
    subgraph "开发环境"
        A[开发者] --> B[.env.local]
        A --> C[.env.development]
        B --> D[dotenvx run]
        C --> D
    end

    subgraph "Dotenvx 核心"
        D --> I[环境变量解析]
        I --> J[变量扩展]
        J --> K[命令替换]
        K --> L[加密/解密]
        L --> M[应用程序]
    end

    style A fill:#e1f5fe
    style M fill:#c8e6c9
    style L fill:#fff3e0
```

## 核心特性

### 🔐 加密支持
- 使用 AES-256 加密和椭圆曲线密码学 (Secp256k1)
- 支持将加密的 .env 文件安全提交到代码仓库
- 公钥加密，私钥解密的分离式安全模型

### 🌍 跨平台运行
- 支持 Node.js、Deno、Bun、Python、PHP、Ruby、Go、Rust、Java、.NET 等
- 统一的命令行接口，无需修改现有代码

### 🔄 多环境管理
- 支持 .env.development、.env.production、.env.local 等多环境文件
- 内置框架约定支持（如 Next.js）
- 灵活的环境文件组合加载

## 安装方式

### NPM 安装
```bash
npm install @dotenvx/dotenvx --save
```

### 全局安装
```bash
npm install @dotenvx/dotenvx -g
```

## 基础使用

### 简单运行
```bash
# 创建 .env 文件
echo "HELLO=World" > .env

# 使用 dotenvx 运行
dotenvx run -- node index.js
```

### 多环境支持
```bash
# 创建生产环境配置
echo "HELLO=production" > .env.production

# 指定环境文件运行
dotenvx run -f .env.production -- node index.js
```

## 加密功能

### 初始化加密
```bash
# 设置加密的环境变量
dotenvx set HELLO "production (encrypted)" -f .env.production
```

### 加密后的文件结构

**.env.production**
```env
#/-------------------[DOTENV_PUBLIC_KEY]--------------------/
#/            public-key encryption for .env files          /
#/       [how it works](https://dotenvx.com/encryption)     /
#/----------------------------------------------------------/
DOTENV_PUBLIC_KEY_PRODUCTION="038759c073282f2efa6c5ffea8f66ad9cf0de7a855df8db242771f44d7472b63cb"

# .env.production
HELLO="encrypted:BGMyAFNH6UjetjWsYHUkbndQosw/barJwdynj9wXQmlucqsM2TxCAxCwXNKQfbA8axd2TCcUJaWVltrhcUZdtDo87caC7aN2G9D7m3/vQVpcCffdYeaKtlrGyGB9IHJzKOrXH3jEheKQBPLv1L6foObYREAeRzw="
```

**.env.keys** (不要提交到代码仓库)
```env
#/------------------!DOTENV_PRIVATE_KEYS!-------------------/
#/ private decryption keys. DO NOT commit to source control /
#/     [how it works](https://dotenvx.com/encryption)       /
#/----------------------------------------------------------/

# .env.production
DOTENV_PRIVATE_KEY_PRODUCTION="bd7c50b352ce23973ec9db355d70212305a0baaade92f0165f02915b213bfbe2"
```

## 代码集成

### 替换传统 dotenv
```javascript
// 之前
require('dotenv').config()

// 之后
require('@dotenvx/dotenvx').config()
```

### ES6 模块
```javascript
import { config } from '@dotenvx/dotenvx'
config()
```

## 高级功能

### 变量扩展
```env
# .env
BASE_URL=https://api.example.com
API_ENDPOINT=${BASE_URL}/v1/users
DATABASE_URL=postgres://user:pass@localhost:5432/${DB_NAME}
```

### 命令替换
```env
# .env
CURRENT_BRANCH=$(git branch --show-current)
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
COMMIT_SHA=$(git rev-parse HEAD)
```

## 最佳实践

### 文件管理
- ✅ 提交加密的 .env 文件到代码仓库
- ❌ 不要提交 .env.keys 文件
- ✅ 使用 .env.example 作为模板文件
- ✅ 在 .gitignore 中添加 .env.keys

### 密钥管理
- 生产环境使用云服务的密钥管理
- 本地开发使用 .env.keys 文件
- 定期轮换加密密钥

## 与传统 dotenv 的对比

| 特性 | dotenv | dotenvx |
|------|--------|---------|
| 基础功能 | ✅ | ✅ |
| 加密支持 | ❌ | ✅ |
| 多环境 | 有限 | ✅ |
| 跨平台 | Node.js | 全平台 |
| 变量扩展 | 需插件 | 内置 |
| 命令替换 | ❌ | ✅ |

## 总结

Dotenvx 是现代应用程序环境变量管理的最佳选择，特别适合：
- 需要高安全性的生产环境
- 多环境部署的复杂项目
- 团队协作的大型项目
- 有合规要求的企业应用
