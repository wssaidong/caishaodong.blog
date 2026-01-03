# wilson-x 技术博客

一个使用 Astro + Starlight 构建的个人技术博客，分享软件开发、工具使用和技术学习过程中的心得体会。

## ✨ 特性

- 📝 **内容丰富** - 涵盖 AI/LLM、API 网关、开发工具、系统编程等多个技术领域
- 🎨 **美观易用** - 基于 Starlight 主题，支持暗色模式和响应式设计
- 🔍 **搜索功能** - 集成 Pagefind 全文搜索
- 📊 **图表支持** - 使用 Mermaid 绘制技术架构图
- 📡 **RSS 订阅** - 支持 RSS feed 订阅更新
- 🚀 **快速构建** - 静态站点生成，部署在 Cloudflare Pages

## 📁 技术栈

- **框架**: [Astro 5.16](https://astro.build/)
- **主题**: [Starlight 0.37](https://starlight.astro.build/)
- **图表**: [astro-mermaid](https://github.com/beoe/rehype-mermaid-js)
- **部署**: [Cloudflare Pages](https://pages.cloudflare.com/)
- **包管理**: npm

## 🚀 快速开始

### 环境要求

- Node.js >= 23
- npm >= 10

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run dev
```

访问 [http://localhost:4321](http://localhost:4321) 查看效果。

### 构建生产版本

```bash
npm run build
```

构建产物将生成在 `dist/` 目录。

### 预览构建结果

```bash
npm run preview
```

## 📦 部署

### 自动部署

项目已配置 GitHub Actions，当推送到 `main` 分支时会自动部署到 Cloudflare Pages。

需要在 GitHub 仓库中配置以下 Secrets：

- `CLOUDFLARE_API_TOKEN` - Cloudflare API 令牌
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare 账户 ID

### 手动部署

```bash
npm run deploy
```

## 📂 项目结构

```
.
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions 部署工作流
├── public/                      # 静态资源
├── src/
│   ├── assets/                  # 项目资源（图片、logo 等）
│   ├── content/
│   │   ├── config.ts           # 内容集合配置
│   │   └── docs/               # 文档内容
│   │       ├── ai/             # AI 与 LLM 相关文章
│   │       ├── api-gateway/    # API 网关相关文章
│   │       ├── dev-tools/      # 开发工具相关文章
│   │       └── system-programming/ # 系统编程相关文章
│   ├── pages/
│   │   └── rss.xml.js          # RSS feed 生成器
│   └── styles/
│       └── custom.css          # 自定义样式
├── astro.config.mjs             # Astro 配置文件
├── package.json                 # 项目依赖
└── README.md                    # 项目说明
```

## 📝 内容分类

### AI 与大语言模型
- LangGraph 中间件系统
- RAG 系统重排机制
- Milvus 向量数据库
- DeepAgents 智能体框架

### API 网关
- Higress 网关系列文档（15篇）
- Kong 网关系列文档
- 网关架构与最佳实践

### 开发工具
- Dotenvx 环境变量管理
- Vibe Kanban AI 编程编排平台
- IDEA 开发插件推荐
- PowerShell 命令行工具

### 系统编程
- Rust 语言学习笔记

## 🛠️ 开发指南

### 添加新文章

1. 在 `src/content/docs/` 对应分类目录下创建 Markdown 文件
2. 在文件顶部添加 frontmatter：

```yaml
---
title: 文章标题
description: 文章描述（150字以内）
pubDate: 2026-01-04
---
```

3. 运行 `npm run build` 验证

### 修改侧边栏

编辑 `astro.config.mjs` 中的 `sidebar` 配置。

### 自定义样式

编辑 `src/styles/custom.css` 文件。

## 📄 许可证

MIT License

## 👨‍💻 作者

wilson-x

## 🔗 相关链接

- [在线访问](https://caishaodong.pages.dev/)
- [GitHub 仓库](https://github.com/wssaidong/caishaodong.blog)
- [Astro 文档](https://docs.astro.build/)
- [Starlight 文档](https://starlight.astro.build/)
