#!/usr/bin/env just --justfile
export PATH := join(justfile_directory(), "node_modules", "bin") + ":" + env_var('PATH')

# 启动开发服务器
dev:
    npm run dev

# 构建项目
build:
    npm run build

# 预览构建结果
preview:
    npm run preview

# 部署到 Cloudflare Pages
deploy:
    npm run deploy

# GitHub 推送
github:
    git push
