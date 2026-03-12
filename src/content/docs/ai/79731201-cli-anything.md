# CLI-Anything：让所有软件成为AI Agent的原生工具

> AI Agent 擅长推理，但在使用真实专业软件时却表现得十分糟糕。当前解决方案要么是脆弱的 UI 自动化，要么是有限的 API，要么是功能残缺的重新实现。CLI-Anything 通过一条命令，将任何专业软件转化为 Agent 原生工具，不损失任何功能。

## 核心愿景

**今天的软件服务于人类，明天的用户将是 AI Agent。**

CLI-Anything 旨在弥合 AI Agent 与全球软件之间的鸿沟，让任何软件都能被 Agent 控制。

## 为什么选择 CLI？

CLI 是人类和 AI Agent 的通用接口：

- **结构化且可组合** - 文本命令匹配 LLM 格式，可链接成复杂工作流
- **轻量且通用** - 开销极小，跨系统无需依赖
- **自我描述** - `--help` 参数提供 Agent 可发现的自动文档
- **成功验证** - Claude Code 每天通过 CLI 运行数千个真实工作流
- **Agent 优先设计** - 结构化 JSON 输出消除解析复杂性
- **确定性且可靠** - 一致的结果实现可预测的 Agent 行为

## 工作原理：7 阶段流水线

CLI-Anything 采用经过验证的 7 阶段方法论：

1. **🔍 分析** - 扫描源代码，将 GUI 操作映射到 API
2. **📐 设计** - 设计命令组、状态模型、输出格式
3. **🔨 实现** - 使用 Click 构建 CLI，支持 REPL、JSON 输出、撤销/重做
4. **📋 计划测试** - 创建包含单元和 E2E 测试计划的 TEST.md
5. **🧪 编写测试** - 实现全面测试套件
6. **📝 文档** - 更新 TEST.md 和结果
7. **📦 发布** - 创建 setup.py，安装到 PATH

## 快速开始

### Claude Code 用户

```bash
# 添加插件市场
/plugin marketplace add HKUDS/CLI-Anything

# 安装插件
/plugin install cli-anything

# 生成 GIMP 的完整 CLI
/cli-anything:cli-anything ./gimp

# 优化和扩展 CLI
/cli-anything:refine ./gimp
```

### OpenCode 用户

```bash
# 克隆仓库
git clone https://github.com/HKUDS/CLI-Anything.git

# 全局安装命令
cp CLI-Anything/opencode-commands/*.md ~/.config/opencode/commands/
cp CLI-Anything/cli-anything-plugin/HARNESS.md ~/.config/opencode/commands/

# 生成 CLI
/cli-anything ./gimp
```

## 支持的应用场景

CLI-Anything 已在 11 个不同领域的复杂应用中验证：

| 类别 | 应用示例 |
|------|----------|
| 🎨 创意工具 | GIMP, Blender, Inkscape, Audacity |
| 📹 视频编辑 | OBS Studio, Kdenlive, Shotcut |
| 📊 数据分析 | JupyterLab, DBeaver, KNIME |
| 🏢 办公套件 | LibreOffice (Writer, Calc, Impress) |
| 🔬 科学计算 | ImageJ, FreeCAD, QGIS |
| 🤖 AI/ML 平台 | Stable Diffusion WebUI, ComfyUI |
| 📐 图表工具 | Draw.io, PlantUML, Mermaid |

## 测试验证

- **1,508 个测试用例** 全部通过
- **1,073 个单元测试** - 使用合成数据测试核心功能
- **435 个端到端测试** - 使用真实文件和软件验证
- **100% 通过率**

每层验证确保生产可靠性：
- 单元测试：隔离测试核心函数
- E2E 测试（原生）：项目文件生成管道
- E2E 测试（真实后端）：真实软件调用 + 输出验证
- CLI 子进程测试：已安装命令验证

## 核心特性

1. **通用访问** - 任何软件通过结构化 CLI 立即可被 Agent 控制
2. **无缝集成** - 无需 API、GUI、重建或复杂包装器
3. **完整功能保留** - 直接调用真实应用后端，无妥协
4. **结构化输出** - 内置 JSON 输出便于 Agent 消费
5. **状态管理** - 持久化项目状态，支持撤销/重做
6. **REPL 交互** - 统一的交互式命令行体验
7. **多平台支持** - Claude Code、OpenCode，更多平台陆续支持

## 实际效果

```bash
# 安装到 PATH
cd gimp/agent-harness && pip install -e .

# 随时使用
cli-anything-gimp --help
cli-anything-gimp project new --width 1920 --height 1080 -o poster.json
cli-anything-gimp --json layer add -n "Background" --type solid --color "#1a1a2e"

# 进入交互式 REPL
cli-anything-gimp
```

## 与传统方案的对比

| 痛点 | CLI-Anything 的解决方案 |
|------|-------------------------|
| "AI 无法使用真实工具" | 直接集成真实软件后端，无功能损失 |
| "UI 自动化经常崩溃" | 无截图、无点击，纯命令行可靠性 |
| "Agent 需要结构化数据" | 内置 JSON 输出，Agent 友好 |
| "定制集成成本高" | 一个插件自动为任何代码库生成 CLI |
| "原型与生产差距" | 1,508 个真实软件测试验证 |

## 总结

CLI-Anything 代表了 AI Agent 与专业软件交互的新范式。它不是简单的 UI 自动化或 API 封装，而是一个完整的解决方案，通过自动分析、设计、实现、测试和文档化，为任何软件生成生产级的 CLI 接口。

随着 AI Agent 在开发和日常工作中的应用越来越广泛，CLI-Anything 提供了一条清晰的道路，让现有的专业软件能够无缝接入 Agent 工作流，释放 AI 的全部潜力。

**项目地址**: https://github.com/HKUDS/CLI-Anything
