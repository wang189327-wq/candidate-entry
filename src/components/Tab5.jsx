// Tab5：接入配置
// 选择「识别结果写到哪里」：飞书多维表格 / 任意 Webhook（钉钉、企业微信、自建 API）/ Supabase 云端 / 本地导出
import { useState, useEffect } from 'react'
import { ADAPTERS, getAdapter, loadIntegration, saveIntegration } from '../lib/adapters'

export default function Tab5() {
  const [adapterId, setAdapterId] = useState(loadIntegration().adapterId)
  const [config, setConfig] = useState(loadIntegration().config)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState(null)
  const [saved, setSaved] = useState(false)

  const adapter = getAdapter(adapterId)

  useEffect(() => {
    // 切换适配器时载入该适配器已保存的参数，缺省值取 fields.default
    const savedCfg = loadIntegration().config
    const defaults = {}
    getAdapter(adapterId).fields.forEach((f) => {
      if (f.default !== undefined) defaults[f.key] = f.default
    })
    setConfig({ ...defaults, ...savedCfg })
    setResult(null)
    setSaved(false)
    // 仅在切换目标时重新载入配置；adapter 对象每次渲染都会重建，不宜作为依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapterId])

  function handleChange(key, value) {
    setConfig((c) => ({ ...c, [key]: value }))
    setSaved(false)
    setResult(null)
  }

  function handleSave() {
    saveIntegration(adapterId, config)
    setSaved(true)
    setResult({ ok: true, message: `已保存，当前写入目标：${adapter.name}` })
  }

  async function handleTest() {
    setTesting(true)
    setResult(null)
    const res = await adapter.test(config)
    setResult(res)
    setTesting(false)
  }

  return (
    <div className="flex gap-4 p-4 h-full" style={{ minHeight: 'calc(100vh - 110px)' }}>
      {/* 左侧：目标系统列表 */}
      <div className="w-72 bg-white rounded border border-gray-200 flex flex-col overflow-hidden">
        <div className="bg-indigo-50 px-4 py-2">
          <span className="text-sm font-bold text-purple">写入目标系统</span>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {ADAPTERS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={adapterId === a.id}
              onClick={() => setAdapterId(a.id)}
              className={`block w-full text-left p-3 rounded mb-1 cursor-pointer border transition ${
                adapterId === a.id ? 'border-purple bg-indigo-50' : 'border-transparent hover:bg-gray-50'
              }`}
            >
              <div className="text-sm font-medium text-gray-800">
                {a.id === adapterId && <span className="text-purple mr-1">●</span>}
                {a.name}
              </div>
              <div className="text-xs text-gray-400 mt-1 leading-relaxed">{a.desc}</div>
            </button>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400 leading-relaxed">
          识别与写入已解耦：切换目标后，Tab1 的「识别候选人」照常工作，只是写入动作改由所选系统承接。
        </div>
      </div>

      {/* 右侧：配置表单 */}
      <div className="flex-1 bg-white rounded border border-gray-200 flex flex-col overflow-hidden">
        <div className="bg-indigo-50 px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-bold text-purple">{adapter.name} · 参数配置</span>
          <span className="text-xs text-gray-400">配置保存在本机浏览器（localStorage）</span>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          {adapter.fields.length === 0 ? (
            <div className="text-sm text-gray-500 bg-gray-50 rounded p-4 leading-relaxed">
              该目标无需额外参数，直接保存即可生效。
              <div className="mt-2 text-xs text-gray-400">
                提示：Supabase 为本项目自带的云端表；如果你要接入自己公司的系统，请改用「Webhook（任意系统）」。
              </div>
            </div>
          ) : (
            adapter.fields.map((f) => (
              <div key={f.key}>
                <label className="block text-sm text-gray-600 mb-1">{f.label}</label>
                {f.type === 'select' ? (
                  <select
                    value={config[f.key] ?? f.default ?? ''}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple"
                  >
                    {f.options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type === 'password' ? 'password' : 'text'}
                    value={config[f.key] ?? ''}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    placeholder={f.placeholder || ''}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple"
                  />
                )}
                {f.hint && <div className="text-xs text-gray-400 mt-1">{f.hint}</div>}
              </div>
            ))
          )}

          {result && (
            <div
              className={`text-sm rounded p-3 ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}
            >
              {result.ok ? '✓ ' : '✗ '}
              {result.message}
            </div>
          )}
        </div>

        <div className="px-5 py-3 flex gap-3 border-t border-gray-100">
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded text-sm font-medium text-white transition hover:scale-[1.02]"
            style={{ backgroundColor: '#A8D4A8' }}
          >
            保存配置
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-5 py-2 rounded text-sm font-medium text-purple border border-purple hover:bg-indigo-50 transition disabled:opacity-50"
          >
            {testing ? '测试中...' : '测试连接'}
          </button>
          {saved && <span className="self-center text-xs text-green-600">已保存并生效</span>}
        </div>
      </div>
    </div>
  )
}
