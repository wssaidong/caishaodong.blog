# 开发指南

本文档介绍如何参与博客项目的开发。

## 环境配置

### 必需工具

- Node.js >= 23
- npm >= 10
- Git

### 安装步骤

1. 克隆仓库

```bash
git clone https://github.com/wssaidong/caishaodong.blog.git
cd caishaodong.blog
```

2. 安装依赖

```bash
npm install
```

3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:4321 查看效果。

## 开发工作流

### 分支策略

- `main` - 主分支，始终保持可部署状态
- `feature/*` - 功能开发分支
- `fix/*` - bug 修复分支

### 提交规范

遵循 Conventional Commits 规范：

- `feat:` 新功能
- `fix:` 问题修复
- `docs:` 文档修改
- `style:` 代码格式
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建/工具等

示例：

```bash
git commit -m "feat: 添加搜索功能"
git commit -m "fix: 修复 RSS feed 日期显示问题"
```

### 添加新文章

1. 在 `src/content/docs/` 对应分类目录下创建 Markdown 文件
2. 添加 frontmatter 元数据：

```yaml
---
title: 文章标题
description: 文章描述（150字以内）
pubDate: 2026-01-04
---
```

3. 编写文章内容，支持：
   - Markdown 标准语法
   - Mermaid 图表
   - 代码高亮

4. 更新侧边栏配置（如需要）：

编辑 `astro.config.mjs` 中的 `sidebar` 配置。

### 代码规范

- 使用 2 空格缩进
- 使用单引号（JavaScript）
- 文件名使用小写字母和连字符
- 保持代码简洁清晰

## 项目结构

```
src/
├── assets/          # 静态资源（图片、logo 等）
├── content/
│   ├── config.ts   # 内容集合配置
│   └── docs/       # 文档内容
├── pages/          # 页面文件
├── styles/         # 样式文件
└── content.config.ts # 内容配置
```

## 常见问题

### 如何添加新的分类？

1. 在 `src/content/docs/` 下创建新目录
2. 创建 `index.md` 作为分类首页
3. 在 `astro.config.mjs` 的 `sidebar` 中添加对应配置

### 如何修改主题样式？

编辑 `src/styles/custom.css` 文件，添加自定义 CSS 变量：

```css
:root {
  --sl-color-accent: ...;
  --sl-font-family: ...;
}
```

### 如何调试 RSS feed？

RSS feed 在 `src/pages/rss.xml.js` 中生成。修改后运行：

```bash
npm run build
cat dist/rss.xml
```

## 有用的命令

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview

# 部署到 Cloudflare Pages
npm run deploy

# 检查 Astro 版本
npm run astro info
```
