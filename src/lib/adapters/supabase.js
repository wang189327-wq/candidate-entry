// Supabase 云端数据库适配器（原「录入云端」行为，保持完全兼容）
import { sb } from '../supabase'
import { recordToObject } from './types'

// candidates 表的列名是英文，需把标准记录的中文字段映射过去。
// 注意：该表没有 gender / sap_code 列，对应字段直接丢弃（与改造前行为一致）。
const COLUMN_MAP = {
  姓名: 'name',
  年龄: 'age',
  门店名称: 'store',
  意向岗位: 'position',
  联系方式: 'phone',
}

function toRow(record) {
  const obj = recordToObject(record)
  const row = {}
  Object.keys(obj).forEach(k => {
    const col = COLUMN_MAP[k]
    if (col) row[col] = obj[k]
  })
  return row
}

export const supabaseAdapter = {
  id: 'supabase',
  name: 'Supabase 云端数据库',
  desc: '写入本项目自带的 candidates 云端表，多设备共享同一份候选人名单。',
  fields: [],

  async write(record, config) {
    const { error } = await sb.from('candidates').insert({
      ...toRow(record),
      status: '待跟进',
      entry_date: new Date().toLocaleDateString('zh-CN'),
    })
    if (error) return { ok: false, message: '写入失败：' + error.message }
    return { ok: true, message: '已写入云端 candidates 表' }
  },

  async test(config) {
    const { error, count } = await sb.from('candidates').select('*', { count: 'exact', head: true })
    if (error) return { ok: false, message: '连接失败：' + error.message }
    return { ok: true, message: `连接正常，云端现有 ${count ?? 0} 条记录` }
  },
}
