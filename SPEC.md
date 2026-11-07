# 求职者信息录入工具 · 技术规格

> 本文档描述**当前版本**的实现规格，与代码保持同步。
> 仓库：`candidate-entry`（Web 版 + 桌面版双端同构）

---

## 1. 产品定位

把招聘专员每天的机械劳动压缩成一条链路：

> **粘贴聊天记录 → 自动解析 → SAP 自动匹配 → 一键写入**

写入目标可插拔：**Supabase / 飞书多维表格 / 通用 Webhook / 本地 CSV·JSON**。

项目源于实习期真实业务需求，桌面版（Tkinter）已在团队日常招聘中投产使用；
Web 版（React）在其基础上增加了云端同步与可配置的写入目标。

---

## 2. 总体架构

```
┌──────────────────────┐        ┌────────────────────────┐
│  桌面版 (Tkinter)     │        │  Web 版 (React 18)     │
│  desktop/            │        │  src/                  │
│  求职者信息录入.py    │        │                        │
└──────────┬───────────┘        └───────────┬────────────┘
           │                                │
           │        ┌───────────────────────┴────────┐
           └───────►│  解析层（纯函数）              │
                    │  聊天文本 → 标准记录            │
                    └───────────────────────┬────────┘
                                            │
                    ┌───────────────────────┴────────┐
                    │  写入层（适配器 / 可插拔）      │
                    │  Supabase │ Feishu │ Webhook │
                    │           │ Local CSV·JSON     │
                    └────────────────────────────────┘
```

**核心设计**：「识别」与「写入」彻底解耦。
解析层只负责产出**标准记录**，写入目标由用户在「接入配置」中自由切换。

标准记录字段（`RECORD_FIELDS`）：

```
姓名 / 年龄 / 性别 / 联系方式 / SAP代码 / 意向岗位 / 门店名称
```

---

## 3. Web 版

### 3.1 技术栈

| 项 | 选型 |
|---|---|
| 框架 | React 18 |
| 构建 | Vite 7 |
| 样式 | Tailwind CSS（自定义色板） |
| 持久化 | localStorage（配置）+ Supabase（数据） |
| 部署 | GitHub Pages（主）+ Vercel（备） |

### 3.2 权限模型

角色取自 `program_users.role`（数据库 check 约束只允许 `admin` / `user`），按白名单裁剪页签，未列出的取值一律按 `guest` 处理：

| 角色 | 可见页签 |
|---|---|
| 未登录 | 登录页 |
| `guest`（游客入口） | 仅 Tab1（信息识别） |
| `user`（普通用户） | Tab1 + Tab4（Tab4 显示「我的账号」，只有自己一条且无写按钮） |
| `admin`（管理员） | 全部 5 个页签 |

**可见**页签常驻挂载、仅切换显隐 —— 避免切换时组件卸载导致已填字段丢失；不可见页签不挂载，减少无谓的数据请求。

### 3.3 页签

#### Tab1 · 信息识别

- 左侧 TextArea 粘贴聊天记录，右侧确认区展示识别结果
- 识别字段：姓名、性别、年龄（红绿校验）、联系方式、SAP代码、意向岗位、门店名称
- SAP 代码自动查表回填（门店名称 → SAP代码 → 加载对应手机号图片）
- 门店手机号图片、常用图片、门店门面
- 写入按钮文案**随目标系统动态变化**（录入云端 / 写入飞书 / 发送到接口 / 导出文件）
- 「填充示例」「清空」按钮

#### Tab2 · SAP代码管理

- 左侧表单：岗位城市、岗位名称、SAP代码、是否发布、备注
- 城市筛选 + 是否发布筛选
- 右侧表格（序号 / 城市 / 岗位名称 / SAP代码 / 是否发布 / 备注）
- 增删改查，双击行回填表单（编辑模式）
- localStorage 持久化

#### Tab3 · 图片库

- 左侧列表：常用图片 / 门店门面 / SAP 图片库
- 右侧大图预览 + 详情描述
- 操作：复制路径 / 复制图片 / 删除
- 支持本地上传，新图自动进入列表；删除需确认

#### Tab4 · 登录账号

- 账号列表（别名 + 活跃标识）
- 账号详情：别名 / App ID / App Secret / App Token（显示隐藏切换）
- 增删改查、设为活跃、测试连接

#### Tab5 · 接入配置

