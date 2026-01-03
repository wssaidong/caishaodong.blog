# 部署指南

本文档介绍博客的部署流程和配置。

## 自动部署

项目已配置 GitHub Actions，实现自动部署到 Cloudflare Pages。

### 配置步骤

1. **获取 Cloudflare API Token**

   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - 进入 "My Profile" → "API Tokens"
   - 创建新令牌，使用 "Edit Cloudflare Workers" 模板
   - 权限需要包括：
     - Account - Cloudflare Pages - Edit
     - Zone - Zone - Read（如需自定义域名）

2. **获取 Account ID**

   - 在 Cloudflare Dashboard 中，选择你的账户
   - 在右侧边栏找到 "Account ID"
   - 点击复制

3. **配置 GitHub Secrets**

   在 GitHub 仓库中添加以下 Secrets：

   - `CLOUDFLARE_API_TOKEN` - 第 1 步获取的 API 令牌
   - `CLOUDFLARE_ACCOUNT_ID` - 第 2 步获取的账户 ID

   路径：`Settings` → `Secrets and variables` → `Actions` → `New repository secret`

### 部署流程

推送到 `main` 分支后，GitHub Actions 会自动执行：

1. 检出代码
2. 设置 Node.js 环境
3. 安装依赖（`npm ci`）
4. 构建项目（`npm run build`）
5. 部署到 Cloudflare Pages

### 查看部署状态

在 GitHub 仓库的 "Actions" 标签页可以查看部署日志。

## 手动部署

### 使用 Wrangler CLI

```bash
npm run deploy
```

这个命令会：
1. 构建项目到 `dist/` 目录
2. 使用 Wrangler 部署到 Cloudflare Pages

### 部署配置

部署配置在 `package.json` 中：

```json
{
  "scripts": {
    "deploy": "npm run build && wrangler pages deploy ./dist --project-name=caishaodong"
  }
}
```

## Cloudflare Pages 配置

### 构建设置

- **构建命令**: `npm run build`
- **构建输出目录**: `dist`
- **Node.js 版本**: 23

### 环境变量

当前项目不需要额外的环境变量。

### 自定义域名

1. 在 Cloudflare Pages 项目中，点击 "Add custom domain"
2. 输入你的域名（如 `blog.example.com`）
3. 按照提示配置 DNS 记录

### 重定向规则

如需配置重定向，在项目设置中添加：

```toml
[[redirects]]
  from = "/old-path"
  to = "/new-path"
  status = 301
```

## 性能优化

### 启用压缩

Cloudflare Pages 自动启用 Brotli 和 Gzip 压缩。

### 缓存策略

静态资源（CSS、JS、图片）会自动缓存。

### 预渲染

项目使用 Astro 的静态生成，所有页面在构建时预渲染。

## 监控和分析

### Cloudflare Analytics

在 Cloudflare Dashboard 中可以查看：

- 页面访问量
- 访问来源
- 响应时间
- 错误率

### 搜索引擎优化

项目已配置：

- Sitemap（自动生成）
- RSS feed
- Meta 描述
- 语义化 HTML

## 故障排查

### 部署失败

1. 检查 GitHub Actions 日志
2. 确认 Secrets 配置正确
3. 验证构建在本地成功（`npm run build`）

### 页面无法访问

1. 检查 DNS 配置
2. 确认 Cloudflare Pages 部署成功
3. 查看浏览器控制台错误信息

### 构建缓慢

1. 检查 Node.js 版本
2. 清理 npm 缓存（`npm cache clean --force`）
3. 删除 `node_modules` 重新安装

## 回滚

### 回滚到之前的版本

在 Cloudflare Pages 中：

1. 进入项目设置
2. 选择 "Deployments"
3. 找到想要回滚的版本
4. 点击 "Rollback" 按钮

### 使用 Git 回滚

```bash
# 回退到上一个提交
git reset --hard HEAD~1

# 强制推送
git push --force
```

**注意**：这会触发新的部署。
