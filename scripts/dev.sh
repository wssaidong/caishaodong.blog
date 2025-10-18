#!/bin/bash

# 博客开发服务器启动脚本

set -e

echo "🚀 启动博客开发服务器..."

# 检查是否在正确的目录
if [ ! -f "config.toml" ]; then
    echo "❌ 错误: 请在博客根目录运行此脚本"
    exit 1
fi

# 检查端口参数
PORT=${1:-1111}

echo "📝 博客配置:"
echo "   - 主题: serene (简约风格)"
echo "   - 端口: $PORT"
echo "   - 地址: http://127.0.0.1:$PORT"

echo ""
echo "🔧 开发提示:"
echo "   - 修改内容后会自动重新构建"
echo "   - 按 Ctrl+C 停止服务器"
echo "   - 样式文件位于 sass/custom.scss"

echo ""
echo "🌐 启动服务器..."

# 启动 Zola 开发服务器
zola serve --port $PORT
