// 适配器层单元测试：标准记录 ↔ 目标系统载荷
//
// 重点验证「写入目标可插拔」的契约是否稳定：
//   1. recordToObject 只输出业务字段，不泄漏内部临时键
//   2. recordToText 的展示格式对所有适配器一致
//   3. 适配器注册表完整且字段元信息齐备
import { describe, it, expect } from 'vitest'
import { RECORD_FIELDS, recordToText, recordToObject } from './types'
import { ADAPTERS, DEFAULT_ADAPTER_ID, getAdapter } from './index'

const RECORD = {
  姓名: '张明轩',
  年龄: '25',
  性别: '女',
  联系方式: '手机号138-0011-2233/微信号wxid_zmx2024',
  SAP代码: 'SAP001',
  意向岗位: '企划实习生',
  门店名称: '广州正佳店',
}

describe('RECORD_FIELDS', () => {
  it('包含全部 7 个标准字段', () => {
    expect(RECORD_FIELDS).toHaveLength(7)
    expect(RECORD_FIELDS).toEqual([
      '姓名',
      '年龄',
      '性别',
      '联系方式',
      'SAP代码',
      '意向岗位',
      '门店名称',
    ])
  })
})

describe('recordToObject', () => {
  it('完整记录原样输出', () => {
    expect(recordToObject(RECORD)).toEqual(RECORD)
  })

  it('剔除空串字段', () => {
    const r = recordToObject({ ...RECORD, 年龄: '', 性别: null, SAP代码: undefined })
    expect('年龄' in r).toBe(false)
    expect('性别' in r).toBe(false)
    expect('SAP代码' in r).toBe(false)
    expect(r['姓名']).toBe('张明轩')
  })

  it('保留 0（数字零是有效值，不应被当空值剔除）', () => {
    expect(recordToObject({ 年龄: 0 })).toEqual({ 年龄: 0 })
  })

  it('空记录返回空对象', () => {
    expect(recordToObject({})).toEqual({})
  })
})

describe('recordToText', () => {
  it('按标准字段顺序拼接', () => {
    const t = recordToText(RECORD)
    expect(t).toBe(
      '姓名：张明轩｜年龄：25｜性别：女｜联系方式：手机号138-0011-2233/微信号wxid_zmx2024｜SAP代码：SAP001｜意向岗位：企划实习生｜门店名称：广州正佳店'
    )
  })

  it('跳过空字段', () => {
    const t = recordToText({ 姓名: '张明轩', 年龄: '', 门店名称: '广州正佳店' })
    expect(t).toBe('姓名：张明轩｜门店名称：广州正佳店')
  })

  it('全空记录返回空串', () => {
    expect(recordToText({})).toBe('')
  })

  it('支持自定义分隔符', () => {
    expect(recordToText({ 姓名: 'A', 年龄: '1' }, ',')).toBe('姓名：A,年龄：1')
  })
})

describe('适配器注册表', () => {
  it('至少注册 4 个目标系统', () => {
    expect(ADAPTERS.length).toBeGreaterThanOrEqual(4)
  })

  it('每个适配器都实现完整契约', () => {
    for (const a of ADAPTERS) {
      expect(a.id, `${a.name} 缺少 id`).toBeTruthy()
      expect(a.name, `${a.id} 缺少 name`).toBeTruthy()
      expect(typeof a.write, `${a.id} 缺少 write()`).toBe('function')
      expect(typeof a.test, `${a.id} 缺少 test()`).toBe('function')
      expect(Array.isArray(a.fields), `${a.id} 的 fields 必须是数组`).toBe(true)
    }
  })

  it('适配器 id 唯一', () => {
    const ids = ADAPTERS.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('默认目标是 supabase 且存在于注册表中', () => {
    expect(DEFAULT_ADAPTER_ID).toBe('supabase')
    expect(ADAPTERS.some(a => a.id === DEFAULT_ADAPTER_ID)).toBe(true)
  })

  it('包含预期的四种写入目标', () => {
    const ids = ADAPTERS.map(a => a.id)
    expect(ids).toContain('supabase')
    expect(ids).toContain('feishu')
    expect(ids).toContain('webhook')
    expect(ids).toContain('local')
  })

  it('配置表单字段结构合法', () => {
    for (const a of ADAPTERS) {
      for (const f of a.fields) {
        expect(f.key, `${a.id} 的字段缺少 key`).toBeTruthy()
        expect(f.label, `${a.id}.${f.key} 缺少 label`).toBeTruthy()
      }
    }
  })
})

describe('getAdapter', () => {
  it('按 id 取到适配器', () => {
    expect(getAdapter('local').id).toBe('local')
    expect(getAdapter('webhook').id).toBe('webhook')
  })

  it('未知 id 回退到默认适配器', () => {
    expect(getAdapter('not-exist').id).toBe(DEFAULT_ADAPTER_ID)
    expect(getAdapter(undefined).id).toBe(DEFAULT_ADAPTER_ID)
  })
})
