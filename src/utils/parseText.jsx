// 姓名：第一个非空、且不像联系方式 / 界面文案的行
//
// 注意：不能靠「位置」判断 —— 用户粘贴的记录可能不完整（例如只有手机号块），
// 此时手机号所在行会被误当成姓名写入数据库。因此这里按内容特征排除。
const PHONE_LIKE = /^[\d\s\-()（）+]{6,}$/
const WECHAT_LIKE = /^(wx[a-zA-Z0-9_-]{4,}|[a-zA-Z][a-zA-Z0-9_-]{4,}_[a-zA-Z0-9_-]{2,})$/
const UI_TEXT = new Set(['复制手机号', '复制微信号', '年龄', '沟通职位', '手机号', '微信号'])

function looksLikeContact(line) {
  if (PHONE_LIKE.test(line)) return true
  if (/^wx/i.test(line) || WECHAT_LIKE.test(line)) return true
  return false
}

export function parseText(text) {
  if (!text || !String(text).trim()) return null
  const lines = String(text)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const data = {}
  // 手机号 / 微信号：按3行块解析
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.includes('的手机号：')) {
      if (i + 1 < lines.length) data._phone_block = lines[i + 1]
      i += 3
    } else if (line.includes('的微信号：')) {
      if (i + 1 < lines.length) data._wechat_block = lines[i + 1]
      i += 3
    } else {
      i++
    }
  }

  // 联系方式合并
  const contactParts = []
  if (data._phone_block) contactParts.push(`手机号${data._phone_block}`)
  if (data._wechat_block) contactParts.push(`微信号${data._wechat_block}`)
  if (contactParts.length) data['联系方式'] = contactParts.join('/')

  // 年龄
  const ageMatch = String(text).match(/(\d{1,3})\s*岁/)
  if (ageMatch) data['年龄'] = ageMatch[1]

  // 姓名：第一个非空、且不像联系方式 / 界面文案的行
  for (const line of lines) {
    if (
      line &&
      !line.includes('的手机号：') &&
      !line.includes('的微信号：') &&
      !UI_TEXT.has(line) &&
      !looksLikeContact(line)
    ) {
      data['姓名'] = line
      break
    }
  }

  // 门店名称：从「沟通职位」字段提取
  const storeMatch = String(text).match(/沟通职位[：:]\s*(.+?)(?=\n|$)/)
  if (storeMatch) {
    const jobText = storeMatch[1].trim()
    const storeInParens = jobText.match(/（([^）]+)）/)
    if (storeInParens) data['门店名称'] = storeInParens[1]
  }

  // 仅返回标准业务字段 —— 内部临时块（_phone_block / _wechat_block）
  // 若随记录外流，会污染导出的 JSON 与 Webhook payload。
  const result = {}
  for (const key of Object.keys(data)) {
    if (!key.startsWith('_')) result[key] = data[key]
  }

  return Object.keys(result).length > 0 ? result : null
}

// 根据门店名称查 SAP 代码
export function lookupSapByStore(storeName, sapConfig) {
  if (!storeName) return ''
  for (const [pos, cfg] of Object.entries(sapConfig)) {
    const storeInParens = pos.match(/（([^）]+)）/)
    if (storeInParens && storeInParens[1] === storeName) {
      return typeof cfg === 'string' ? cfg : cfg.sap
    }
  }
  return ''
}

// 示例候选人（用于 Demo「填充示例」按钮）
export const SAMPLE_CANDIDATE = {
  name: '李小明',
  phone: '13800000000',
  wechat: 'lxm_demo000',
  age: '25 岁',
  position: '拣货员',
  store: '广州正佳广场门店',
}

// 生成示例聊天记录（用于 Demo）
// 结构与真实粘贴文本一致：首行是候选人姓名，随后是「X的手机号：/ 值 / 复制手机号」三行块，
// 最后「沟通职位：」后跟「岗位（门店）」，门店由括号内文本解析得出。
export function generateSampleText(overrides = {}) {
  const { name, phone, wechat, age, position, store } = { ...SAMPLE_CANDIDATE, ...overrides }
  return `${name}\n的手机号：\n${phone}\n复制手机号\n的微信号：\n${wechat}\n复制微信号\n年龄：\n${age}\n沟通职位：\n${position}（${store}）`
}
