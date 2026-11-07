import { useState, useEffect } from 'react'
import Tab1 from './components/Tab1'
import Tab2 from './components/Tab2'
import Tab3 from './components/Tab3'
import Tab4 from './components/Tab4'
import Tab5 from './components/Tab5'
import { sb } from './lib/supabase'
import bcrypt from 'bcryptjs'

const TAB_COMPONENTS = [Tab1, Tab2, Tab3, Tab4, Tab5]
const TAB_LABELS = ['信息识别', 'SAP代码管理', '图片库', '登录账号', '接入配置']
const TAB_VISIBLE_TO_GUEST = [true, false, false, false, false]

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loginError, setLoginError] = useState('')
  const [activeTab, setActiveTab] = useState(0)

  useEffect(() => {
    const saved = localStorage.getItem('portfolio_user')
    if (saved) setUser(JSON.parse(saved))
    setLoading(false)
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    const username = e.target.username.value.trim()
    const password = e.target.password.value
    if (!username || !password) return

    setLoginError('')
    const { data, error } = await sb.from('program_users').select('*').eq('username', username).maybeSingle()

    if (error || !data) {
      setLoginError('账号或密码错误')
      return
    }

    const match = await bcrypt.compare(password, data.password_hash)
    if (!match) {
      setLoginError('账号或密码错误')
      return
    }

    const userInfo = { id: data.id, username: data.username, role: data.role }
    localStorage.setItem('portfolio_user', JSON.stringify(userInfo))
    setUser(userInfo)
  }

  function handleLogout() {
    localStorage.removeItem('portfolio_user')
    setUser(null)
    setActiveTab(0)
  }

  if (loading) return null

  // 未登录：只显示 Tab1（候选人提交信息入口）
  if (!user) {
    return (
      <div className="min-h-screen bg-styleBg flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 w-80">
          <h2 className="text-xl font-bold text-purple text-center mb-6" style={{ fontFamily: 'Microsoft YaHei' }}>
            管理员登录
          </h2>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">账号</label>
              <input
                name="username"
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple"
                placeholder="输入账号"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">密码</label>
              <input
                name="password"
                type="password"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple"
                placeholder="输入密码"
              />
            </div>
            {loginError && <p className="text-red-500 text-sm mb-3 text-center">{loginError}</p>}
            <button
              type="submit"
              className="w-full bg-purple text-white rounded py-2 font-medium hover:opacity-90 transition-opacity"
            >
              登录
            </button>
          </form>
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                localStorage.setItem(
                  'portfolio_user',
                  JSON.stringify({ id: 'guest', username: 'guest', role: 'guest' })
                )
                setUser({ id: 'guest', username: 'guest', role: 'guest' })
              }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              游客入口（仅查看 Tab1）
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 游客：只显示 Tab1
  if (user.role === 'guest') {
    return (
      <div className="min-h-screen bg-styleBg flex flex-col">
        <div className="bg-white border-b border-styleBtn px-6 py-3 flex items-center justify-between shadow-sm">
          <h1 className="text-lg font-bold text-purple" style={{ fontFamily: 'Microsoft YaHei' }}>
            门店求职者信息录入
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">游客模式</span>
            <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-red-500 underline">
              退出
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <Tab1 />
        </div>
      </div>
    )
  }

  // 管理员：显示所有 Tab
  // 所有 Tab 一并挂载、仅切换显隐 —— 这样切换页签时组件状态（已识别的字段、
  // 已填的表单、滚动位置）不会丢失。
  return (
    <div className="min-h-screen bg-styleBg flex flex-col">
      {/* 顶部标题 */}
      <div className="bg-white border-b border-styleBtn px-6 py-3 flex items-center justify-between shadow-sm">
        <h1 className="text-lg font-bold text-purple" style={{ fontFamily: 'Microsoft YaHei' }}>
          门店求职者信息录入
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">欢迎，{user.username}</span>
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-red-500 underline">
            退出
          </button>
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="bg-white border-b border-styleBg2 px-6">
        <div className="flex gap-1">
          {TAB_LABELS.map((label, i) => {
            if (user.role === 'guest' && !TAB_VISIBLE_TO_GUEST[i]) return null
            return (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`px-6 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
                  activeTab === i
                    ? 'border-purple text-purple bg-styleBg bg-opacity-40'
                    : 'border-transparent text-gray-500 hover:text-purple hover:bg-styleBg hover:bg-opacity-30'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab 内容 */}
      <div className="flex-1 overflow-auto">
        {TAB_COMPONENTS.map((Comp, i) => (
          <div key={i} className={activeTab === i ? 'block' : 'hidden'}>
            <Comp />
          </div>
        ))}
      </div>
    </div>
  )
}
