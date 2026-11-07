import { useState, useEffect } from 'react'
import { parseText, lookupSapByStore, generateSampleText } from '../utils/parseText.jsx'
import { generateAllSampleImages } from '../utils/generateImages.jsx'
import { sb } from '../lib/supabase'
import { writeCandidate, writeButtonLabel, loadIntegration, onIntegrationChange } from '../lib/adapters'

// Tab1：信息识别
export default function Tab1() {
  const [rawText, setRawText] = useState('')
  const [fields, setFields] = useState({
    姓名: '',
    联系方式: '',
    年龄: '',
    性别: '女',
    SAP代码: '',
    意向岗位: '全职',
    门店名称: '',
  })
  const [sampleImages, setSampleImages] = useState(null)
  const [writeStatus, setWriteStatus] = useState('idle') // idle | loading | success | error
  const [sapConfig, setSapConfig] = useState({})
  const [candidates, setCandidates] = useState([])
  const [sapLoading, setSapLoading] = useState(true)
  const [showList, setShowList] = useState(false)
  // 当前写入目标（可在「接入配置」中切换；切回本页时重新读取）
  const [target, setTarget] = useState(loadIntegration())

  useEffect(() => {
    setSampleImages(generateAllSampleImages())
    loadSapConfig()
    loadCandidates()
  }, [])

  // 「接入配置」中切换写入目标后，实时同步按钮文案与底部提示
  useEffect(() => onIntegrationChange(() => setTarget(loadIntegration())), [])

  async function loadSapConfig() {
    setSapLoading(true)
    const { data } = await sb.from('sap_codes').select('*')
    if (data) {
      const mapped = {}
      data.forEach((row) => {
        mapped[row.position_name] = {
          sap: row.sap_code,
          city: row.store_name || '',
          published: row.published || '否',
          note: row.note || '',
        }
      })
      setSapConfig(mapped)
    }
    setSapLoading(false)
  }

  async function loadCandidates() {
    const { data } = await sb.from('candidates').select('*').order('created_at', { ascending: false })
    if (data) setCandidates(data)
  }

  // 解析并回填字段（文本由调用方传入，避免依赖尚未提交的 state）
  function applyParse(text) {
    const result = parseText(text)
    if (!result) {
      setFields((f) => ({ ...f, 姓名: '', 联系方式: '', 年龄: '', 门店名称: '', SAP代码: '' }))
      alert('未能识别候选人信息，请检查格式是否正确')
      return false
    }
    const storeName = result['门店名称'] || ''
    const sapCode = lookupSapByStore(storeName, sapConfig)
    setFields((f) => ({
      ...f,
      姓名: result['姓名'] || '',
      联系方式: result['联系方式'] || '',
      年龄: result['年龄'] || '',
      门店名称: storeName,
      SAP代码: sapCode || result['SAP代码'] || '',
    }))
    return true
  }

  function handleParse() {
    if (!rawText.trim()) {
      alert('请先粘贴聊天记录文本')
      return
    }
    applyParse(rawText)
  }

  function handleClear() {
    setRawText('')
    setFields({ 姓名: '', 联系方式: '', 年龄: '', 性别: '女', SAP代码: '', 意向岗位: '全职', 门店名称: '' })
  }

  async function handleWriteFeishu() {
    if (!fields.姓名.trim()) {
      alert('请填写姓名')
      return
    }
    setWriteStatus('loading')
    try {
      const res = await writeCandidate({
        姓名: fields.姓名,
        年龄: fields.年龄,
        性别: fields.性别,
        联系方式: fields.联系方式,
        SAP代码: fields['SAP代码'],
        意向岗位: fields['意向岗位'],
        门店名称: fields.门店名称,
      })
      if (!res.ok) {
        setWriteStatus('error')
        setTimeout(() => setWriteStatus('idle'), 2500)
        alert('写入失败：' + res.message)
        return
      }
      // 写入云端数据库时同步刷新左侧列表
      if (res.adapterId === 'supabase') await loadCandidates()
      setWriteStatus('success')
      setTimeout(() => setWriteStatus('idle'), 2500)
    } catch (e) {
      setWriteStatus('error')
      setTimeout(() => setWriteStatus('idle'), 2500)
      alert('写入失败：' + (e?.message || e))
    }
  }

  function handleFillSample() {
    const sample = generateSampleText()
    setRawText(sample)
    applyParse(sample)
  }

  const ageVal = fields['年龄']
  const ageNum = parseInt(ageVal)
  const ageColor = ageNum >= 18 && ageNum <= 40 ? 'text-green-600' : 'text-red-500'

  const shopPhoneImg = fields['SAP代码'] && sampleImages ? sampleImages[fields['SAP代码']] : null

  return (
    <div className="flex gap-4 p-4 h-full" style={{ minHeight: 'calc(100vh - 110px)' }}>
      {/* 左侧：粘贴区 */}
      <div className="flex-1 bg-white rounded border border-gray-200 flex flex-col overflow-hidden">
        <div className="bg-indigo-50 px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-bold text-purple">粘贴聊天记录文本</span>
          <button onClick={() => setShowList((v) => !v)} className="text-xs text-purple hover:underline">
            {showList ? '隐藏列表' : `已录入(${candidates.length})`}
          </button>
        </div>

        {showList && (
          <div className="border-t border-gray-100 max-h-48 overflow-auto">
            {candidates.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">暂无记录</p>
            ) : (
              candidates.map((c) => (
                <div key={c.id} className="px-4 py-2 border-b border-gray-50 text-xs flex gap-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-500">{c.store}</span>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-500">{c.position}</span>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-400">{c.entry_date}</span>
                </div>
              ))
            )}
          </div>
        )}

        <textarea
          className="flex-1 p-3 text-sm resize-none outline-none border-0 focus:ring-0"
          style={{ fontFamily: 'Microsoft YaHei', minHeight: 280 }}
          placeholder={
            '粘贴候选人聊天记录，例如：\n李小明\n的手机号：\n13800000000\n复制手机号\n的微信号：\nlxm_demo000\n复制微信号\n年龄：\n25 岁\n沟通职位：\n拣货员（广州正佳广场门店）'
          }
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
        <div className="px-4 py-3 flex gap-3 border-t border-gray-100">
          <button
            onClick={handleParse}
            className="px-6 py-2 rounded text-sm font-medium transition hover:scale-[1.02] text-white"
            style={{ backgroundColor: '#A8D4A8' }}
          >
            识别候选人
          </button>
          <button
            onClick={handleFillSample}
            className="px-4 py-2 rounded text-xs font-medium transition text-purple border border-purple hover:bg-indigo-50"
          >
            填充示例
          </button>
          <button
            onClick={() => setRawText('')}
            className="px-5 py-2 rounded text-sm font-medium transition hover:scale-[1.02] text-white"
            style={{ backgroundColor: '#FFCCCC' }}
          >
            取消
          </button>
        </div>
      </div>

      {/* 右侧：确认区 */}
      <div className="flex-1 bg-white rounded border border-gray-200 flex flex-col overflow-hidden">
        <div className="bg-indigo-50 px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-bold text-purple">已识别的求职者信息</span>
          {sapLoading && <span className="text-xs text-gray-400">SAP加载中...</span>}
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-2">
          <FieldRow label="姓名" required>
            <input
              className="flex-1 px-3 py-1.5 rounded text-sm border outline-none focus:border-styleBtn"
              style={{ backgroundColor: '#E8F5E9', fontFamily: 'Microsoft YaHei' }}
              value={fields['姓名']}
              onChange={(e) => setFields((f) => ({ ...f, 姓名: e.target.value }))}
            />
          </FieldRow>
          <FieldRow label="联系方式">
            <input
              className="flex-1 px-3 py-1.5 rounded text-sm border outline-none focus:border-styleBtn"
              style={{ backgroundColor: '#E8F5E9', fontFamily: 'Microsoft YaHei' }}
              value={fields['联系方式']}
              onChange={(e) => setFields((f) => ({ ...f, 联系方式: e.target.value }))}
            />
          </FieldRow>
          <FieldRow label="年龄">
            <input
              className={`flex-1 px-3 py-1.5 rounded text-sm border outline-none ${ageColor}`}
              style={{
                backgroundColor: ageNum >= 18 && ageNum <= 40 ? '#F0FFF0' : '#FFF0F0',
                fontFamily: 'Microsoft YaHei',
              }}
              value={fields['年龄']}
              onChange={(e) => setFields((f) => ({ ...f, 年龄: e.target.value }))}
            />
          </FieldRow>
          <div className="flex items-center">
            <label
              className="w-28 text-sm px-3 py-1.5 rounded text-right"
              style={{ backgroundColor: '#C7EDCC', fontFamily: 'Microsoft YaHei' }}
            >
              性别：
            </label>
            <div className="flex gap-3">
              {['女', '男'].map((opt) => (
                <label key={opt} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value={opt}
                    checked={fields['性别'] === opt}
                    onChange={(e) => setFields((f) => ({ ...f, 性别: e.target.value }))}
                  />
                  <span className="text-sm" style={{ fontFamily: 'Microsoft YaHei' }}>
                    {opt}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <FieldRow label="SAP代码">
            <input
              className="flex-1 px-3 py-1.5 rounded text-sm border outline-none focus:border-styleBtn"
              style={{ backgroundColor: '#E8F5E9', fontFamily: 'Microsoft YaHei' }}
              value={fields['SAP代码']}
              onChange={(e) => setFields((f) => ({ ...f, SAP代码: e.target.value }))}
            />
          </FieldRow>
          <div className="flex items-center">
            <label
              className="w-28 text-sm px-3 py-1.5 rounded text-right"
              style={{ backgroundColor: '#C7EDCC', fontFamily: 'Microsoft YaHei' }}
            >
              意向岗位：
            </label>
            <div className="flex gap-3">
              {['全职', '兼职', '店长'].map((opt) => (
                <label key={opt} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="job"
                    value={opt}
                    checked={fields['意向岗位'] === opt}
                    onChange={(e) => setFields((f) => ({ ...f, 意向岗位: e.target.value }))}
                  />
                  <span className="text-sm" style={{ fontFamily: 'Microsoft YaHei' }}>
                    {opt}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <FieldRow label="门店名称">
            <input
              className="flex-1 px-3 py-1.5 rounded text-sm border outline-none focus:border-styleBtn"
              style={{ backgroundColor: '#E8F5E9', fontFamily: 'Microsoft YaHei' }}
              value={fields['门店名称']}
              onChange={(e) => setFields((f) => ({ ...f, 门店名称: e.target.value }))}
            />
          </FieldRow>
          <div className="flex items-center">
            <label
              className="w-28 text-sm px-3 py-1.5 rounded text-right"
              style={{ backgroundColor: '#C7EDCC', fontFamily: 'Microsoft YaHei' }}
            >
              店长手机号：
            </label>
            <div className="flex items-center gap-3 flex-1">
              {shopPhoneImg ? (
                <img
                  src={shopPhoneImg}
                  alt="店长手机号"
                  className="h-12 rounded border cursor-pointer hover:opacity-80"
                />
              ) : (
                <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded">（无图片）</span>
              )}
            </div>
          </div>
          <div className="flex items-center">
            <label
              className="w-28 text-sm px-3 py-1.5 rounded text-right"
              style={{ backgroundColor: '#C7EDCC', fontFamily: 'Microsoft YaHei' }}
            >
              常用图片：
            </label>
            <div className="flex items-center gap-3 flex-1">
              {sampleImages?.common && (
                <img
                  src={sampleImages.common}
                  alt="常用图片"
                  className="h-12 rounded border cursor-pointer hover:opacity-80"
                />
              )}
            </div>
          </div>
          <div className="flex items-center">
            <label
              className="w-28 text-sm px-3 py-1.5 rounded text-right"
              style={{ backgroundColor: '#C7EDCC', fontFamily: 'Microsoft YaHei' }}
            >
              超级仓门面：
            </label>
            <div className="flex items-center gap-3 flex-1">
              {sampleImages?.superCang && (
                <img
                  src={sampleImages.superCang}
                  alt="超级仓门面"
                  className="h-12 rounded border cursor-pointer hover:opacity-80"
                />
              )}
            </div>
          </div>
        </div>
        <div className="px-4 py-3 flex gap-3 border-t border-gray-100">
          <button
            onClick={handleWriteFeishu}
            disabled={writeStatus === 'loading' || writeStatus === 'success'}
            className={`px-6 py-2 rounded text-sm font-medium transition text-white ${writeStatus === 'success' ? 'bg-green-400' : 'hover:scale-[1.02]'}`}
            style={{ backgroundColor: writeStatus === 'success' ? '#4ade80' : '#A8D4A8' }}
          >
            {writeStatus === 'loading'
              ? '写入中...'
              : writeStatus === 'success'
                ? '✓ 已完成'
                : writeButtonLabel(target.adapterId)}
          </button>
          <button
            onClick={handleClear}
            className="px-5 py-2 rounded text-sm font-medium transition hover:scale-[1.02] text-white"
            style={{ backgroundColor: '#FFCCCC' }}
          >
            清空
          </button>
          <span className="self-center text-xs text-gray-400">
            写入目标：
            {target.adapterId === 'supabase'
              ? 'Supabase 云端'
              : target.adapterId === 'feishu'
                ? '飞书多维表格'
                : target.adapterId === 'webhook'
                  ? 'Webhook 接口'
                  : '本地文件导出'}
            （可在「接入配置」中切换）
          </span>
        </div>
      </div>
    </div>
  )
}

function FieldRow({ label, required, children }) {
  return (
    <div className="flex items-center">
      <label
        className="w-28 text-sm px-3 py-1.5 rounded text-right"
        style={{ backgroundColor: '#C7EDCC', fontFamily: 'Microsoft YaHei' }}
      >
        {label}：{required && <span className="text-red-400">*</span>}
      </label>
      <div className="flex-1 flex gap-2 items-center">{children}</div>
    </div>
  )
}
