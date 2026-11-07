# 贡献指南

感谢你对这个工具感兴趣。本项目是个人作品集项目，欢迎一切形式的反馈与贡献。

## 环境准备

```bash
git clone https://github.com/wang189327-wq/candidate-entry.git
cd candidate-entry
npm install
npm run verify        # 确认本地环境正常：lint + format + test + build
```

需要 Node.js 20+。桌面版额外需要 Python 3.10+。

## 提交前必须通过

```bash
npm run verify
```

这一条命令等价于依次执行：

| 命令 | 作用 |
|---|---|
| `npm run lint` | ESLint 检查（react / react-hooks 规则） |
| `npm run format:check` | Prettier 格式校验 |
| `npm test` | Vitest 单元测试 |
| `npm run build` | 生产构建 |

如果 `format:check` 失败，执行 `npm run format` 自动修复后再提交。

## 提交规范

- 一个 PR 只做一件事，标题用中文祈使句（如「修复：代理前缀拼接破坏 query 语义」）
- 提交信息格式：`type: 摘要`，type 取值 `feat` / `fix` / `docs` / `test` / `chore` / `refactor`
- 新增功能请同步更新 `CHANGELOG.md` 的 `[Unreleased]` 段
- 若改动了解析逻辑或适配器契约，**必须补单元测试** —— CI 会检查覆盖率不允许回退

## 代码风格

- 2 空格缩进，单引号，无分号，行宽 120
- 组件文件名用 PascalCase（`Tab1.jsx`），工具函数用 camelCase（`parseText.jsx`）
- 导入路径优先用相对路径；同目录 `./`，上级 `../`
- 中文注释优先，解释「为什么」而非「做了什么」

## 新增写入目标（适配器）

项目最核心的扩展点是写入适配器。实现一个约 40 行：

1. 在 `src/lib/adapters/` 新建文件，导出一个对象：

```js
export const myAdapter = {
  id: 'my-target',
  name: '我的目标系统',
  desc: '一句话说明这个目标是什么。',
  fields: [
    { key: 'url', label: '接口地址', type: 'text', placeholder: 'https://...', hint: '填写说明' },
  ],
  async write(record, config) {
    // 返回 { ok: boolean, message: string }
  },
  async test(config) {
    // 返回 { ok: boolean, message: string }
  },
}
```

2. 在 `src/lib/adapters/index.js` 中导入并加入 `ADAPTERS` 数组。

3. 补单元测试：至少验证契约字段齐备、`write` 的成功与失败分支。

字段类型支持 `text` / `password` / `select` / `number`，`select` 需提供 `options: [{ id, label }]`。

## 报告 Bug

请用 [缺陷报告模板](.github/ISSUE_TEMPLATE/bug_report.md) 提交，附上：

- 复现步骤
- 期望行为 vs 实际行为
- 运行环境（Web / 桌面版、浏览器版本）
- 控制台完整输出（若报错）

## 隐私与合规

- **不要提交任何真实候选人信息、门店联系方式截图或生产凭证**
- 密钥一律走环境变量或配置文件，示例文件只留占位符
- 提交前 CI 会运行密钥扫描，命中即失败

## 许可

贡献的代码以 MIT 许可证发布。
