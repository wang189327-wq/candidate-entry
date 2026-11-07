# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增

- **GitHub Pages 自动部署**：新增 `.github/workflows/deploy-pages.yml`，push `main` 即自动构建并发布到
  `https://wang189327-wq.github.io/candidate-entry/`，作为 Vercel 之外的零成本托管兜底，
  避免单一平台依赖（Vercel 项目因仓库改名需重新绑定 GitHub 应用，手动改分支前无法自动触发）。

### 变更

- README 在线演示地址改指 GitHub Pages（已上线最新版）；Vercel 镜像徽章保留待更新。
- 仓库 About 的 Homepage 同步更新为 GitHub Pages 地址。
- **自定义域名与项目解绑**：Vercel 项目 `portfolio-web` 上移除 `katherineportfolio.cn`
  与 `www.katherineportfolio.cn` 两个自定义域名（含主域名指向 `www` 的重定向规则），
  域名已完全释放，可用于其他项目。站点本身不受影响，仍可通过
  `portfolio-web-wine-nine.vercel.app` 与 GitHub Pages 访问。
- **云端 Supabase 五张表已清空**：`candidates` / `sap_codes` / `images` / `feishu_accounts` /
  `program_users` 的历史数据（含真实候选人手机号、微信号）全部删除，
  仅保留重建的 `admin` 演示账号以维持 README 中的登录说明可用。
  清空前快照存于 `本地私有备份目录`。

## [2.0.0] - 2026-11-07

### 新增

- **写入目标可插拔架构**：`src/lib/adapters/` 抽象出统一适配器接口
  `{ id, name, fields, write(record, config), test(config) }`，
  「信息识别」与「数据落地」彻底解耦。
- 五种写入目标：飞书多维表格、通用 Webhook、群机器人（飞书 / 钉钉 / 企业微信）、
  Supabase 云端、本地 CSV / JSON 导出。
- Web 版新增 **Tab5「接入配置」**：左侧选目标系统、右侧动态配置表单、连通性测试、一键保存生效。
- Web 版 Tab1 写入按钮文案随目标系统动态变化，配置变更实时生效（监听 `focus` / `storage` 事件）。
- 桌面版支持多目标写入：按 `数据/integration_config.json` 路由，
  默认仍为飞书多维表格，保持既有行为不变；Tab4 新增「默认写入目标」选择与测试。
- GitHub Actions CI：`npm run build` 构建校验 + 桌面版 Python 语法校验 + 密钥泄漏扫描。
- 桌面版 `DATA_DIR` 增加回退逻辑：优先读桌面 `数据/` 目录，找不到则回退到脚本同级 `数据/`，
  开源副本克隆后即可直接运行。

### 变更

- 仓库默认分支统一为 `main`（原 `信息录入` / `master` 已删除，GitHub 自动重定向旧链接）。
- 仓库名去掉多余连字符：`candidate-information--entry` → `candidate-entry`。
- 桌面版源码由 2252 行增至 2459 行。
- README 新增演示动线 GIF（7 步流程带中文标注）与 5 张界面截图。

### 修复

- **「填充示例」弹出「请先粘贴聊天记录文本」且识别不出内容**：
  `setTimeout(handleParse, 50)` 捕获的是尚未提交的旧 state，改为直接用样本文本解析。
- **写入云端报 `Could not find the '姓名' column`**：
  Supabase `candidates` 表列名为英文（`name/age/store/position/phone`），
  适配器补上中→英列名映射，性别与 SAP 代码按表结构丢弃（与改造前行为一致）。
- **切换页签后已填数据丢失**：所有 Tab 改为常驻挂载、仅切换显隐，组件 state 不再被卸载清空。
- 写入目标变更改为通过 `integration-changed` 事件实时同步，Tab1 不再依赖窗口 focus 事件。

### 安全

- 移除 `src/data/sapConfig.js` 中硬编码的飞书 `App Secret` / `App Token`，改为占位示例。
- 移除 `src/lib/adapters/feishu.js` 输入框占位符中残留的真实多维表格 `app_token`。
- 桌面版 Supabase `service_role` key 改为环境变量注入（`SUPABASE_KEY`）。
- 桌面版飞书凭证改为占位符 + `feishu_accounts.example.json` 示例。
- 真实门店联系方式截图不随仓库分发。
- 新增 GitHub Actions 密钥泄漏扫描（`app_secret` / 飞书 App ID / service_role JWT）。

## [1.1.0] - 2026-11-07

### 新增

- 中英双语 README（`README.md` / `README.en.md`）、MIT License、`.env.example`。
- 收录桌面终版源码至 `desktop/`，附运行说明与 50 项功能清单。
- 功能概览图 `docs/images/overview.png`。

### 修复

- 修复默认分支指向旧快照（访客看到的代码落后于 `master` 两个提交）的问题。

## [1.0.0] - 2026-06

初始版本：桌面版 Tkinter 六次迭代（v1.0 → 桌面终版）与 Web 版 React 原型。
