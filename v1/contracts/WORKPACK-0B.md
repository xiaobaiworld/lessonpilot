# v1 Contracts - Version Manifest (Stage 0B)

完成日期：2026-08-23

## 工作包 0B 内容

建立版本清单：HTTP/OpenAPI、course package、extension message、local storage、Web/extension build version

## 已建立

### 版本定义 (`versions.json`)

| 组件 | 版本 | 状态 | 目标阶段 |
|------|------|------|---------|
| HTTP API | 2.0.0 | development | 1A（设计 06 第 4.5 节） |
| Course Package | 3.0.0 | development | 0C + structured interaction content |
| Extension Messages | 2.0.0 | development | 0C |
| Extension Storage | 2.0.0 | development | 0B（本工作包） |
| Web Build | 0.0.0 | placeholder | 3A |
| Extension Build | 0.0.0 | placeholder | 4A |

### 支持矩阵

v1.0.0 release 版本支持组合（各组件版本号）

### 版本兼容性规则

- Major 版本变化 = 不兼容；需要协调部署
- Minor 版本变化 = 向后兼容；可独立推进
- 未知 major 版本 = 安全拒绝（防止加载遗留或未来契约）

### 类型定义和检查器

- `version-manifest.ts`：版本定义的 TypeScript 类型和常量
- `check-versions.mjs`：版本兼容性验证工具（部署前检查）

## 后续工作

- **0C**：课程包和插件消息 JSON Schema 真源
- **0D**：匿名测试夹具（设计 04 第 3.3 节）
- **0E**：v1 数据库入口和旧 schema 拒绝门禁
- **0F**：仓库级工程门禁改造
- **0G**：CI 集成

## 检查命令

```bash
# 验证版本兼容性
node v1/contracts/check-versions.mjs

# TypeScript 类型检查
tsc --noEmit
```

## 设计基线

- 版本控制策略：设计 09 第 3.1 节
- 兼容性与切换：设计 09 第 4.2 节
