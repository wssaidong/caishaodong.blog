+++
title = "Dotenvx 使用指南"
date = 2025-02-09T21:00:00Z
description = "Dotenvx 是由 dotenv 原作者开发的下一代环境变量管理工具，提供了加密、多环境支持等高级功能的完整使用指南。"

[taxonomies]
tags = ["dotenvx", "环境变量", "配置管理", "安全", "加密", "Node.js"]
categories = ["工具"]
+++

# Dotenvx 使用指南

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

    subgraph "配置文件"
        E[config.toml<br/>非敏感配置] --> F[配置加载器]
        G[.env<br/>敏感信息] --> F
        H[.env.production<br/>加密配置] --> F
    end

    subgraph "Dotenvx 核心"
        D --> I[环境变量解析]
        I --> J[变量扩展]
        J --> K[命令替换]
        K --> L[加密/解密]
        L --> M[应用程序]
    end

    subgraph "生产环境"
        N[CI/CD] --> O[私钥注入]
        O --> P[dotenvx run -f .env.production]
        P --> L
    end

    subgraph "安全层"
        Q[AES-256 加密] --> L
        R[椭圆曲线密码学] --> L
        S[公钥/私钥分离] --> L
    end

    subgraph "多平台支持"
        M --> T[Node.js]
        M --> U[Python]
        M --> V[Go]
        M --> W[Rust]
        M --> X[Java]
    end

    style A fill:#e1f5fe
    style M fill:#c8e6c9
    style L fill:#fff3e0
    style Q fill:#ffebee
    style R fill:#ffebee
    style S fill:#ffebee
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

### ⚡ 高级功能
- 变量扩展 (Variable Expansion)
- 命令替换 (Command Substitution)
- 预提交和预构建钩子
- 多文件支持

## 安装方式

### NPM 安装
```bash
npm install @dotenvx/dotenvx --save
```

### 全局安装
```bash
npm install @dotenvx/dotenvx -g
```

### 其他包管理器
```bash
# Yarn
yarn add @dotenvx/dotenvx

# PNPM
pnpm add @dotenvx/dotenvx

# Bun
bun add @dotenvx/dotenvx
```

## 基础使用

### 1. 简单运行
```bash
# 创建 .env 文件
echo "HELLO=World" > .env
echo "console.log('Hello ' + process.env.HELLO)" > index.js

# 使用 dotenvx 运行
dotenvx run -- node index.js
# 输出: Hello World
```

### 2. 多环境支持
```bash
# 创建生产环境配置
echo "HELLO=production" > .env.production

# 指定环境文件运行
dotenvx run -f .env.production -- node index.js
# 输出: Hello production
```

### 3. 组合多个环境文件
```bash
# 创建本地配置
echo "HELLO=local" > .env.local

# 组合加载多个文件（优先级：local > 默认）
dotenvx run -f .env.local -f .env -- node index.js
# 输出: Hello local
```

### 4. 使用框架约定
```bash
# Next.js 约定加载
dotenvx run --convention=nextjs -- node index.js
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

### 运行加密的环境
```bash
# 本地开发（使用 .env.keys）
dotenvx run -f .env.production -- node index.js

# 生产环境（使用环境变量）
DOTENV_PRIVATE_KEY_PRODUCTION="bd7c50b..." dotenvx run -- node index.js
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

### 指定环境文件
```javascript
require('@dotenvx/dotenvx').config({
  path: ['.env.local', '.env']
})
```

## 使用场景

### 1. 本地开发环境
- 快速设置和切换开发环境
- 支持多个开发者的个性化配置
- 敏感信息本地加密存储

### 2. CI/CD 流水线
- GitHub Actions、GitLab CI 等平台的安全环境变量处理
- 加密的配置文件可以安全地存储在代码仓库中
- 私钥通过 CI 平台的 secrets 管理

### 3. 多环境部署
- 开发、测试、预生产、生产环境的配置管理
- 云服务（AWS、Azure、GCP）的环境变量管理
- Docker 容器的环境配置

### 4. 团队协作
- 统一的环境配置标准
- 敏感信息的安全共享
- 配置变更的版本控制

### 5. 安全合规
- 满足企业级安全要求
- 减少明文密钥泄露风险
- 符合 SOC2、ISO27001 等合规标准

### 6. 配置文件集成
- 与 TOML、YAML、JSON 等配置文件结合使用
- 分离敏感信息和应用配置
- 支持多层配置覆盖和合并

## 高级功能示例

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

### TOML 配置集成
Dotenvx 可以与 TOML 配置文件完美结合，实现配置分离：

```javascript
// config.js - 结合 TOML 和 dotenvx
const fs = require('fs')
const toml = require('toml')
require('@dotenvx/dotenvx').config()

// 读取 TOML 基础配置
const configFile = fs.readFileSync('./config.toml', 'utf8')
const baseConfig = toml.parse(configFile)

// 合并环境变量中的敏感信息
const config = {
  ...baseConfig,
  database: {
    ...baseConfig.database,
    url: process.env.DATABASE_URL,
    password: process.env.DB_PASSWORD
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    apiKey: process.env.API_KEY
  }
}

module.exports = config
```

**config.toml** (非敏感配置)
```toml
[app]
name = "MyApp"
version = "1.0.0"

[server]
host = "0.0.0.0"
port = 3000

[database]
driver = "postgres"
pool_size = 10
```

**.env** (敏感配置)
```env
DATABASE_URL=postgres://user:pass@localhost/db
DB_PASSWORD=secret123
JWT_SECRET=your_jwt_secret
API_KEY=your_api_key
```

