import { useState, useEffect } from 'react'
import { sb } from '../lib/supabase'
import bcrypt from 'bcryptjs'

const ADMIN_VERIFY_CODE = '118814'
const ADMIN_USERNAME = 'admin'

export default function Tab4() {
  const [accounts, setAccounts] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [form, setForm] = useState({
    alias: '',
    app_id_key: '',
    app_secret_key: '',
    app_token_key: '',
    password: '',
  })
  const [showSecret, setShowSecret] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(true)

  // 验证弹窗
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyFor, setVerifyFor] = useState(null) // { action: 'save'|'delete', isNew: bool }
  const [pendingForm, setPendingForm] = useState(null)

  const currentUser = JSON.parse(localStorage.getItem('portfolio_user') || '{}')
  const isAdmin = currentUser.username === ADMIN_USERNAME

  useEffect(() => {
    loadAccounts()
  }, [])

  async function loadAccounts() {
    setLoading(true)
    const { data, error } = await sb.from('feishu_accounts').select('*').order('created_at', { ascending: false })
    if (error) { alert('读取失败：' + error.message) }
    if (data) setAccounts(data)
    setLoading(false)
  }

  // 选中账号
  function handleSelect(idx) {
    setSelectedIdx(idx)
    const acc = accounts[idx]
    setForm({
      alias: acc.alias || '',
      app_id_key: acc.app_id_key || '',
      app_secret_key: acc.app_secret_key || '',
      app_token_key: acc.app_token_key || '',
      password: '',
    })
  }

  // 新增：清空表单
  function handleAdd() {
    setSelectedIdx(null)
    setForm({ alias: '', app_id_key: '', app_secret_key: '', app_token_key: '', password: '' })
  }

  // 保存前检查（admin编辑admin账号需验证）
  function handleSave() {
    if (!form.alias) { alert('用户名不能为空'); return }
    if (!form.app_id_key) { alert('App ID 不能为空'); return }
    if (!form.app_secret_key) { alert('App Secret 不能为空'); return }

    const isNew = selectedIdx === null
    const editingAccount = !isNew ? accounts[selectedIdx] : null
    const isEditingAdmin = editingAccount?.alias === ADMIN_USERNAME

    if (isEditingAdmin) {
      setVerifyFor({ action: 'save', isNew })
      setPendingForm({ ...form })
      setVerifyCode('')
      setVerifyOpen(true)
    } else {
      doSave(form, isNew)
    }
  }

  // 实际执行保存
  async function doSave(f, isNew) {
    try {
      if (isNew) {
        // 新增：写入 feishu_accounts + program_users
        if (!f.password) { alert('新增账号需要设置密码'); return }
        const { data: ins } = await sb.from('feishu_accounts').insert({
          alias: f.alias,
          app_id_key: f.app_id_key,
          app_secret_key: f.app_secret_key,
          app_token_key: f.app_token_key,
        }).select()
        if (ins?.[0]) {
          const hash = await bcrypt.hash(f.password, 10)
          await sb.from('program_users').insert({
            username: f.alias,
            password_hash: hash,
            role: 'guest',
          })
        }
      } else {
        // 编辑：更新 feishu_accounts
        const acc = accounts[selectedIdx]
        await sb.from('feishu_accounts').update({
          alias: f.alias,
          app_id_key: f.app_id_key,
          app_secret_key: f.app_secret_key,
          app_token_key: f.app_token_key,
        }).eq('id', acc.id)

        // 如果改了用户名，同步更新 program_users
        if (f.alias !== acc.alias) {
          const { data: users } = await sb.from('program_users').select('*').eq('username', acc.alias)
          if (users?.[0]) {
            if (f.password) {
              const hash = await bcrypt.hash(f.password, 10)
              await sb.from('program_users').update({ username: f.alias, password_hash: hash }).eq('id', users[0].id)
            } else {
              await sb.from('program_users').update({ username: f.alias }).eq('id', users[0].id)
            }
          }
        } else if (f.password) {
          // 没改用户名但改了密码
          const { data: users } = await sb.from('program_users').select('*').eq('username', f.alias)
          if (users?.[0]) {
            const hash = await bcrypt.hash(f.password, 10)
            await sb.from('program_users').update({ password_hash: hash }).eq('id', users[0].id)
          }
        }
      }

      await loadAccounts()
      setSelectedIdx(null)
      setForm({ alias: '', app_id_key: '', app_secret_key: '', app_token_key: '', password: '' })
      alert('保存成功')
    } catch (e) {
      alert('保存失败：' + e.message)
    }
  }

  // 删除前验证
  function handleDelete() {
    if (selectedIdx === null) { alert('请先选中要删除的账号'); return }
    const acc = accounts[selectedIdx]
    if (acc.alias === ADMIN_USERNAME) {
      alert('管理员账号不可删除')
      return
    }
    if (!confirm(`确定要删除账号「${acc.alias}」吗？`)) return
    doDelete(acc)
  }

  async function doDelete(acc) {
    try {
      // 从 program_users 删除
      const { data: users } = await sb.from('program_users').select('*').eq('username', acc.alias)
      if (users?.[0]) await sb.from('program_users').delete().eq('id', users[0].id)
      // 从 feishu_accounts 删除
      await sb.from('feishu_accounts').delete().eq('id', acc.id)
      await loadAccounts()
      setSelectedIdx(null)
      setForm({ alias: '', app_id_key: '', app_secret_key: '', app_token_key: '', password: '' })
      alert('删除成功')
    } catch (e) {
      alert('删除失败：' + e.message)
    }
  }

  // 验证弹窗提交
  function handleVerifySubmit() {
    if (verifyCode.trim() !== ADMIN_VERIFY_CODE) {
      alert('验证码错误')
      return
    }
    setVerifyOpen(false)
    if (verifyFor.action === 'save') {
      doSave(pendingForm, verifyFor.isNew)
    }
  }

  // 普通用户看到的列表（只有自己）
  const visibleAccounts = isAdmin ? accounts : accounts.filter(a => a.alias === currentUser.username)

  return (
    <div className="flex gap-4 p-4 h-full" style={{ minHeight: 'calc(100vh - 110px)' }}>
      {/* 左侧：账号列表 */}
      <div className="w-72 bg-white rounded border border-gray-200 flex flex-col">
        <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100">
          <span className="text-sm font-bold text-purple">
            {isAdmin ? '登录账号' : '我的账号'}
          </span>
          {isAdmin && (
            <button onClick={handleAdd}
              className="text-xs px-3 py-1 rounded text-white" style={{ backgroundColor: '#A8D4A8' }}>
              + 新增账号
            </button>
          )}
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-400 text-sm">加载中…</div>
          ) : visibleAccounts.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">暂无账号</div>
          ) : visibleAccounts.map((acc, idx) => {
            const realIdx = accounts.indexOf(acc)
            return (
              <button key={acc.id}
                onClick={() => handleSelect(realIdx)}
                className={`w-full text-left px-4 py-3 text-sm border-b border-gray-50 transition ${
                  selectedIdx === realIdx ? 'bg-purple bg-opacity-10 text-purple' : 'hover:bg-gray-50'
                }`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{acc.alias || '(无备注)'}</span>
                  {acc.alias === ADMIN_USERNAME && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 ml-1 shrink-0">管理员</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 truncate mt-0.5">{acc.app_id_key}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 右侧：编辑区 */}
      <div className="flex-1 bg-white rounded border border-gray-200 flex flex-col">
        <div className="px-4 py-2 border-b border-gray-100">
          <span className="text-sm font-bold text-purple">
            {selectedIdx !== null ? '编辑账号' : '新增账号'}
          </span>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-4">
            {/* 用户名 */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">用户名</label>
              <input value={form.alias}
                onChange={e => setForm(p => ({ ...p, alias: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple"
                placeholder="登录用户名" />
            </div>
            {/* 账号密码 */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                账号密码{selectedIdx !== null ? '（留空不修改）' : ''}
              </label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple pr-16"
                  placeholder={selectedIdx !== null ? '留空则保持不变' : '必填'} />
                <button onClick={() => setShowPwd(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                  {showPwd ? '隐藏' : '显示'}
                </button>
              </div>
            </div>
            {/* App ID */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">App ID</label>
              <input value={form.app_id_key}
                onChange={e => setForm(p => ({ ...p, app_id_key: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple"
                placeholder="ltaa0xxxxxx" />
            </div>
            {/* App Secret */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">App Secret</label>
              <div className="relative">
                <input type={showSecret ? 'text' : 'password'} value={form.app_secret_key}
                  onChange={e => setForm(p => ({ ...p, app_secret_key: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple pr-16"
                  placeholder="必填" />
                <button onClick={() => setShowSecret(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                  {showSecret ? '隐藏' : '显示'}
                </button>
              </div>
            </div>
            {/* App Token */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">App Token</label>
              <input value={form.app_token_key}
                onChange={e => setForm(p => ({ ...p, app_token_key: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple"
                placeholder="可选" />
            </div>
          </div>
        </div>
        {/* 底部按钮 */}
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <button onClick={handleSave}
            className="px-6 py-2 rounded text-sm text-white" style={{ backgroundColor: '#A8D4A8' }}>
            保存
          </button>
          {isAdmin && (
            <>
              <button onClick={handleDelete}
                className="px-6 py-2 rounded text-sm text-white" style={{ backgroundColor: '#FFCCCC', color: '#c00' }}>
                删除
              </button>

            </>
          )}
        </div>
      </div>

      {/* 管理员验证弹窗 */}
      {verifyOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80">
            <h3 className="text-base font-bold text-gray-800 mb-1">验证管理员身份</h3>
            <p className="text-xs text-gray-500 mb-4">
              修改 / 保存管理员账号「{pendingForm?.alias}」需要输入管理员验证码
            </p>
            <input type="password" value={verifyCode}
              onChange={e => setVerifyCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerifySubmit()}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:border-purple"
              placeholder="输入验证码：118814" autoFocus />
            <div className="flex gap-2">
              <button onClick={handleVerifySubmit}
                className="flex-1 py-2 rounded text-sm text-white font-medium"
                style={{ backgroundColor: '#A8D4A8' }}>确认</button>
              <button onClick={() => setVerifyOpen(false)}
                className="flex-1 py-2 rounded text-sm border border-gray-300 text-gray-600 hover:bg-gray-50">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
