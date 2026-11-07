# 安全策略（Security Policy）

## 支持的版本

| 版本 | 支持 |
|---|---|
| 2.1.x | ✅ |
| < 2.1 | ❌ |

## 报告漏洞

发现安全问题请通过 GitHub 私有漏洞报告渠道反馈（仓库 → Security → Report a vulnerability），**不要**公开提交 Issue。

我会在收到报告后 7 天内给出初步回应，确认问题后 30 天内发布修复版本。

## 使用者须知

本项目是**演示与学习用途**的公开作品集项目，部署了公开的在线演示站。请注意：

- **演示站权限模型宽松**：演示站为便于体验，前端角色判定基于浏览器本地状态，并未接入完整服务端会话。**请勿在演示站输入真实候选人信息或真实业务凭证。**
- **演示库的业务表对 anon 开放写入**：`candidates` / `sap_codes` / `images` / `feishu_accounts` 目前沿用宽松策略，任何拿到 anon key 的人都能增删（anon key 本身是公开的）。演示库内只有示例数据，被清空可重建；但**生产环境必须改为 Supabase Auth + 按用户 RLS 策略**，否则数据可被任意篡改。唯一例外是 `program_users`（见下）。
- **生产部署请自行收紧**：接入真实业务前，请至少完成以下几件事：
  1. 依次执行 [`supabase/migrations/20261108_security_hardening.sql`](./supabase/migrations/20261108_security_hardening.sql) 与 [`20261108_account_admin_rpc.sql`](./supabase/migrations/20261108_account_admin_rpc.sql)——登录、管理员验证码、账号增删改全部改为服务端函数校验；`anon` 收回 `password_hash` 列读权限且始终没有该表写权限；
  2. 为业务表配置按用户的 RLS 策略，或改用 Supabase Auth 会话（推荐，可彻底解决前端登录态可被篡改的问题）；
  3. 通过 `VITE_SUPABASE_*` 环境变量指向你自己的 Supabase 项目，并轮换演示库全部密码与密钥。
- **Web 版只应使用 anon key**：`service_role` 密钥可绕过 RLS，绝不可进入前端代码或提交到仓库。

## 已落实的措施

- 敏感密钥（service_role、App Secret、数据库密码）不进入仓库，统一走环境变量 / 配置文件注入
- CI 中内置密钥泄漏扫描（`scripts/secret_scan.py`），命中即阻断合并
- 桌面版运行时生成的候选人记录 CSV、门店联系方式截图等已加入 `.gitignore`，避免误提交 PII
- 登录校验走 `verify_login` RPC：bcrypt 比对在库内完成，密码哈希不下发浏览器
- 管理员验证码走 `verify_admin` RPC：验证码存 `app_settings`（RLS 开启且无策略），前端不持有明文
- 账号增删改走 `admin_save_account` / `admin_delete_account`：验证码库内校验，`feishu_accounts` 与 `program_users` 单事务写入，密码在库内 bcrypt，前端不接触哈希
- `program_users` 对 anon 只开放 `id / username / role` 三列读取，`password_hash` 不可读、全表不可写
- CSV 导出防公式注入（`= + - @` 前缀中和），`\r` 转义防止错行
- 可访问性：全部表单控件 label 关联、单选组语义化、键盘可达，主按钮文字对比度满足 WCAG AA
