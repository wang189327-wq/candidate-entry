// 跨域友好的 POST 封装
//
// 背景：飞书/钉钉/企业微信的机器人 Webhook 与多数自建接口不返回 CORS 头，
// 浏览器直连会被拦截。这里做两级降级：
//   1) 正常 fetch（带 JSON 头，能拿到响应体）
//   2) 失败后改用 no-cors 简单请求（text/plain，不触发预检），
//      请求依然会送达对端，但拿不到响应体 —— 返回 opaque 标记供 UI 提示。

export async function postJson(url, body, options = {}) {
  const { proxy = '', timeout = 15000 } = options
  const target = proxy ? `${proxy.replace(/\/+$/, '')}${url}` : url
  const payload = typeof body === 'string' ? body : JSON.stringify(body)

  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      signal: AbortSignal.timeout(timeout),
    })
    const text = await res.text()
    let data = null
    try { data = JSON.parse(text) } catch { /* 非 JSON 响应 */ }
    return { ok: res.ok, status: res.status, data, text, opaque: false }
  } catch (err) {
    // 疑似跨域拦截，改用简单请求再试一次
    try {
      await fetch(target, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: payload,
        signal: AbortSignal.timeout(timeout),
      })
      return { ok: true, status: 0, data: null, text: '', opaque: true }
    } catch (err2) {
      return { ok: false, status: 0, data: null, text: '', opaque: false, error: err2.message || err.message }
    }
  }
}
