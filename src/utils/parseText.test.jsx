// 解析层单元测试：聊天记录文本 → 标准记录
//
// 覆盖三类风险：
//   1. 正则误命中（如年龄被手机号数字干扰）
//   2. 边界输入（空文本、纯空白、缺字段）
//   3. 中文全角/半角标点混用
import { describe, it, expect } from 'vitest'
import { parseText, lookupSapByStore, generateSampleText } from './parseText'

// 真实聊天记录结构：BOSS 直聘导出的对话文本
const REAL_CHAT = `张明轩
的手机号：
138-0011-2233
复制手机号
的微信号：
wxid_zmx2024
复制微信号
年龄：
25 岁
沟通职位：
企划实习生（广州正佳店）`

describe('parseText', () => {
  it('解析完整聊天记录的全部字段', () => {
    const r = parseText(REAL_CHAT)
    expect(r).not.toBeNull()
    expect(r['姓名']).toBe('张明轩')
    expect(r['联系方式']).toBe('手机号138-0011-2233/微信号wxid_zmx2024')
    expect(r['年龄']).toBe('25')
    expect(r['门店名称']).toBe('广州正佳店')
  })

  it('空文本返回 null', () => {
    expect(parseText('')).toBeNull()
  })

  it('纯空白文本返回 null', () => {
    expect(parseText('   \n\t  \n  ')).toBeNull()
  })

  it('null / undefined 输入不抛异常', () => {
    expect(parseText(null)).toBeNull()
    expect(parseText(undefined)).toBeNull()
  })

  it('只有空白字符的字符串不会被当作有效记录', () => {
    expect(parseText('\n\n\n')).toBeNull()
  })

  it('仅有手机号、没有姓名时仍能解析出联系方式', () => {
    const r = parseText(`的手机号：
138-0011-2233
复制手机号`)
    expect(r['联系方式']).toBe('手机号138-0011-2233')
    // 首行是「的手机号：」，属于关键词行，不应被当作姓名
    expect(r['姓名']).toBeUndefined()
  })

  it('「复制手机号」「复制微信号」不被识别为姓名', () => {
    const r = parseText(`李思远
的手机号：
138-0011-2233
复制手机号
的微信号：
wxid_lsy001
复制微信号`)
    expect(r['姓名']).toBe('李思远')
  })

  it('同时存在手机号与微信号时用 / 连接', () => {
    const r = parseText(REAL_CHAT)
    expect(r['联系方式']).toContain('/')
    expect(r['联系方式'].split('/')).toHaveLength(2)
  })

  it('只有微信号、没有手机号时联系方式不���前导斜杠', () => {
    const r = parseText(`王小雨
的微信号：
wxid_wxy002
复制微信号`)
    expect(r['联系方式']).toBe('微信号wxid_wxy002')
    expect(r['联系方式'].startsWith('/')).toBe(false)
  })

  it('年龄支持多种写法：25岁 / 25 岁 / 25　岁（全角空格）', () => {
    expect(parseText('陈可\n年龄：\n25岁')['年龄']).toBe('25')
    expect(parseText('陈可\n年龄：\n25 岁')['年龄']).toBe('25')
    expect(parseText('陈可\n年龄：\n25　岁')['年龄']).toBe('25')
  })

  it('三位数年龄也能解析', () => {
    expect(parseText('陈可\n年龄：\n118 岁')['年龄']).toBe('118')
  })

  it('没有年龄时年龄字段缺失而不是空串', () => {
    const r = parseText(`赵一鸣
的手机号：
138-0011-2233
复制手机号`)
    expect(r['年龄']).toBeUndefined()
  })

  it('门店名称从「沟通职位」的括号中提取', () => {
    const r = parseText(`孙悦
沟通职位：
设计实习生（深圳万象城店）`)
    expect(r['门店名称']).toBe('深圳万象城店')
  })

  it('沟通职位使用半角冒号也能解析', () => {
    const r = parseText(`孙悦
沟通职位:
设计实习生（深圳万象城店）`)
    expect(r['门店名称']).toBe('深圳万象城店')
  })

  it('沟通职位中无括号时不产生门店名称', () => {
    const r = parseText(`孙悦
沟通职位：
储备店长`)
    expect(r['门店名称']).toBeUndefined()
  })

  it('没有沟通职位时门店名称缺失', () => {
    const r = parseText(`周晓天
的手机号：
138-0011-2233
复制手机号`)
    expect(r['门店名称']).toBeUndefined()
  })

  it('多个关键词行时取第一个非关键词行为姓名', () => {
    const r = parseText(`吴桐
的手机号：
138-0011-2233
复制手机号`)
    expect(r['姓名']).toBe('吴桐')
  })

  it('前后多余空行不影响解析', () => {
    const r = parseText(`

${REAL_CHAT}

`)
    expect(r['姓名']).toBe('张明轩')
    expect(r['年龄']).toBe('25')
  })

  it('解析结果不含内部临时字段', () => {
    const r = parseText(REAL_CHAT)
    expect(r._phone_block).toBeUndefined()
    expect(r._wechat_block).toBeUndefined()
  })
})

describe('lookupSapByStore', () => {
  const sapConfig = {
    '企划实习生（广州）': { sap: 'SAP001', city: '广州', published: '是' },
    '设计实习生（深圳）': { sap: 'SAP002', city: '深圳', published: '是' },
    '费用实习生（成都）': 'SAP003',
  }

  it('按门店名称查得 SAP 代码', () => {
    expect(lookupSapByStore('广州', sapConfig)).toBe('SAP001')
    expect(lookupSapByStore('深圳', sapConfig)).toBe('SAP002')
  })

  it('配置值为字符串时也能取到 SAP 代码', () => {
    expect(lookupSapByStore('成都', sapConfig)).toBe('SAP003')
  })

  it('门店不存在时返回空串', () => {
    expect(lookupSapByStore('杭州', sapConfig)).toBe('')
  })

  it('门店名为空时返回空串', () => {
    expect(lookupSapByStore('', sapConfig)).toBe('')
    expect(lookupSapByStore(undefined, sapConfig)).toBe('')
  })

  it('空配置对象返回空串', () => {
    expect(lookupSapByStore('广州', {})).toBe('')
  })

  it('岗位名相同但城市不同时按城市区分', () => {
    const cfg = {
      '企划实习生（广州）': { sap: 'SAP001' },
      '企划实习生（深圳）': { sap: 'SAP002' },
    }
    expect(lookupSapByStore('广州', cfg)).toBe('SAP001')
    expect(lookupSapByStore('深圳', cfg)).toBe('SAP002')
  })
})

describe('generateSampleText', () => {
  it('生成的示例文本可被 parseText 正确解析', () => {
    const text = generateSampleText('广州正佳店')
    const r = parseText(text)
    expect(r['门店名称']).toBe('广州正佳店')
    expect(r['年龄']).toBe('25')
    expect(r['联系方式']).toContain('138-0011-2233')
  })

  it('示例文本包含指定门店名', () => {
    expect(generateSampleText('上海环球港店')).toContain('上海环球港店')
  })
})
