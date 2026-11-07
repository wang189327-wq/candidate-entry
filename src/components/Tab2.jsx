import { useState, useEffect } from 'react'
import { sb } from '../lib/supabase'

// Tab2：SAP代码管理
export default function Tab2() {
  const [sapConfig, setSapConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ city: '', pos: '', sap: '', note: '', published: '是' })
  const [editingKey, setEditingKey] = useState(null)
  const [cityFilter, setCityFilter] = useState('全部')
  const [pubFilter, setPubFilter] = useState('全部')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const { data, error } = await sb.from('sap_codes').select('*')
    if (!error && data) {
      const mapped = {}
      data.forEach((row) => {
        mapped[row.position_name] = {
          sap: row.sap_code,
          city: row.store_name || '',
          published: row.published || '否',
          note: row.note || '',
          _id: row.id,
        }
      })
      setSapConfig(mapped)
    }
    setLoading(false)
  }

  // 城市列表
  const cities = [
    '全部',
    ...new Set(
      Object.values(sapConfig)
        .map((c) => c.city)
        .filter(Boolean)
    ),
  ]

  // 过滤后的数据
  const filteredEntries = Object.entries(sapConfig).filter(([, cfg]) => {
    if (String(cfg).startsWith('col_width')) return false
    const city = cfg.city || ''
    const published = cfg.published || '否'
    return (cityFilter === '全部' || city === cityFilter) && (pubFilter === '全部' || published === pubFilter)
  })

  // 发布数量
  const pubCount = Object.values(sapConfig).filter((c) => c.published === '是').length

  async function handleAddOrUpdate() {
    if (!form.pos || !form.sap) {
      alert('岗位名称和SAP代码都不能为空')
      return
    }

    if (editingKey && editingKey !== form.pos) {
      // delete old key
      const oldEntry = sapConfig[editingKey]
      if (oldEntry && oldEntry._id) {
        await sb.from('sap_codes').delete().eq('id', oldEntry._id)
      }
    }

    if (editingKey && editingKey === form.pos) {
      // update
      await sb
        .from('sap_codes')
        .update({
          sap_code: form.sap,
          store_name: form.city,
          published: form.published,
          note: form.note,
        })
        .eq('id', sapConfig[editingKey]._id)
    } else {
      // insert
      const oldEntry = sapConfig[form.pos]
      if (oldEntry && oldEntry._id) {
        await sb
          .from('sap_codes')
          .update({
            sap_code: form.sap,
            store_name: form.city,
            published: form.published,
            note: form.note,
          })
          .eq('id', oldEntry._id)
      } else {
        await sb.from('sap_codes').insert({
          position_name: form.pos,
          sap_code: form.sap,
          store_name: form.city,
          published: form.published,
          note: form.note,
        })
      }
    }

    await loadData()
    setEditingKey(null)
    setForm({ city: '', pos: '', sap: '', note: '', published: '是' })
  }

  async function handleDelete(key) {
    if (!confirm(`确定要删除岗位「${key}」吗？`)) return
    const entry = sapConfig[key]
    if (entry && entry._id) {
      await sb.from('sap_codes').delete().eq('id', entry._id)
    }
    await loadData()
    if (editingKey === key) {
      setEditingKey(null)
      setForm({ city: '', pos: '', sap: '', note: '', published: '是' })
    }
  }

  function handleDoubleClick(key) {
    const cfg = sapConfig[key]
    setEditingKey(key)
    setForm({
      city: cfg.city || '',
      pos: key,
      sap: typeof cfg === 'string' ? cfg : cfg.sap || '',
      note: typeof cfg === 'string' ? '' : cfg.note || '',
      published: typeof cfg === 'string' ? '否' : cfg.published || '否',
    })
  }

  return (
    <div className="flex gap-4 p-4 h-full" style={{ minHeight: 'calc(100vh - 110px)' }}>
      {/* 左侧表单 */}
      <div className="w-72 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-blue-600">岗位发布数：{pubCount}</span>
          <span className="text-xs text-gray-400">{loading ? '加载中...' : '已同步云端'}</span>
        </div>

        {/* 筛选 */}
        <div className="bg-white rounded p-3 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs w-12 text-right text-gray-500">城市筛选</label>
            <select
              className="flex-1 px-2 py-1 rounded text-sm border"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
            >
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs w-12 text-right text-gray-500">是否发布</label>
            <select
              className="flex-1 px-2 py-1 rounded text-sm border"
              value={pubFilter}
              onChange={(e) => setPubFilter(e.target.value)}
            >
              {['全部', '是', '否'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 输入表单 */}
        <div className="bg-white rounded p-3 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs w-14 text-right text-gray-500">岗位城市</label>
            <input
              className="flex-1 px-2 py-1 rounded text-sm border"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs w-14 text-right text-gray-500">岗位名称</label>
            <input
              className="flex-1 px-2 py-1 rounded text-sm border"
              value={form.pos}
              placeholder="如：企划实习生（广州）"
              onChange={(e) => setForm((f) => ({ ...f, pos: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs w-14 text-right text-gray-500">SAP代码</label>
            <input
              className="flex-1 px-2 py-1 rounded text-sm border"
              value={form.sap}
              onChange={(e) => setForm((f) => ({ ...f, sap: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs w-14 text-right text-gray-500">备注</label>
            <input
              className="flex-1 px-2 py-1 rounded text-sm border"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs w-14 text-right text-gray-500">是否发布</label>
            <div className="flex gap-3">
              {['是', '否'].map((v) => (
                <label key={v} className="flex items-center gap-1 cursor-pointer text-xs">
                  <input
                    type="radio"
                    name="pub"
                    value={v}
                    checked={form.published === v}
                    onChange={(e) => setForm((f) => ({ ...f, published: e.target.value }))}
                  />
                  {v}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex gap-2">
          <button
            onClick={handleAddOrUpdate}
            className="flex-1 py-1.5 rounded text-sm font-medium text-white transition hover:scale-[1.02]"
            style={{ backgroundColor: '#A8D4A8' }}
          >
            {editingKey ? '保存修改' : '添加/保存'}
          </button>
          <button
            onClick={() => {
              setEditingKey(null)
              setForm({ city: '', pos: '', sap: '', note: '', published: '是' })
            }}
            className="px-4 py-1.5 rounded text-sm font-medium text-white transition"
            style={{ backgroundColor: '#FFCCCC' }}
          >
            重置
          </button>
        </div>
      </div>

      {/* 右侧表格 */}
      <div className="flex-1 bg-white rounded border border-gray-200 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-600 text-xs">
                {['序号', '岗位城市', '岗位名称', 'SAP代码', '是否发布', '备注', '操作'].map((col) => (
                  <th key={col} className="px-3 py-2 text-center font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400 text-sm">
                    加载中...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400 text-sm">
                    暂无数据
                  </td>
                </tr>
              ) : (
                filteredEntries.map(([key, cfg], idx) => (
                  <tr
                    key={key}
                    className="border-t border-gray-50 hover:bg-indigo-50 cursor-pointer"
                    onDoubleClick={() => handleDoubleClick(key)}
                  >
                    <td className="px-3 py-2 text-center">{idx + 1}</td>
                    <td className="px-3 py-2 text-center">{cfg.city || ''}</td>
                    <td className="px-3 py-2 text-center">{key}</td>
                    <td className="px-3 py-2 text-center">{typeof cfg === 'string' ? cfg : cfg.sap}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${cfg.published === '是' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}
                      >
                        {cfg.published}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">{typeof cfg === 'string' ? '' : cfg.note}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => handleDelete(key)} className="text-xs text-red-400 hover:text-red-600">
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