- 左侧选择写入目标系统，右侧动态配置表单
- 「测试连接」连通性校验
- 「保存配置」写入 localStorage（`{ adapterId, configs: { 目标id: 参数 } }`，各目标参数彼此隔离、互不覆盖，旧版单配置结构自动迁移）并广播 `integration-changed` 事件，Tab1 实时生效

### 3.4 适配器契约

每个适配器导出以下结构（见 `src/lib/adapters/types.js`）：

```js
{
  id: 'webhook',
  name: '通用 Webhook',
  desc: '...',
  fields: [{ key, label, placeholder, type, hint }],  // 配置表单字段定义
  write(record, config): Promise<{ ok, message }>,    // 写入一条候选人记录
  test(config): Promise<{ ok, message }>,             // 连通性测试
}
```

已注册适配器：

| id | 名称 | 说明 |
|---|---|---|
| `supabase` | Supabase 云端 | 默认目标，中→英列名映射（`name/age/store/position/phone`） |
| `feishu` | 飞书多维表格 | Open API，需 App ID / Secret / Token |
| `webhook` | 通用 Webhook | 适配钉钉、企微、群机器人、自建 API |
| `local` | 本地文件 | 导出 CSV / JSON |

新增目标系统只需实现上述契约并注册到 `src/lib/adapters/index.js`，约 40 行。

### 3.5 目录结构

```
src/
├── App.jsx                 # 登录 / 游客 / 管理员三态路由，页签容器
├── components/
│   ├── Tab1.jsx            # 信息识别
│   ├── Tab2.jsx            # SAP代码管理
│   ├── Tab3.jsx            # 图片库
│   ├── Tab4.jsx            # 登录账号
│   └── Tab5.jsx            # 接入配置
├── lib/
│   ├── supabase.js         # Supabase 客户端
│   ├── adapters/           # 写入适配器（types/supabase/feishu/http/webhook/local/index）
│   └── ...
├── utils/
│   ├── parseText.jsx       # 解析层纯函数（parseText / lookupSapByStore / generateSampleText）
│   └── generateImages.jsx  # 示例图片生成
├── data/
│   └── sapConfig.js        # SAP 岗位代码库
└── index.css               # 全局样式（Tailwind 指令 + 主题变量）
```

---

## 4. 桌面版（Tkinter）

- 单文件实现：`desktop/求职者信息录入.py`（2469 行）
- 两个类：`LoginWindow`（登录）、`App`（主应用，继承 `tk.Tk`）
- **写入路由**：按 `数据/integration_config.json` 的 `target` 分发到
  `_do_write_feishu` / `_write_via_webhook` / `_write_to_csv`
- **DATA_DIR 回退**：优先读桌面 `数据/` 目录，找不到则回退到脚本同级 `数据/`，
  开源副本克隆后即可直接运行
- 凭证管理：密钥走环境变量或占位符，`.gitignore` 排除运行时凭证文件

---

## 5. 数据与安全

| 项 | 措施 |
|---|---|
| 飞书 App Secret | 环境变量 / 占位符，`.example.json` 仅留假值 |
| Supabase `service_role` | 环境变量注入，不入库 |
| 密钥扫描 | `scripts/secret_scan.py` 接入 CI，全量扫描并阻断 |
| 运行时凭证 | `.gitignore` 排除 `feishu_accounts.json` 等 3 类文件 |
| 云端数据 | `candidates` / `sap_codes` / `images` / `feishu_accounts` 已清空历史数据 |

---

## 6. 工程化

### 6.1 CI（`.github/workflows/ci.yml`）

三道门禁，全部通过才合并：

1. `npm ci` + `npm run build` —— 构建校验
2. Python AST 解析 —— 桌面版语法校验
3. `scripts/secret_scan.py` —— 密钥泄漏扫描

此外代码规范与单元测试同样纳入门禁：`npm run lint`（ESLint）、`npm run format:check`（Prettier）、`npm test`（Vitest）均在 CI 中执行，任一失败即阻断合并。

### 6.2 自动部署

| 平台 | 工作流 | 触发 |
|---|---|---|
| GitHub Pages | `deploy-pages.yml` | push `main` |
| Vercel | `deploy-vercel.yml` | push `main`（需 `VERCEL_TOKEN` secret） |

两个入口部署**同一构建产物**，互为兜底。

### 6.3 本地开发

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 生产构建
npm run lint     # ESLint 规范检查
npm run test     # Vitest 单元测试
npm run format   # Prettier 格式化
```

桌面版：

```bash
cd desktop
python 求职者信息录入.py
```

---

## 7. 许可

MIT
