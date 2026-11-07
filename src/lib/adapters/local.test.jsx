// 本地导出适配器单元测试：CSV 转义与格式生成
//
// CSV 转义是数据完整性关键 —— 门店名里带逗号或引号时若不转义，
// 会把一行拆成多列，导出的表在 Excel 里直接错位。
import { describe, it, expect } from 'vitest'
import { toCSV } from './local'

describe('toCSV', () => {
  it('表头为全部标准字段', () => {
    const csv = toCSV([])
    expect(csv.split('\n')[0]).toBe('姓名,年龄,性别,联系方式,SAP代码,意向岗位,门店名称')
  })

  it('单条记录输出表头 + 一行数据', () => {
    const csv = toCSV([{ 姓名: '张明轩', 门店名称: '广州正佳店' }])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toBe('张明轩,,,,,,广州正佳店')
  })

  it('缺省字段输出空串占位，保持列数对齐', () => {
    const csv = toCSV([{ 姓名: '李思远' }])
    expect(csv.split('\n')[1].split(',')).toHaveLength(7)
  })

  it('字段含逗号时加引号包裹', () => {
    const csv = toCSV([{ 姓名: '王,小雨' }])
    expect(csv.split('\n')[1]).toBe('"王,小雨",,,,,,')
  })

  it('字段含双引号时转义为两个双引号', () => {
    const csv = toCSV([{ 姓名: '张"明轩' }])
    expect(csv.split('\n')[1]).toBe('"张""明轩",,,,,,')
  })

  it('字段含换行时加引号包裹', () => {
    const csv = toCSV([{ 姓名: '张\n明轩' }])
    expect(csv).toContain('"张\n明轩"')
  })

  it('null / undefined 转为空串而不是字面量', () => {
    const csv = toCSV([{ 姓名: null, 年龄: undefined }])
    expect(csv.split('\n')[1]).toBe(',,,,,,')
    expect(csv).not.toContain('null')
    expect(csv).not.toContain('undefined')
  })

  it('多行记录按行输出，列数一致', () => {
    const csv = toCSV([
      { 姓名: '甲', 门店名称: '店A' },
      { 姓名: '乙', 门店名称: '店B' },
    ])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[1].split(',')).toHaveLength(7)
    expect(lines[2].split(',')).toHaveLength(7)
  })
})
