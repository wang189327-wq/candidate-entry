import { useState, useEffect } from 'react'
import { sb } from '../lib/supabase'

const ADMIN_USERNAME = 'admin'

// 迁移脚本未执行时 PostgREST 返回 PGRST202，据此给出可操作的提示
function isRpcMissing(error) {
  const msg = String(error?.message || '')
  return error?.code === 'PGRST202' || msg.includes('Could not find the function')
}

const MIGRATION_HINT = '服务端未初始化，请先执行 supabase/migrations 下的迁移脚本'

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
    if (error) {
      alert('读取失败：' + error.message)
    }
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

  // 保存前检查：账号写操作一律需要管理员验证码（由服务端校验）
  function handleSave() {
    if (!form.alias) {
      alert('用户名不能为空')
      return
    }
    if (!form.app_id_key) {
      alert('App ID 不能为空')
      return
    }
    if (!form.app_secret_key) {
      alert('App Secret 不能为空')
      return
    }

    const isNew = selectedIdx === null
    if (isNew && !form.password) {
      alert('新增账号需要设置密码')
      return
    }

    setVerifyFor({ action: 'save', isNew })
    setPendingForm({ ...form })
    setVerifyCode('')
    setVerifyOpen(true)
  }

  // 实际执行保存：走服务端函数，feishu_accounts 与 program_users 单事务写入
  async function doSave(f, isNew, code) {
    try {
      const acc = isNew ? null : accounts[selectedIdx]
      const { error } = await sb.rpc('admin_save_account', {
        p_code: code,
        p_alias: f.alias,
        p_password: f.password || null,
        p_account_id: acc?.id || null,
        p_old_alias: acc?.alias || null,
        p_app_id_key: f.app_id_key,
        p_app_secret_key: f.app_secret_key,
        p_app_token_key: f.app_token_key,
        // 数据库侧 program_users_role_check 只允许 admin / user，普通账号统一为 user
        p_role: 'user',
      })
      if (error) throw error

      await loadAccounts()
      setSelectedIdx(null)
      setForm({ alias: '', app_id_key: '', app_secret_key: '', app_token_key: '', password: '' })
      alert('保存成功')
    } catch (e) {
      alert('保存失败：' + (isRpcMissing(e) ? MIGRATION_HINT : e?.message || e))
    }
  }

  // 删除前验证：同样走验证码弹窗，实际删除由服务端完成
  function handleDelete() {
    if (selectedIdx === null) {
      alert('请先选中要删除的账号')
      return
    }
    const acc = accounts[selectedIdx]
    if (acc.alias === ADMIN_USERNAME) {
      alert('管理员账号不可删除')
      return
    }
    if (!confirm(`确定要删除账号「${acc.alias}」吗？`)) return
    setVerifyFor({ action: 'delete', account: acc })
    setVerifyCode('')
    setVerifyOpen(true)
  }

  async function doDelete(acc, code) {
    try {
      const { error } = await sb.rpc('admin_delete_account', {
        p_code: code,
        p_account_id: acc.id,
        p_alias: acc.alias,
      })
      if (error) throw error

      await loadAccounts()
      setSelectedIdx(null)
      setForm({ alias: '', app_id_key: '', app_secret_key: '', app_token_key: '', password: '' })
      alert('删除成功')
    } catch (e) {
      alert('删除失败：' + (isRpcMissing(e) ? MIGRATION_HINT : e?.message || e))
    }
  }

  // 验证弹窗提交：验证码由服务端校验，通过后执行对应动作
  async function handleVerifySubmit() {
    const code = verifyCode.trim()
    if (!code) {
      alert('请输入验证码')
      return
    }

    const { data: ok, error } = await sb.rpc('verify_admin', { p_code: code })
    if (error) {
      alert(isRpcMissing(error) ? MIGRATION_HINT : '验证码校验失败：' + error.message)
      return
    }
    if (!ok) {
      alert('验证码错误')
      return
    }

    setVerifyOpen(false)
    if (verifyFor.action === 'save') {
      await doSave(pendingForm, verifyFor.isNew, code)
    } else if (verifyFor.action === 'delete') {
      await doDelete(verifyFor.account, code)
    }
  }

  // 普通用户看到的列表（只有自己）
  const visibleAccounts = isAdmin ? accounts : accounts.filter((a) => a.alias === currentUser.username)

  return (
    <div className="flex gap-4 p-4 h-full" style={{ minHeight: 'calc(100vh - 110px)' }}>
      {/* 左侧：账号列表 */}
      <div className="w-72 bg-white rounded border border-gray-200 flex flex-col">
        <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100">
          <span className="text-sm font-bold text-purple">{isAdmin ? '登录账号' : '我的账号'}</span>
          {isAdmin && (
            <button
              onClick={handleAdd}
              className="text-xs px-3 py-1 rounded text-white"
              style={{ backgroundColor: '#A8D4A8', color: '#22543D' }}
            >
              + 新增账号
            </button>
          )}
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-400 text-sm">加载中…</div>
          ) : visibleAccounts.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">暂无账号</div>
          ) : (
            visibleAccounts.map((acc, idx) => {
              const realIdx = accounts.indexOf(acc)
              return (
                <button
                  key={acc.id}
                  onClick={() => handleSelect(realIdx)}
                  className={`w-full text-left px-4 py-3 text-sm border-b border-gray-50 transition ${
                    selectedIdx === realIdx ? 'bg-purple bg-opacity-10 text-purple' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{acc.alias || '(无备注)'}</span>
                    {acc.alias === ADMIN_USERNAME && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 ml-1 shrink-0">
                        管理员
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate mt-0.5">{acc.app_id_key}</div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* 右侧：编辑区 */}
      <div className="flex-1 bg-white rounded border border-gray-200 flex flex-col">
        <div className="px-4 py-2 border-b border-gray-100">
          <span className="text-sm font-bold text-purple">{selectedIdx !== null ? '编辑账号' : '新增账号'}</span>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-4">
            {/* 用户名 */}
            <div>
              <label htmlFor="acc-username" className="block text-sm text-gray-600 mb-1">
                用户名
              </label>
              <input
                id="acc-username"
                value={form.alias}
                onChange={(e) => setForm((p) => ({ ...p, alias: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple"
                placeholder="登录用户名"
              />
            </div>
            {/* 账号密码 */}
            <div>
              <label htmlFor="acc-password" className="block text-sm text-gray-600 mb-1">
                账号密码{selectedIdx !== null ? '（留空不修改）' : ''}
              </label>
              <div className="relative">
                <input
                  id="acc-password"
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple pr-16"
                  placeholder={selectedIdx !== null ? '留空则保持不变' : '必填'}
                />
                <button
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? '隐藏' : '显示'}
                </button>
              </div>
            </div>
            {/* App ID */}
            <div>
              <label htmlFor="acc-app-id" className="block text-sm text-gray-600 mb-1">
                App ID
              </label>
              <input
                id="acc-app-id"
                value={form.app_id_key}
                onChange={(e) => setForm((p) => ({ ...p, app_id_key: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple"
                placeholder="ltaa0xxxxxx"
              />
            </div>
            {/* App Secret */}
            <div>
              <label htmlFor="acc-app-secret" className="block text-sm text-gray-600 mb-1">
                App Secret
              </label>
              <div className="relative">
                <input
                  id="acc-app-secret"
                  type={showSecret ? 'text' : 'password'}
                  value={form.app_secret_key}
                  onChange={(e) => setForm((p) => ({ ...p, app_secret_key: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple pr-16"
                  placeholder="必填"
                />
                <button
                  onClick={() => setShowSecret((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                >
                  {showSecret ? '隐藏' : '显示'}
                </button>
              </div>
            </div>
            {/* App Token */}
            <div>
              <label htmlFor="acc-app-token" className="block text-sm text-gray-600 mb-1">
                App Token
              </label>
              <input
                id="acc-app-token"
                value={form.app_token_key}
                onChange={(e) => setForm((p) => ({ ...p, app_token_key: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple"
                placeholder="可选"
              />
            </div>
          </div>
        </div>
        {/* 底部按钮 */}
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded text-sm text-white"
            style={{ backgroundColor: '#A8D4A8', color: '#22543D' }}
          >
            保存
          </button>
          {isAdmin && (
            <>
              <button
                onClick={handleDelete}
                className="px-6 py-2 rounded text-sm text-white"
                style={{ backgroundColor: '#FFCCCC', color: '#9B2C2C' }}
              >
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
              {verifyFor?.action === 'delete'
                ? `删除账号「${verifyFor?.account?.alias}」需要输入管理员验证码`
                : `保存账号「${pendingForm?.alias}」需要输入管理员验证码`}
            </p>
            <input
              type="password"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifySubmit()}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:border-purple"
              placeholder="输入管理员验证码"
            />
            <div className="flex gap-2">
              <button
                onClick={handleVerifySubmit}
                className="flex-1 py-2 rounded text-sm text-white font-medium"
                style={{ backgroundColor: '#A8D4A8', color: '#22543D' }}
              >
                确认
              </button>
              <button
                onClick={() => setVerifyOpen(false)}
                className="flex-1 py-2 rounded text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
