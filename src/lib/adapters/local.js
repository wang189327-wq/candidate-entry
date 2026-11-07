// 本地导出适配器：不需要任何第三方服务，直接下载 JSON / CSV 文件
// 适合个人使用或数据不允许出内网的场景
import { RECORD_FIELDS, recordToObject } from './types'

function toCSV(records) {
  const header = RECORD_FIELDS.join(',')
  const escape = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = records.map(r => RECORD_FIELDS.map(f => escape(recordToObject(r)[f])).join(','))
  return [header, ...rows].join('\n')
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const localAdapter = {
  id: 'local',
  name: '本地文件导出',
  desc: '把识别结果下载为 JSON / CSV，不需要任何第三方服务，适合数据不出内网的场景。',
  fields: [
    {
      key: 'format', label: '导出格式', type: 'select',
      options: [{ id: 'csv', label: 'CSV（Excel 可直接打开）' }, { id: 'json', label: 'JSON' }],
      default: 'csv',
    },
  ],

  async write(record, config) {
    const fmt = config.format || 'csv'
    const stamp = new Date().toISOString().slice(0, 10)
    if (fmt === 'json') {
      download(`候选人_${stamp}.json`, JSON.stringify(recordToObject(record), null, 2), 'application/json')
    } else {
      download(`候选人_${stamp}.csv`, '﻿' + toCSV([record]), 'text/csv;charset=utf-8')
    }
    return { ok: true, message: `已导出 ${fmt.toUpperCase()} 文件` }
  },

  async test(config) {
    return { ok: true, message: '本地导出无需连接，浏览器会直接下载文件' }
  },
}
