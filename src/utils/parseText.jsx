// 姓名：第一个非空、且不像联系方式 / 界面文案 / 字段值的行
//
// 三重防线（缺一不可）：
//   1. 结构 —— 跳过「标签行」及其下一行的字段值（手机号块 / 微信号块 / 年龄块 / 沟通职位块）。
//      不完整记录（只粘了手机号块、或只剩年龄块）里，值所在行必须整体排除。
//   2. 内容 —— 排除联系方式样式：纯数字、带横杠数字、wx 开头的微信号。
//   3. 文案 —— 排除界面关键词行，兼容全角/半角冒号，以及「年龄：」与「年龄：25 岁」两种形态。
//
// 不能只靠「位置」判断 —— 用户粘贴的记录可能不完整（例如只有手机号块），
// 此时手机号所在行会被误当成姓名写入数据库。
const PHONE_LIKE = /^[\d\s\-()（）+]{6,}$/
const WECHAT_LIKE = /^(wx[a-zA-Z0-9_-]{4,}|[a-zA-Z][a-zA-Z0-9_-]{4,}_[a-zA-Z0-9_-]{2,})$/
const UI_TEXT = new Set(['复制手机号', '复制微信号', '年龄', '沟通职位', '手机号', '微信号'])
// 界面关键词行：既可能是「年龄：」这种纯标签行，也可能是「年龄：25 岁」这种带值行
const UI_KEYWORD = /^(复制手机号|复制微信号|年龄|沟通职位|手机号|微信号)\s*[：:]/
// 结构标签：这些行后面跟的是字段值，不是姓名
const LABEL_LINE = /(的?手机号|的?微信号|年龄|沟通职位)\s*[：:]/
// 一行到底的写法「李小明的手机号：」，冒号前的部分是姓名
const NAME_IN_LABEL = /^(.{2,20}?)的(?:手机号|微信号)\s*[：:]/
// 以下形态都不可能是姓名
const AGE_VALUE = /^\d{1,3}\s*岁$/
const PAREN_VALUE = /[（(][^）)]*[）)]/
// 联系方式块：「X的手机号：」标签行，冒号后可能带值（一行到底），也可能值在下一行
const CONTACT_BLOCK = /^(.{0,20}?)的(手机号|微信号)\s*[：:]\s*(.*)$/

function looksLikeContact(line) {
  if (PHONE_LIKE.test(line)) return true
  if (/^wx/i.test(line) || WECHAT_LIKE.test(line)) return true
  if (/^\d+$/.test(line)) return true
  return false
}

// 是否属于界面文案行（而非候选人姓名）
function isUILine(line) {
  if (UI_TEXT.has(line)) return true
  if (UI_KEYWORD.test(line)) return true
  return false
}

// 是否属于字段值行（而非候选人姓名）
function isValueLine(line) {
  if (AGE_VALUE.test(line)) return true
  if (PAREN_VALUE.test(line)) return true
  return false
}

export function parseText(text) {
  if (!text || !String(text).trim()) return null
  // 统一换行：Windows 剪贴板常带 \r\n，若不归一化，\r 会污染各字段的值
  const raw = String(text).replace(/\r\n?/g, '\n')
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const data = {}

  // 手机号 / 微信号：按块解析。
  // 块的组成是「标签行 [值行] [复制行]」，其中值行和复制行都可能缺失 ——
  // 不能固定跳 3 行（会吞掉下一个块），也不能把「复制手机号」当字段值。
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const block = line.match(CONTACT_BLOCK)
    if (block) {
      let value = block[3].trim()
      let j = i + 1
      if (!value && j < lines.length) {
        const next = lines[j]
        const isCopyLine = next === '复制手机号' || next === '复制微信号'
        const isLabelLine = LABEL_LINE.test(next) || UI_TEXT.has(next)
        if (!isCopyLine && !isLabelLine) {
          value = next
          j++
        }
      }
      // 值行之后若紧跟「复制手机号 / 复制微信号」，一并跳过
      if (j < lines.length && (lines[j] === '复制手机号' || lines[j] === '复制微信号')) j++
      if (value) data[block[2] === '手机号' ? '_phone_block' : '_wechat_block'] = value
      i = j
    } else {
      i++
    }
  }

  // 联系方式合并
  const contactParts = []
  if (data._phone_block) contactParts.push(`手机号${data._phone_block}`)
  if (data._wechat_block) contactParts.push(`微信号${data._wechat_block}`)
  if (contactParts.length) data['联系方式'] = contactParts.join('/')

  // 年龄：优先取「年龄：」标签上下文，避免误抓正文中无关的「N 岁」
  const ageMatch = raw.match(/年龄\s*[：:]\s*(\d{1,3})\s*岁/) || raw.match(/(\d{1,3})\s*岁/)
  if (ageMatch) data['年龄'] = ageMatch[1]

  // 姓名：先按「结构」定位，再按「内容」复核。
  //
  // 结构定位：标记所有字段值行 —— 标签行本身、以及标签行后紧跟的值行
  // （手机号块的值、微信号块的值、年龄的值、沟通职位的值）。
  // 这样即使是残缺记录，值行也不会被当成姓名。
  const valueLines = new Set()
  for (let k = 0; k < lines.length; k++) {
    const line = lines[k]
    if (LABEL_LINE.test(line)) {
      valueLines.add(k)
      // 标签行后跟的值行也要排除（「年龄：」下一行的「25 岁」、
      // 「沟通职位：」下一行的「拣货员（广州正佳广场门店）」）
      const afterColon = line.slice(line.search(/[：:]/))
      const hasInlineValue = afterColon.replace(/^[：:]\s*/, '').length > 0
      if (!hasInlineValue && k + 1 < lines.length) valueLines.add(k + 1)
      // 「李明的手机号：138…」这种一行到底的写法，冒号前是姓名
      const inlineName = line.match(NAME_IN_LABEL)
      if (inlineName) {
        data['姓名'] = inlineName[1].trim()
      }
    }
  }

  // 内容复核：逐行找第一个「既不是字段值、也不是联系方式/界面文案」的行
  if (!data['姓名']) {
    for (let k = 0; k < lines.length; k++) {
      const line = lines[k]
      if (!line) continue
      if (valueLines.has(k)) continue
      if (isUILine(line)) continue
      if (looksLikeContact(line)) continue
      if (isValueLine(line)) continue
      data['姓名'] = line
      break
    }
  }

  // 门店名称：从「沟通职位」字段提取（全角/半角括号都支持）
  const storeMatch = raw.match(/沟通职位\s*[：:]\s*(.+?)(?=\n|$)/)
  if (storeMatch) {
    const jobText = storeMatch[1].trim()
    const storeInParens = jobText.match(/[（(]([^（）()]+)[）)]/)
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

// 根据门店名称查 SAP 代码。
// 兼容两种维护口径（都做精确匹配，避免「广州」误配「广州正佳广场门店」）：
//   1. 岗位名称括号里的门店 —— 如「拣货员（广州正佳广场门店）」，桌面版与示例数据的主要写法
//   2. sap_codes.store_name 列 —— Tab2 表单维护的门店/城市字段，Web 版的独立列
export function lookupSapByStore(storeName, sapConfig) {
  if (!storeName) return ''
  for (const [pos, cfg] of Object.entries(sapConfig)) {
    const sap = typeof cfg === 'string' ? cfg : cfg?.sap
    if (!sap) continue
    const storeInParens = pos.match(/[（(]([^（）()]+)[）)]/)
    if (storeInParens && storeInParens[1] === storeName) return sap
    if (typeof cfg === 'object' && cfg.city === storeName) return sap
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
