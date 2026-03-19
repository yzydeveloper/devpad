# DevPad

[English](./README.md)

DevPad 是一个轻量的 VSCode 工作区笔记插件，帮助开发者在编码过程中随时记录想法、TODO 和代码片段，而不需要离开当前上下文。

## 特性与目标

- 以 VSCode Activity Bar 侧边栏形式集成到工作区
- 在主编辑区中以接近文档的方式编辑笔记正文
- 支持工作区级笔记、标签、搜索和筛选
- 支持保存当前代码选区，并回跳到原始代码位置
- 默认使用 VSCode 工作区存储，不向仓库写入笔记文件，避免影响 `git status`

DevPad 当前的目标很明确：

- 让记录发生在写代码的地方
- 尽量保持原生、简洁、低打扰的 VSCode 使用体验
- 优先服务个人开发过程中的临时记录，而不是重型知识库

## 开发方式

### 环境要求

- Node.js 20+
- VSCode 1.88+

### 安装依赖

```bash
npm install
```

### 构建

```bash
npm run build
```

### 监听

```bash
npm run watch
```

### 类型检查

```bash
npm run lint
```

### 本地调试

1. 用 VSCode 打开当前仓库
2. 按 `F5`
3. 在新的 Extension Development Host 窗口中打开 `DevPad`

如果你改了 Activity Bar 图标、视图注册这类 manifest 级配置，建议直接重启 Extension Development Host。

## 插件命令

- `DevPad: Open Panel`
- `DevPad: Add Note`
- `DevPad: Open Note`
- `DevPad: Rename Note`
- `DevPad: Edit Note Tags`
- `DevPad: Delete Note`
- `DevPad: Search Notes`
- `DevPad: Filter Notes By Tag`
- `DevPad: Clear Filters`
- `DevPad: Save Selection`
- `DevPad: Open Snippet Source`
