// Webhook 适配器：把候选人信息 POST 到任意 HTTP 接口
// 支持四种报文形态，覆盖市面上绝大多数「群机器人」与自建录入接口：
//   generic —— 直接 POST 标准字段 JSON（自建 API / 中台 / 数据库网关）
//   feishu  —— 飞书群机器人（自定义机器人 Webhook）
//   dingtalk—— 钉钉群机器人
//   wecom   —— 企业微信群机器人
import { postJson } from './http'
import { recordToText, recordToObject } from './types'

const MODES = [
  { id: 'generic', label: '通用 JSON（自建接口）' },
  { id: 'feishu', label: '飞书群机器人' },
  { id: 'dingtalk', label: '钉钉群机器人' },
  { id: 'wecom', label: '企业微信群机器人' },
]

function buildBody(mode, record) {
  const text = recordToText(record)
  switch (mode) {
    case 'feishu':
      return { msg_type: 'text', content: { text: `【新人登记】${text}` } }
    case 'dingtalk':
      return { msgtype: 'text', text: { content: `【新人登记】${text}` } }
    case 'wecom':
      return { msgtype: 'text', text: { content: `【新人登记】${text}` } }
    default:
      return { ...recordToObject(record), source: 'candidate-entry', submitted_at: new Date().toISOString() }
  }
}

export const webhookAdapter = {
  id: 'webhook',
  name: 'Webhook（任意系统）',
  desc: '把识别结果 POST 到任意 HTTP 接口：自建 API、中台、或飞书/钉钉/企业微信群机器人。',
  fields: [
    { key: 'mode', label: '报文格式', type: 'select', options: MODES, default: 'generic' },
    { key: 'url', label: '接口地址', type: 'text', placeholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxxx' },
    {
      key: 'proxy',
      label: '代理前缀（可选）',
      type: 'text',
      placeholder: 'https://your-proxy.com/api/relay?to=',
      hint: '目标接口不返回 CORS 头时，可填写自己的转发地址',
    },
  ],

  async write(record, config) {
    if (!config.url) return { ok: false, message: '请先填写接口地址' }
    const res = await postJson(config.url, buildBody(config.mode || 'generic', record), { proxy: config.proxy })
    if (!res.ok) return { ok: false, message: `写入失败：${res.error || 'HTTP ' + res.status}` }
    if (res.opaque) return { ok: true, message: '已发送（跨域无响应校验，建议在目标系统确认接收）' }
    const msg = res.data?.msg || res.data?.errmsg || res.data?.message || ''
    const code = res.data?.code ?? res.data?.errcode
    if (code !== undefined && code !== 0) return { ok: false, message: `目标系统返回错误：${code} ${msg}` }
    return { ok: true, message: msg ? `已发送：${msg}` : '已发送' }
  },

  async test(config) {
    if (!config.url) return { ok: false, message: '请先填写接口地址' }
    const res = await postJson(
      config.url,
      buildBody(config.mode || 'generic', { 姓名: '测试', 意向岗位: '连通性测试' }),
      { proxy: config.proxy }
    )
    if (!res.ok) return { ok: false, message: `连接失败：${res.error || 'HTTP ' + res.status}` }
    if (res.opaque) return { ok: true, message: '请求已送达（跨域无响应校验）' }
    const msg = res.data?.msg || res.data?.errmsg || res.data?.message || ''
    return { ok: true, message: msg ? `连接正常：${msg}` : '连接正常' }
  },
}
