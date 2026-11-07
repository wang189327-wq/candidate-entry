// 跨域 POST 封装单元测试
//
// 用 mock fetch 覆盖三条分支：正常 JSON 响应、非 JSON 响应、CORS 拦截后的降级重试。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { postJson } from './http'

let fetchMock

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('postJson', () => {
  it('成功响应时返回解析后的 JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ code: 0, msg: 'success' }),
    })
    const r = await postJson('https://example.com/api', { a: 1 })
    expect(r.ok).toBe(true)
    expect(r.status).toBe(200)
    expect(r.data).toEqual({ code: 0, msg: 'success' })
    expect(r.opaque).toBe(false)
  })

  it('响应体非 JSON 时保留原文且 data 为 null', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'not a json',
    })
    const r = await postJson('https://example.com/api', {})
    expect(r.data).toBeNull()
    expect(r.text).toBe('not a json')
  })

  it('HTTP 错误状态时 ok 为 false', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'server error',
    })
    const r = await postJson('https://example.com/api', {})
    expect(r.ok).toBe(false)
    expect(r.status).toBe(500)
  })

  it('首次请求被 CORS 拦截时降级为 no-cors 重试并标记 opaque', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '' })
    const r = await postJson('https://example.com/api', { a: 1 })
    expect(r.ok).toBe(true)
    expect(r.opaque).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('降级重试也失败时返回错误信息', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const r = await postJson('https://example.com/api', {})
    expect(r.ok).toBe(false)
    expect(r.opaque).toBe(false)
    expect(r.error).toBeTruthy()
  })

  it('发送 JSON 请求头与序列化后的请求体', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '{}' })
    await postJson('https://example.com/api', { name: 'test' })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ name: 'test' })
  })

  it('字符串请求体原样发送，不做二次序列化', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '{}' })
    await postJson('https://example.com/api', 'raw-string')
    const [, init] = fetchMock.mock.calls[0]
    expect(init.body).toBe('raw-string')
  })

  it('配置代理时把代理前缀拼到 URL 前', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '{}' })
    await postJson('https://example.com/api', {}, { proxy: 'https://proxy.test/' })
    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('https://proxy.test/https://example.com/api')
  })

  it('query 式代理前缀保留尾部斜杠，不破坏 query 参数语义', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '{}' })
    await postJson('https://example.com/api', {}, { proxy: 'https://proxy.test/relay?to=' })
    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('https://proxy.test/relay?to=https://example.com/api')
  })

  it('代理前缀无尾部斜杠时直接拼接', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '{}' })
    await postJson('https://example.com/api', {}, { proxy: 'https://proxy.test' })
    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('https://proxy.testhttps://example.com/api')
  })

  it('代理前缀的多个尾部斜杠被折叠为一个', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '{}' })
    await postJson('https://example.com/api', {}, { proxy: 'https://proxy.test///' })
    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('https://proxy.test/https://example.com/api')
  })

  it('未配置代理时直接使用原始 URL', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '{}' })
    await postJson('https://example.com/api', {})
    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.com/api')
  })
})
