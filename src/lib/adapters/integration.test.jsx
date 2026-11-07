// 接入配置存取单元测试：写入目标参数按适配器隔离
//
// 覆盖三类风险：
//   1. 保存 A 目标的参数不会覆盖 B 目标（旧版单配置结构的「串味」缺陷）
//   2. 切换目标再切回，参数仍在
//   3. 旧版存储结构 { adapterId, config } 能平滑迁移
import { describe, it, expect, beforeEach } from 'vitest'

// node 环境没有 localStorage，用等价的内存实现替代
class LocalStorageStub {
  constructor() {
    this.map = new Map()
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null
  }
  setItem(k, v) {
    this.map.set(k, String(v))
  }
  removeItem(k) {
    this.map.delete(k)
  }
  clear() {
    this.map.clear()
  }
}

const storage = new LocalStorageStub()
globalThis.localStorage = storage

const { loadIntegration, saveIntegration, DEFAULT_ADAPTER_ID } = await import('./index')

// 直接读取存储中某个适配器的参数（不改变当前生效目标）
function storedConfigOf(adapterId) {
  const raw = JSON.parse(storage.getItem('integration_config'))
  return raw.configs?.[adapterId]
}

// 只切换「当前生效目标」，不动各目标已保存的参数
function switchTo(adapterId) {
  const raw = JSON.parse(storage.getItem('integration_config'))
  raw.adapterId = adapterId
  storage.setItem('integration_config', JSON.stringify(raw))
}

beforeEach(() => {
  storage.clear()
})

describe('接入配置按目标隔离', () => {
  it('未保存过时返回默认目标与空配置', () => {
    const r = loadIntegration()
    expect(r.adapterId).toBe(DEFAULT_ADAPTER_ID)
    expect(r.config).toEqual({})
  })

  it('保存 B 目标参数不会覆盖 A 目标已保存的参数', () => {
    saveIntegration('feishu', { app_id: 'cli_x', app_secret: 's1' })
    saveIntegration('webhook', { url: 'https://example.com/hook' })

    // feishu 的参数原封不动
    expect(storedConfigOf('feishu')).toEqual({ app_id: 'cli_x', app_secret: 's1' })
    expect(storedConfigOf('webhook')).toEqual({ url: 'https://example.com/hook' })
  })

  it('切换目标再切回，原参数仍在', () => {
    saveIntegration('webhook', { url: 'https://a.example.com' })
    saveIntegration('local', { format: 'csv' })
    switchTo('webhook')

    const cur = loadIntegration()
    expect(cur.adapterId).toBe('webhook')
    expect(cur.config).toEqual({ url: 'https://a.example.com' })
  })

  it('损坏的 JSON 回退到默认配置', () => {
    storage.setItem('integration_config', '{not json')
    const r = loadIntegration()
    expect(r.adapterId).toBe(DEFAULT_ADAPTER_ID)
    expect(r.config).toEqual({})
  })

  it('旧版单配置结构 { adapterId, config } 平滑迁移', () => {
    storage.setItem(
      'integration_config',
      JSON.stringify({ adapterId: 'feishu', config: { app_id: 'cli_old', app_secret: 's' } })
    )
    const r = loadIntegration()
    expect(r.adapterId).toBe('feishu')
    expect(r.config).toEqual({ app_id: 'cli_old', app_secret: 's' })
  })

  it('未知的 adapterId 回退到默认目标', () => {
    storage.setItem('integration_config', JSON.stringify({ adapterId: 'nope', configs: {} }))
    expect(loadIntegration().adapterId).toBe(DEFAULT_ADAPTER_ID)
  })
})

describe('writeCandidate 路由到当前目标', () => {
  it('路由到所选适配器并把参数传给它', async () => {
    saveIntegration('webhook', { url: 'https://a.example.com' })
    const { writeCandidate } = await import('./index')
    const res = await writeCandidate({ 姓名: '张三', 性别: '', 年龄: '' })
    // 测试环境无真实网络，webhook 适配器会失败 —— 但失败也应带上正确的适配器标识
    expect(res.adapterId).toBe('webhook')
    expect(res.ok).toBe(false)
  })
})
