# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 修复（安全加固，2026-11-08 第二轮审查）

- **登录改为服务端校验**：前端优先调用 `verify_login` RPC，bcrypt 比对在库内完成，
  `anon` 同时被收回 `program_users.password_hash` 列读权限，密码哈希不再下发浏览器
  （迁移 SQL 见 `supabase/migrations/20261108_security_hardening.sql`，未执行时自动回退兼容）。
- **管理员验证码去 UI 明文**：`118814` 不再硬编码展示，改走 `verify_admin` RPC
  （验证码存 `app_settings` 表，RLS 全禁），placeholder 也不再提示验证码。
- **解析层 7 处边界缺陷**：半角冒号标签不识别、块残缺时 `i+=3` 固定跳行吞掉后续块、
  「复制手机号」被当作手机号值、CRLF 换行 `\r` 污染字段值、门店半角括号不识别、
  年龄正则可被正文无关数字干扰、一行到底写法取不到值。
- **SAP 自动匹配口径统一**：`lookupSapByStore` 同时支持岗位名括号（桌面版口径）与
  `store_name` 列（Web 版口径）精确匹配，半角/全角括号均可。
- **Tab2/Tab4 写操作补齐 error 检查**：增删改失败不再静默，逐一提示并中断。
- **Tab5 适配器配置按目标隔离**：localStorage 改为 `{ adapterId, configs: {目标: 参数} }`，
  切换目标不再互相覆盖参数，旧结构自动迁移。
- **Tab1 性别不再默认「女」**：改为写入前必选，杜绝静默写入错误值。
- **Tab1 接入云端图片库**：店长手机号图优先取 Tab3 上传的真实截图（按 SAP 代码关联），
  无上传时回退内置示例图。
- **主按钮对比度达 WCAG AA**：薄荷绿按钮白字（1.66:1）改深绿 `#22543D`（5.26:1），
  浅红按钮白字（1.42:1）改深红 `#9B2C2C`（5.29:1）。
- 单元测试 80 → **97 项**（解析层 +10、接入配置隔离 +7）；演示素材按最新界面重拍。

### 修复（Tab4 账号管理，2026-11-08）

- **Tab4 账号增删改在网页版完全不可用**（既有缺陷，此前未被发现）：`program_users` 只建了
  SELECT 策略，`anon` 写入被 RLS 拒绝，且失败前已写入 `feishu_accounts` 留下孤儿记录。
  现改走 `admin_save_account` / `admin_delete_account`：验证码库内校验、两张表单事务写入、
  密码在库内 bcrypt 生成，前端不再接触哈希（迁移见 `supabase/migrations/20261108_account_admin_rpc.sql`）。
- 账号写操作统一要求管理员验证码（此前仅「编辑 admin 账号」才要求），提示文案区分保存/删除。
- 移除前端 `VITE_ADMIN_VERIFY_CODE` 回退常量，验证码不再以任何形式存在于前端代码。
- 修复接入配置测试偶发超时：改用必然连接失败的本地地址，不再依赖外网 DNS（4.5s → 0.9s）。

## [2.1.0] - 2026-11-07

### 新增

- **单元测试体系**：引入 Vitest，共 64 项测试覆盖解析层、适配器契约、CSV 转义与 HTTP 封装（后续随解析层加固扩充至 77 项）；
  `npm test` 可本地运行，CI 中作为合并门禁。
- **代码规范工具链**：ESLint（react / react-hooks 插件）+ Prettier，
  新增 `lint` / `lint:fix` / `format` / `format:check` / `coverage` / `verify` 脚本。
- **Issue 模板**：新增缺陷报告与功能建议两份模板，降低外部参与门槛。

### 变更

- 升级构建链路：Vite 5 → 7、Vitest 2 → 5，`npm audit` 漏洞数由 9 项降至 **0 项**。
- `package.json` 项目名由 `jobseeker-portfolio` 更正为 `candidate-entry`，与仓库名一致。
- 重写 `SPEC.md`：原文档描述的是早期 4 页签原型架构，已按当前
  「5 页签 + 适配器可插拔」架构全面更新，补充适配器契约与工程化章节。
- README 在线演示地址改指 GitHub Pages（已上线最新版）；Vercel 镜像徽章保留待更新。
- 仓库 About 的 Homepage 同步更新为 GitHub Pages 地址。

### 修复

- **手机号被误当作姓名写入数据库**：粘贴的聊天记录不完整（例如仅有手机号块）时，
  手机号所在行会被识别为姓名。现改为按内容特征排除联系方式行，中英文姓名均不受影响。
- **解析结果泄漏内部临时字段**：`parseText` 返回值中的 `_phone_block` / `_wechat_block`
  会随记录流入导出的 JSON 文件与 Webhook 请求体，现已在返回前过滤。
- **代理前缀拼接破坏 query 语义**：Webhook 适配器填写 `https://proxy/relay?to=` 这类
  query 式代理前缀时，尾部斜杠被剥离会变成 `?tohttps://...`，导致转发失败。
  现改为只折叠多余斜杠，保留最后一个。

### 清理

- 移除重构后遗留的死代码：`Tab1` 的 `parsedData`、`Tab2` 的 `entry`、
  `Tab3` 的 `sampleImages` / `cloudImages` 三处从未被读取的状态变量。
- `.gitignore` 增加 `coverage/` 与编辑器目录，避免报告文件误入仓库。

## [2.0.0] - 2026-11-07

### 新增

- **GitHub Pages 自动部署**：新增 `.github/workflows/deploy-pages.yml`，push `main` 即自动构建并发布到
  `https://wang189327-wq.github.io/candidate-entry/`，作为 Vercel 之外的零成本托管兜底，
  避免单一平台依赖（Vercel 项目因仓库改名需重新绑定 GitHub 应用，手动改分支前无法自动触发）。
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
- 桌面版源码由 2252 行增至 2469 行。
- README 新增演示动线 GIF（7 步流程带中文标注）与 5 张界面截图。

### 修复

- **「填充示例」弹出「请先粘贴聊天记录文本」且识别不出内容**：
  `setTimeout(handleParse, 50)` 捕获的是尚未提交的旧 state，改为直接用样本文本解析。
- **写入云端报 `Could not find the '姓名' column`**：
  Supabase `candidates` 表列名为英文（`name/age/store/position/phone`），
  适配器补上中→英列名映射，性别与 SAP 代码按表结构丢弃（与改造前行为一致）。
- **切换页签后已填数据丢失**：所有 Tab 改为常驻挂载、仅切换显隐，组件 state 不再被卸载清空。
- 写入目标变更改为通过 `integration-changed` 事件实时同步，Tab1 不再依赖窗口 focus 事件。

## [1.0.0] - 2026-04-15

### 新增

- 求职者信息录入 Web 版：React + Vite + Tailwind 复刻四页签。
- 桌面版（Python Tkinter）：聊天记录解析、SAP 代码管理、图片库、飞书账号管理。
