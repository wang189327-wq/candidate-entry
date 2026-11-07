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
- **生产部署请自行收紧**：接入真实业务前，请至少完成以下几件事：
  1. 执行 [`supabase/migrations/20261108_security_hardening.sql`](./supabase/migrations/20261108_security_hardening.sql)——登录与管理员验证码改为服务端 RPC 校验，`anon` 收回 `password_hash` 列读权限，密码哈希不再下发到浏览器；
  2. 如需完整会话安全，再以 Supabase Auth 替换前端登录态（RPC 已消除哈希外泄，但仍建议）；
  3. 通过 `VITE_SUPABASE_*` 环境变量指向你自己的 Supabase 项目，并轮换演示库全部密码与密钥。
- **Web 版只应使用 anon key**：`service_role` 密钥可绕过 RLS，绝不可进入前端代码或提交到仓库。

## 已落实的措施

- 敏感密钥（service_role、App Secret、数据库密码）不进入仓库，统一走环境变量 / 配置文件注入
- CI 中内置密钥泄漏扫描（`scripts/secret_scan.py`），命中即阻断合并
- 桌面版运行时生成的候选人记录 CSV、门店联系方式截图等已加入 `.gitignore`，避免误提交 PII
- 登录校验优先走 `verify_login` RPC（服务端 bcrypt 比对），管理员验证码走 `verify_admin` RPC；RPC 未部署时前端自动回退旧链路，迁移过程零停机
- CSV 导出防公式注入（`= + - @` 前缀中和），`\r` 转义防止错行
- 可访问性：全部表单控件 label 关联、单选组语义化、键盘可达，主按钮文字对比度满足 WCAG AA
