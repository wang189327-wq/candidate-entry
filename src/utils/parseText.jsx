// 解析粘贴的聊天记录文本
export function parseText(text) {
  if (!text.trim()) return null
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

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
  const ageMatch = text.match(/(\d{1,3})\s*岁/)
  if (ageMatch) data['年龄'] = ageMatch[1]

  // 姓名：第一个非空且不含关键词的行
  for (const line of lines) {
    if (
      line &&
      !line.includes('的手机号：') &&
      !line.includes('的微信号：') &&
      line !== '复制手机号' &&
      line !== '复制微信号'
    ) {
      data['姓名'] = line
      break
    }
  }

  // 门店名称：从「沟通职位」字段提取
  const storeMatch = text.match(/沟通职位[：:]\s*(.+?)(?=\n|$)/)
  if (storeMatch) {
    const jobText = storeMatch[1].trim()
    const storeInParens = jobText.match(/（([^）]+)）/)
    if (storeInParens) data['门店名称'] = storeInParens[1]
  }

  return Object.keys(data).length > 0 ? data : null
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

// 生成示例聊天记录（用于 Demo）
export function generateSampleText(storeName) {
  return `${storeName}\n的手机号：\n138-0011-2233\n复制手机号\n的微信号：\nwxid_demo001\n复制微信号\n年龄：\n25 岁\n沟通职位：\n企划实习生（${storeName}）`
}