### 预提交钩子
```bash
# 在提交前自动加密敏感变量
dotenvx precommit
```

## 最佳实践

### 1. 文件管理
- ✅ 提交加密的 .env 文件到代码仓库
- ❌ 不要提交 .env.keys 文件
- ✅ 使用 .env.example 作为模板文件
- ✅ 在 .gitignore 中添加 .env.keys

### 2. 密钥管理
- 生产环境使用云服务的密钥管理（AWS Secrets Manager、Azure Key Vault）
- 本地开发使用 .env.keys 文件
- 定期轮换加密密钥
- 使用强随机密钥生成器

### 3. 环境分离
- 不同环境使用不同的加密密钥
- 生产环境密钥严格控制访问权限
- 开发和生产环境完全隔离

### 4. 监控和审计
- 记录环境变量的访问日志
- 监控异常的解密尝试
- 定期审计密钥使用情况

## 与传统 dotenv 的对比

| 特性 | dotenv | dotenvx |
|------|--------|---------|
| 基础功能 | ✅ | ✅ |
| 加密支持 | ❌ | ✅ |
| 多环境 | 有限 | ✅ |
| 跨平台 | Node.js | 全平台 |
| 变量扩展 | 需插件 | 内置 |
| 命令替换 | ❌ | ✅ |
| 安全性 | 低 | 高 |
| 企业级功能 | ❌ | ✅ |

## 常见问题

### Q: 加密文件安全吗？
A: 是的。Dotenvx 使用 AES-256 加密和椭圆曲线密码学，即使加密文件泄露，没有私钥也无法解密。

### Q: 如何迁移现有项目？
A: 只需将 `require('dotenv')` 替换为 `require('@dotenvx/dotenvx')`，无需修改其他代码。

### Q: 支持哪些部署平台？
A: 支持所有主流平台，包括 Heroku、Vercel、Netlify、AWS、Docker 等。

### Q: 性能影响如何？
A: 解密过程非常快速，对应用启动时间影响微乎其微。

## 实际项目示例

### Node.js + Express 项目
```javascript
// app.js
require('@dotenvx/dotenvx').config()

const express = require('express')
const app = express()

const config = {
  port: process.env.PORT || 3000,
  dbUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  apiKey: process.env.API_KEY
}

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`)
})
```

### Docker 集成
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

# 安装 dotenvx
RUN npm install -g @dotenvx/dotenvx

COPY . .

# 使用 dotenvx 运行应用
CMD ["dotenvx", "run", "--", "node", "app.js"]
```

### GitHub Actions 配置
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Install dotenvx
        run: npm install -g @dotenvx/dotenvx

      - name: Run tests
        env:
          DOTENV_PRIVATE_KEY_PRODUCTION: ${{ secrets.DOTENV_PRIVATE_KEY_PRODUCTION }}
        run: dotenvx run -f .env.production -- npm test

      - name: Deploy
        env:
          DOTENV_PRIVATE_KEY_PRODUCTION: ${{ secrets.DOTENV_PRIVATE_KEY_PRODUCTION }}
        run: dotenvx run -f .env.production -- npm run deploy
```

### Java Spring Boot 集成
```java
// Application.java
@SpringBootApplication
public class Application {
    static {
        // 在应用启动前加载 dotenvx
        try {
            ProcessBuilder pb = new ProcessBuilder("dotenvx", "run", "--", "echo", "loaded");
            pb.inheritIO();
            Process process = pb.start();
            process.waitFor();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

### Python Django 项目
```python
# settings.py
import os
import subprocess

# 使用 dotenvx 加载环境变量
try:
    subprocess.run(['dotenvx', 'run', '--', 'python', '-c', 'print("Environment loaded")'],
                   check=True, capture_output=True)
except subprocess.CalledProcessError:
    print("Warning: dotenvx not found, using default environment")

# Django 配置
SECRET_KEY = os.environ.get('SECRET_KEY')
DATABASE_URL = os.environ.get('DATABASE_URL')
DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'
```

## 企业级部署方案

### AWS 部署
```bash
# 在 AWS EC2 或 ECS 中设置环境变量
export DOTENV_PRIVATE_KEY_PRODUCTION="your-private-key"

# 使用 AWS Systems Manager Parameter Store
aws ssm put-parameter \
  --name "/myapp/dotenv-private-key" \
  --value "your-private-key" \
  --type "SecureString"

# 在启动脚本中获取密钥
DOTENV_PRIVATE_KEY_PRODUCTION=$(aws ssm get-parameter \
  --name "/myapp/dotenv-private-key" \
  --with-decryption \
  --query "Parameter.Value" \
  --output text)

dotenvx run -f .env.production -- node app.js
```

### Kubernetes 部署
```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: myapp:latest
        command: ["dotenvx", "run", "--", "node", "app.js"]
        env:
        - name: DOTENV_PRIVATE_KEY_PRODUCTION
          valueFrom:
            secretKeyRef:
              name: dotenv-secrets
              key: private-key
---
apiVersion: v1
kind: Secret
metadata:
  name: dotenv-secrets
type: Opaque
data:
  private-key: <base64-encoded-private-key>
```

## 总结

Dotenvx 是现代应用程序环境变量管理的最佳选择，特别适合：
- 需要高安全性的生产环境
- 多环境部署的复杂项目
- 团队协作的大型项目
- 有合规要求的企业应用

通过其强大的加密功能和灵活的多环境支持，Dotenvx 为开发者提供了一个安全、易用、功能丰富的环境变量管理解决方案。
