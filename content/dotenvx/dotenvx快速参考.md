+++
title = "Dotenvx 快速参考"
date = 2025-02-09T21:05:00Z
description = "Dotenvx 快速参考手册，包含常用命令、配置示例和最佳实践，帮助开发者快速上手使用。"

[taxonomies]
tags = ["dotenvx", "环境变量", "快速参考", "命令行", "配置"]
categories = ["工具"]
+++

# Dotenvx 快速参考

## 安装
```bash
# NPM
npm install @dotenvx/dotenvx --save

# 全局安装
npm install @dotenvx/dotenvx -g

# Yarn
yarn add @dotenvx/dotenvx

# PNPM
pnpm add @dotenvx/dotenvx
```

## 基础命令

### 运行命令
```bash
# 基础运行
dotenvx run -- node app.js

# 指定环境文件
dotenvx run -f .env.production -- node app.js

# 多文件组合
dotenvx run -f .env.local -f .env -- node app.js

# 使用框架约定
dotenvx run --convention=nextjs -- node app.js
```

### 加密命令
```bash
# 设置加密变量
dotenvx set KEY "value" -f .env.production

# 加密现有文件
dotenvx encrypt -f .env.production

# 生成密钥对
dotenvx genkey
```

### 其他命令
```bash
# 查看帮助
dotenvx --help

# 查看版本
dotenvx --version

# 验证文件
dotenvx validate -f .env.production
```

## 环境文件命名约定

```
.env                # 默认环境变量
.env.local          # 本地覆盖（所有环境）
.env.development    # 开发环境
.env.staging        # 测试环境  
.env.production     # 生产环境
.env.test           # 测试环境
.env.keys           # 私钥文件（不要提交）
.env.example        # 示例文件（提交到仓库）
```

## 代码集成

### JavaScript/Node.js
```javascript
// 替换 dotenv
require('@dotenvx/dotenvx').config()

// ES6 模块
import { config } from '@dotenvx/dotenvx'
config()

// 指定文件
require('@dotenvx/dotenvx').config({
  path: ['.env.local', '.env']
})
```

### 环境变量优先级
```
命令行环境变量 > .env.local > .env.{NODE_ENV} > .env
```

## 加密工作流程

### 1. 初始化加密
```bash
# 创建加密的环境变量
dotenvx set DATABASE_URL "postgres://user:pass@localhost/db" -f .env.production
```

### 2. 文件结构
```
project/
├── .env.production          # 加密的环境文件（可提交）
├── .env.keys               # 私钥文件（不要提交）
├── .gitignore              # 包含 .env.keys
└── app.js
```

### 3. 本地运行
```bash
dotenvx run -f .env.production -- node app.js
```

### 4. 生产部署
```bash
# 设置私钥环境变量
export DOTENV_PRIVATE_KEY_PRODUCTION="your-private-key"
dotenvx run -f .env.production -- node app.js
```

## 常用场景

### 开发环境切换
```bash
# 开发环境
dotenvx run -f .env.development -- npm start

# 本地环境
dotenvx run -f .env.local -- npm start

# 生产模拟
dotenvx run -f .env.production -- npm start
```

### Docker 集成
```dockerfile
FROM node:18-alpine
RUN npm install -g @dotenvx/dotenvx
CMD ["dotenvx", "run", "-f", ".env.production", "--", "node", "app.js"]
```

### CI/CD 集成
```yaml
# GitHub Actions
- name: Run tests
  env:
    DOTENV_PRIVATE_KEY_PRODUCTION: ${{ secrets.DOTENV_PRIVATE_KEY }}
  run: dotenvx run -f .env.production -- npm test
```

## 变量扩展语法

### 基础扩展
```env
BASE_URL=https://api.example.com
API_ENDPOINT=${BASE_URL}/v1
```

### 默认值
```env
PORT=${PORT:-3000}
NODE_ENV=${NODE_ENV:-development}
```

### 命令替换
```env
COMMIT_SHA=$(git rev-parse HEAD)
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
```

## 安全最佳实践

### ✅ 应该做的
- 提交加密的 .env 文件到代码仓库
- 使用 .env.keys 进行本地开发
- 在生产环境使用环境变量传递私钥
- 定期轮换加密密钥
- 使用强随机密钥

### ❌ 不应该做的
- 不要提交 .env.keys 文件
- 不要在代码中硬编码私钥
- 不要在日志中输出敏感信息
- 不要在不安全的渠道传输私钥

## 故障排除

### 常见错误
```bash
# 找不到私钥
Error: missing DOTENV_PRIVATE_KEY_PRODUCTION
# 解决：设置环境变量或检查 .env.keys 文件

# 解密失败
Error: decryption failed
# 解决：检查私钥是否正确

# 文件不存在
Error: .env.production not found
# 解决：检查文件路径和名称
```

### 调试模式
```bash
# 启用详细日志
DEBUG=dotenvx* dotenvx run -- node app.js

# 验证配置
dotenvx validate -f .env.production
```

## 框架特定配置

### Next.js
```bash
dotenvx run --convention=nextjs -- npm run dev
```

### React
```bash
dotenvx run -f .env.local -- npm start
```

### Vue.js
```bash
dotenvx run -f .env.development -- npm run serve
```

### Express.js
```javascript
require('@dotenvx/dotenvx').config()
const express = require('express')
const app = express()
```

## TOML 配置集成

### 基础集成模式
```javascript
// 结合 TOML 和 dotenvx
const fs = require('fs')
const toml = require('toml')
require('@dotenvx/dotenvx').config()

const configFile = fs.readFileSync('./config.toml', 'utf8')
const config = toml.parse(configFile)

// 合并环境变量
config.database.url = process.env.DATABASE_URL
config.auth.secret = process.env.JWT_SECRET
```

### 配置文件分离
```
config.toml     -> 应用配置（非敏感）
.env           -> 敏感信息（密码、密钥）
.env.example   -> 环境变量模板
```

### 多环境 TOML 配置
```bash
# 开发环境
dotenvx run -f .env.development -- node -r ./config.js app.js

# 生产环境
dotenvx run -f .env.production -- node -r ./config.js app.js
```

## 云平台集成

### AWS
```bash
# 使用 AWS Systems Manager
aws ssm put-parameter --name "/app/dotenv-key" --value "key" --type "SecureString"
```

### Heroku
```bash
# 设置配置变量
heroku config:set DOTENV_PRIVATE_KEY_PRODUCTION="your-key"
```

### Vercel
```bash
# 使用 Vercel CLI
vercel env add DOTENV_PRIVATE_KEY_PRODUCTION
```

### Netlify
```bash
# 在 netlify.toml 中配置
[build.environment]
  DOTENV_PRIVATE_KEY_PRODUCTION = "your-key"
```

## 性能优化

### 缓存配置
```javascript
// 缓存配置对象
const config = require('@dotenvx/dotenvx').config()
```

### 延迟加载
```javascript
// 只在需要时加载
if (process.env.NODE_ENV === 'production') {
  require('@dotenvx/dotenvx').config({ path: '.env.production' })
}
```

## 版本兼容性

| 版本 | Node.js | 特性 |
|------|---------|------|
| 1.x | >=14 | 基础功能 |
| 2.x | >=16 | 加密支持 |
| 3.x | >=18 | 高级功能 |

## 相关资源

- [官方文档](https://dotenvx.com/docs)
- [GitHub 仓库](https://github.com/dotenvx/dotenvx)
- [NPM 包](https://www.npmjs.com/package/@dotenvx/dotenvx)
- [安全白皮书](https://dotenvx.com/whitepaper)
