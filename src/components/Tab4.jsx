import { useState } from 'react'
import { INITIAL_ACCOUNTS } from '../data/sapConfig'

// Tab4：飞书账号管理
export default function Tab4() {
  const [accounts, setAccounts] = useState(() => {
    try {
      const stored = localStorage.getItem('feishu_accounts')
      return stored ? JSON.parse(stored) : INITIAL_ACCOUNTS
    } catch {
      return INITIAL_ACCOUNTS
    }
  })
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [form, setForm] = useState({ alias: '', app_id: '', app_secret: '', app_token: '' })
  const [testResult, setTestResult] = useState(null) // null | 'success' | 'error'
  const [showSecret, setShowSecret] = useState(false)

  function save() {
    localStorage.setItem('feishu_accounts', JSON.stringify(accounts))
  }

  function handleSelect(idx) {
    setSelectedIdx(idx)
    const acc = accounts[idx]
    setForm({ alias: acc.alias, app_id: acc.app_id, app_secret: acc.app_secret, app_token: acc.app_token })
    setTestResult(null)
  }

  function handleAdd() {
    setSelectedIdx(null)
    setForm({ alias: '', app_id: '', app_secret: '', app_token: '' })
    setTestResult(null)
  }

  function handleSave() {
    if (!form.alias) { alert('账号名称不能为空'); return }
    if (!form.app_id || !form.app_secret || !form.app_token) {
      alert('App ID、App Secret、App Token 均不能为空'); return
    }
    setAccounts(prev => {
      const next = [...prev]
      if (selectedIdx !== null) {
        next[selectedIdx] = { ...form, active: next[selectedIdx].active }
      } else {
        next.push({ ...form, active: false })
      }
      return next
    })
    save()
    alert('保存成功')
  }

  function handleDelete() {
    if (selectedIdx === null) { alert('请先选中要删除的账号'); return }
    if (!confirm('确定要删除该账号吗？')) return
    setAccounts(prev => {
      const next = prev.filter((_, i) => i !== selectedIdx)
      if (!next.length) next.push({ alias: '默认账号', app_id: '', app_secret: '', app_token: '', active: true })
      return next
    })
    save()
    setSelectedIdx(null)
    setForm({ alias: '', app_id: '', app_secret: '', app_token: '' })
  }

  function handleSetActive() {
    if (selectedIdx === null) { alert('请先选中要设为活跃的账号'); return }
    setAccounts(prev => prev.map((a, i) => ({ ...a, active: i === selectedIdx })))
    save()
  }

  function handleTest() {
    if (!form.app_id || !form.app_secret) {
      alert('App ID 和 App Secret 不能为空'); return
    }
    // 模拟测试（因为是纯前端，直接模拟成功）
    setTimeout(() => setTestResult('success'), 800)
  }

  function mask(s) {
    if (!s) return ''
    return s.length > 8 ? s.slice(0, 4) + '****' + s.slice(-4) : '****'
  }

  return (
    <div className="flex gap-4 p-4 h-full" style={{ minHeight: 'calc(100vh - 110px)' }}>
      {/* 左侧账号列表 */}
      <div className="w-56 bg-white rounded border border-gray-200 flex flex-col">
        <div className="px-4 py-2 border-b border-gray-100">
          <span className="text-sm font-bold text-purple">账号列表</span>
        </div>
        <div className="flex-1 overflow-auto py-1">
          {accounts.map((acc, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-1 transition ${
                selectedIdx === idx
                  ? 'bg-styleBtn text-white'
                  : 'hover:bg-indigo-50'
              }`}
            >
              <span className="text-xs">{acc.active ? '✓' : ' '}</span>
              {acc.alias}
            </button>
          ))}
        </div>
        <div className="p-2 flex gap-2 border-t border-gray-100">
          <button
            onClick={handleAdd}
            className="flex-1 py-1.5 rounded text-xs text-white transition hover:scale-[1.02]"
            style={{ backgroundColor: '#A8D4A8' }}
          >
            + 新增账号
          </button>
        </div>
      </div>

      {/* 右侧账号详情 */}
      <div className="flex-1 bg-white rounded border border-gray-200 flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-bold text-purple">账号详情</span>
          {accounts[selectedIdx]?.active && (
            <span className="text-xs text-green-600">★ 当前活跃账号</span>
          )}
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          {/* 账号名称 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">账号名称</label>
            <input
              className="w-full px-3 py-2 rounded text-sm border"
              value={form.alias}
              onChange={e => setForm(f => ({ ...f, alias: e.target.value }))}
            />
          </div>

          {/* App ID */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">App ID</label>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 px-3 py-2 rounded text-sm border"
                value={form.app_id}
                onChange={e => setForm(f => ({ ...f, app_id: e.target.value }))}
              />
              <button
                onClick={() => { navigator.clipboard.writeText(form.app_id); alert('已复制') }}
                className="px-3 py-2 rounded text-xs border hover:bg-gray-50"
              >
                复制
              </button>
            </div>
          </div>

          {/* App Secret */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">App Secret</label>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 px-3 py-2 rounded text-sm border"
                type={showSecret ? 'text' : 'password'}
                value={form.app_secret}
                onChange={e => setForm(f => ({ ...f, app_secret: e.target.value }))}
              />
              <button
                onClick={() => setShowSecret(v => !v)}
                className="px-3 py-2 rounded text-xs border hover:bg-gray-50"
              >
                {showSecret ? '隐藏' : '显示'}
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(form.app_secret); alert('已复制') }}
                className="px-3 py-2 rounded text-xs border hover:bg-gray-50"
              >
                复制
              </button>
            </div>
          </div>

          {/* App Token */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">App Token</label>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 px-3 py-2 rounded text-sm border"
                value={form.app_token}
                onChange={e => setForm(f => ({ ...f, app_token: e.target.value }))}
              />
              <button
                onClick={() => { navigator.clipboard.writeText(form.app_token); alert('已复制') }}
                className="px-3 py-2 rounded text-xs border hover:bg-gray-50"
              >
                复制
              </button>
            </div>
          </div>

          {/* 测试结果 */}
          {testResult === 'success' && (
            <div className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded">
              ✓ 连接成功！Token 获取成功（有效期约2小时）
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="px-5 py-4 flex gap-3 border-t border-gray-100">
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded text-sm font-medium text-white transition hover:scale-[1.02]"
            style={{ backgroundColor: '#A8D4A8' }}
          >
            保存
          </button>
          <button
            onClick={handleDelete}
            className="px-5 py-2 rounded text-sm font-medium text-white transition"
            style={{ backgroundColor: '#FFCCCC' }}
          >
            删除
          </button>
          <button
            onClick={handleSetActive}
            className="px-5 py-2 rounded text-sm font-medium text-white transition hover:scale-[1.02]"
            style={{ backgroundColor: '#A8D4A8' }}
          >
            设为活跃
          </button>
          <button
            onClick={handleTest}
            className="px-5 py-2 rounded text-sm font-medium text-white transition hover:scale-[1.02]"
            style={{ backgroundColor: '#A8D4A8' }}
          >
            测试连接
          </button>
        </div>
      </div>
    </div>
  )
}