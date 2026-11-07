# 桌面版 · 门店求职者信息录入工具

实习期间真实投产使用的 Python Tkinter 桌面工具（生产版本共 6 次迭代，本目录为最终交付版）。
与仓库根目录的 Web 版功能对应，这里是"一切开始的地方"。

## 运行

```bash
# Python 3.9+，依赖：
pip install pillow bcrypt supabase

# 本地模式启动（无需云端配置，内置账号 admin / Aa@123456）
python 求职者信息录入.py
```

程序启动时会自动在当前目录生成 `program_users.json`（本地账号）、`数据/feishu_accounts.json`（飞书账号缓存）。

## 功能一览（50 项，四大模块）

| 模块 | 核心能力 |
|---|---|
| Tab1 信息识别 | 粘贴 BOSS 直聘聊天记录 → 正则解析姓名/手机号/微信号/年龄/门店 → 自动匹配 SAP 代码 → 一键写入飞书多维表格 |
| Tab2 SAP 代码管理 | 门店 ↔ 岗位 ↔ SAP 代码映射的树形管理：模糊搜索、增删改、双击编辑、发布状态统计、列宽持久化 |
| Tab3 图片库 | 店长联系方式截图等业务图片的预览 / 全屏查看 / 复制到剪贴板 / 上传飞书附件 |
| Tab4 飞书账号管理 | 多飞书应用凭证管理、活跃账号切换、Tenant Access Token 连通性测试 |
| 系统层 | 登录窗口（本地 bcrypt 或 Supabase 云端认证）、用户管理、多实例保护、布局持久化、窗口自适应 |

## 数据文件说明（`数据/` 目录）

| 文件 | 说明 | 本仓库提供 |
|---|---|---|
| `sap_config.json` | 门店↔SAP 映射，键格式：`不站班（门店名）岗位名` | ✅ 3 条示例（生产为 38 条真实映射） |
| `layout_config.json` | 各页签分栏宽度、列宽等界面布局 | ✅ |
| `feishu_accounts.json` | 飞书应用凭证（App ID/Secret/Token） | ⚠️ 运行时生成，请参考 `feishu_accounts.example.json` |
| `SAP图片库/`、`固定图片/` | 业务截图素材 | ❌ 含真实门店联系方式，出于隐私考虑不随仓库分发 |

## 敏感信息处理

开源版本已做以下脱敏，接入你自己的环境时替换即可：

- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`：从环境变量读取（service_role 密钥绕过 RLS，**切勿提交到仓库**）
- 飞书 App ID / Secret / Bitable Token：占位符，见代码顶部 `FEISHU_*` 常量与 `feishu_accounts.example.json`
- 飞书多维表格 table_id：`FEISHU_TABLE_ID` 常量
