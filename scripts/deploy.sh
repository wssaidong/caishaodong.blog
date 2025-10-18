#!/bin/bash

# 博客部署脚本
# 用于构建和部署简约风格博客

set -e

echo "🚀 开始部署博客..."

# 检查是否在正确的目录
if [ ! -f "config.toml" ]; then
    echo "❌ 错误: 请在博客根目录运行此脚本"
    exit 1
fi

# 清理旧的构建文件
echo "🧹 清理旧的构建文件..."
rm -rf public

# 构建博客
echo "🔨 构建博客..."
zola build

if [ $? -eq 0 ]; then
    echo "✅ 构建成功!"
else
    echo "❌ 构建失败!"
    exit 1
fi

# 检查是否有 wrangler 命令
if command -v wrangler &> /dev/null; then
    echo "📤 部署到 Cloudflare Pages..."
    wrangler pages publish ./public
    
    if [ $? -eq 0 ]; then
        echo "🎉 部署成功!"
        echo "🌐 博客地址: https://caishaodong.pages.dev"
    else
        echo "❌ 部署失败!"
        exit 1
    fi
else
    echo "⚠️  未找到 wrangler 命令，跳过自动部署"
    echo "📁 构建文件位于 ./public 目录"
    echo "💡 请手动部署或安装 wrangler: npm install -g wrangler"
fi

echo "✨ 部署流程完成!"
