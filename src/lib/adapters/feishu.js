// 飞书多维表格适配器（直连 open.feishu.cn，与桌面版同一套接口）
// 浏览器直连飞书开放平台可能受 CORS 限制，失败时会给出明确提示，
// 建议：桌面版使用，或改用「Webhook → 飞书群机器人」方案。
import { postJson } from './http'

const API_BASE = 'https://open.feishu.cn/open-apis'

async function getTenantToken(appId, appSecret) {
  const res = await postJson(`${API_BASE}/auth/v3/tenant_access_token/internal`, { app_id: appId, app_secret: appSecret })
  if (!res.ok) return { ok: false, message: res.error || `HTTP ${res.status}` }
  if (res.data?.code !== 0) return { ok: false, message: res.data?.msg || '获取 tenant_access_token 失败' }
  return { ok: true, token: res.data.tenant_access_token }
}

export const feishuAdapter = {
  id: 'feishu',
  name: '飞书多维表格',
  desc: '写入飞书多维表格（与桌面版同一套 Open API）。浏览器直连可能受跨域限制。',
  fields: [
    { key: 'app_id', label: 'App ID', type: 'text', placeholder: 'cli_xxxxxxxxxxxxxxxx' },
    { key: 'app_secret', label: 'App Secret', type: 'password' },
    { key: 'app_token', label: '多维表格 app_token', type: 'text', placeholder: 'Fuxxxxxxxxxxxxxxxxxx' },
    { key: 'table_id', label: '数据表 table_id', type: 'text', placeholder: 'tblxxxxxxxxxxxxxx' },
  ],

  async write(record, config) {
    const { app_id, app_secret, app_token, table_id } = config
    if (!app_id || !app_secret || !app_token || !table_id) {
      return { ok: false, message: '请完整填写 App ID / Secret / app_token / table_id' }
    }
    const auth = await getTenantToken(app_id, app_secret)
    if (!auth.ok) return { ok: false, message: '认证失败：' + auth.message }

    const url = `${API_BASE}/bitable/v1/apps/${app_token}/tables/${table_id}/records`
    const res = await postJson(url, {
      fields: {
        姓名: record['姓名'],
        年龄: record['年龄'],
        联系方式: record['联系方式'],
        SAP代码: record['SAP代码'],
        性别: record['性别'],
        意向岗位: record['意向岗位'],
        ...(record['门店名称'] ? { 门店名称: record['门店名称'] } : {}),
      },
    })
    if (!res.ok) return { ok: false, message: `写入失败：${res.error || 'HTTP ' + res.status}` }
    if (res.opaque) {
      return { ok: true, message: '已提交（跨域限制，无法读取飞书返回码，建议在多维表格中确认）' }
    }
    if (res.data?.code !== 0) return { ok: false, message: `飞书返回错误：${res.data?.msg}` }
    return { ok: true, message: '已写入飞书多维表格' }
  },

  async test(config) {
    const { app_id, app_secret } = config
    if (!app_id || !app_secret) return { ok: false, message: '请先填写 App ID 与 App Secret' }
    const auth = await getTenantToken(app_id, app_secret)
    if (!auth.ok) return { ok: false, message: '认证失败：' + auth.message }
    return { ok: true, message: '飞书认证通过，凭证有效' }
  },
}
