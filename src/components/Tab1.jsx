import { useState, useEffect } from 'react'
import { parseText, lookupSapByStore, generateSampleText } from '../utils/parseText.jsx'
import { generateAllSampleImages } from '../utils/generateImages.jsx'
import { INITIAL_SAP_CONFIG, SAMPLE_STORES } from '../data/sapConfig'

// Tab1：信息识别
export default function Tab1() {
  const [rawText, setRawText] = useState('')
  const [fields, setFields] = useState({
    姓名: '',
    联系方式: '',
    年龄: '',
    性别: '女',
    'SAP代码': '',
    意向岗位: '全职',
    门店名称: '',
  })
  const [parsedData, setParsedData] = useState(null)
  const [sampleImages, setSampleImages] = useState(null)
  const [writeStatus, setWriteStatus] = useState('idle') // idle | loading | success | error
  const [sapConfig, setSapConfig] = useState(() => {
    try {
      const stored = localStorage.getItem('sap_config')
      return stored ? JSON.parse(stored) : INITIAL_SAP_CONFIG
    } catch {
      return INITIAL_SAP_CONFIG
    }
  })

  useEffect(() => {
    setSampleImages(generateAllSampleImages())
  }, [])

  function handleParse() {
    if (!rawText.trim()) {
      alert('请先粘贴聊天记录文本')
      return
    }
    const result = parseText(rawText)
    if (!result) {
      setParsedData(null)
      setFields(f => ({
        ...f,
        姓名: '',
        联系方式: '',
        年龄: '',
        门店名称: '',
        'SAP代码': '',
      }))
      alert('未能识别候选人信息，请检查格式是否正确')
      return
    }
    setParsedData(result)

    const storeName = result['门店名称'] || ''
    const sapCode = lookupSapByStore(storeName, sapConfig)

    setFields(f => ({
      ...f,
      姓名: result['姓名'] || '',
      联系方式: result['联系方式'] || '',
      年龄: result['年龄'] || '',
      门店名称: storeName,
      'SAP代码': sapCode || result['SAP代码'] || '',
    }))
  }

  function handleClear() {
    setRawText('')
    setParsedData(null)
    setFields({
      姓名: '',
      联系方式: '',
      年龄: '',
      性别: '女',
      'SAP代码': '',
      意向岗位: '全职',
      门店名称: '',
    })
  }

  function handleWriteFeishu() {
    if (!fields.姓名.trim()) {
      alert('请填写姓名')
      return
    }
    setWriteStatus('loading')
    setTimeout(() => {
      setWriteStatus('success')
      setTimeout(() => setWriteStatus('idle'), 2500)
    }, 1200)
  }

  function handleFillSample() {
    const store = SAMPLE_STORES[0]
    setRawText(generateSampleText(store))
    handleParse()
  }

  const ageVal = fields['年龄']
  const ageNum = parseInt(ageVal)
  const ageColor = ageNum >= 18 && ageNum <= 40 ? 'text-green-600' : 'text-red-500'

  const shopPhoneImg = fields['SAP代码'] && sampleImages
    ? sampleImages[fields['SAP代码']]
    : null

  return (
    <div className="flex gap-4 p-4 h-full" style={{ minHeight: 'calc(100vh - 110px)' }}>
      {/* 左侧：粘贴区 */}
      <div className="flex-1 bg-white rounded border border-gray-200 flex flex-col overflow-hidden">
        <div className="bg-indigo-50 px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-bold text-purple" style={{ fontFamily: 'Microsoft YaHei' }}>粘贴聊天记录文本</span>
          <button
            onClick={handleFillSample}
            className="text-xs text-purple hover:underline"
          >
            填充示例
          </button>
        </div>
        <textarea
          className="flex-1 p-3 text-sm resize-none outline-none border-0 focus:ring-0"
          style={{ fontFamily: 'Microsoft YaHei', minHeight: 320 }}
          placeholder={'粘贴候选人聊天记录，例如：\n门店名称\n的手机号：\n138-0000-0000\n复制手机号\n的微信号：\nwxid_xxx\n复制微信号\n年龄：\n24 岁\n沟通职位：\n企划实习生（广州正佳广场店）'}
          value={rawText}
          onChange={e => setRawText(e.target.value)}
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
        <div className="bg-indigo-50 px-4 py-2">
          <span className="text-sm font-bold text-purple" style={{ fontFamily: 'Microsoft YaHei' }}>已识别的求职者信息</span>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-2">
          {/* 姓名 */}
          <FieldRow label="姓名" required>
            <input
              className="flex-1 px-3 py-1.5 rounded text-sm border outline-none focus:border-styleBtn"
              style={{ backgroundColor: '#E8F5E9', fontFamily: 'Microsoft YaHei' }}
              value={fields['姓名']}
              onChange={e => setFields(f => ({ ...f, 姓名: e.target.value }))}
            />
          </FieldRow>

          {/* 联系方式 */}
          <FieldRow label="联系方式">
            <input
              className="flex-1 px-3 py-1.5 rounded text-sm border outline-none focus:border-styleBtn"
              style={{ backgroundColor: '#E8F5E9', fontFamily: 'Microsoft YaHei' }}
              value={fields['联系方式']}
              onChange={e => setFields(f => ({ ...f, 联系方式: e.target.value }))}
            />
          </FieldRow>

          {/* 年龄 */}
          <FieldRow label="年龄">
            <input
              className={`flex-1 px-3 py-1.5 rounded text-sm border outline-none ${ageColor}`}
              style={{
                backgroundColor: ageNum >= 18 && ageNum <= 40 ? '#F0FFF0' : '#FFF0F0',
                fontFamily: 'Microsoft YaHei',
              }}
              value={fields['年龄']}
              onChange={e => setFields(f => ({ ...f, 年龄: e.target.value }))}
            />
          </FieldRow>

          {/* 性别 */}
          <div className="flex items-center">
            <label className="w-28 text-sm px-3 py-1.5 rounded text-right" style={{ backgroundColor: '#C7EDCC', fontFamily: 'Microsoft YaHei' }}>性别：</label>
            <div className="flex gap-3">
              {['女', '男'].map(opt => (
                <label key={opt} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value={opt}
                    checked={fields['性别'] === opt}
                    onChange={e => setFields(f => ({ ...f, 性别: e.target.value }))}
                  />
                  <span className="text-sm" style={{ fontFamily: 'Microsoft YaHei' }}>{opt}</span>
                </label>
              ))}
            </div>
          </div>

          {/* SAP代码 */}
          <FieldRow label="SAP代码">
            <input
              className="flex-1 px-3 py-1.5 rounded text-sm border outline-none focus:border-styleBtn"
              style={{ backgroundColor: '#E8F5E9', fontFamily: 'Microsoft YaHei' }}
              value={fields['SAP代码']}
              onChange={e => setFields(f => ({ ...f, 'SAP代码': e.target.value }))}
            />
          </FieldRow>

          {/* 意向岗位 */}
          <div className="flex items-center">
            <label className="w-28 text-sm px-3 py-1.5 rounded text-right" style={{ backgroundColor: '#C7EDCC', fontFamily: 'Microsoft YaHei' }}>意向岗位：</label>
            <div className="flex gap-3">
              {['全职', '兼职', '店长'].map(opt => (
                <label key={opt} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="job"
                    value={opt}
                    checked={fields['意向岗位'] === opt}
                    onChange={e => setFields(f => ({ ...f, 意向岗位: e.target.value }))}
                  />
                  <span className="text-sm" style={{ fontFamily: 'Microsoft YaHei' }}>{opt}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 门店名称 */}
          <FieldRow label="门店名称">
            <input
              className="flex-1 px-3 py-1.5 rounded text-sm border outline-none focus:border-styleBtn"
              style={{ backgroundColor: '#E8F5E9', fontFamily: 'Microsoft YaHei' }}
              value={fields['门店名称']}
              onChange={e => setFields(f => ({ ...f, 门店名称: e.target.value }))}
            />
          </FieldRow>

          {/* 店长手机号图片 */}
          <div className="flex items-center">
            <label className="w-28 text-sm px-3 py-1.5 rounded text-right" style={{ backgroundColor: '#C7EDCC', fontFamily: 'Microsoft YaHei' }}>店长手机号：</label>
            <div className="flex items-center gap-3 flex-1">
              {shopPhoneImg ? (
                <img src={shopPhoneImg} alt="店长手机号" className="h-12 rounded border cursor-pointer hover:opacity-80" />
              ) : (
                <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded">（无图片）</span>
              )}
            </div>
          </div>

          {/* 常用图片 */}
          <div className="flex items-center">
            <label className="w-28 text-sm px-3 py-1.5 rounded text-right" style={{ backgroundColor: '#C7EDCC', fontFamily: 'Microsoft YaHei' }}>常用图片：</label>
            <div className="flex items-center gap-3 flex-1">
              {sampleImages?.common && (
                <img src={sampleImages.common} alt="常用图片" className="h-12 rounded border cursor-pointer hover:opacity-80" />
              )}
            </div>
          </div>

          {/* 超级仓门面 */}
          <div className="flex items-center">
            <label className="w-28 text-sm px-3 py-1.5 rounded text-right" style={{ backgroundColor: '#C7EDCC', fontFamily: 'Microsoft YaHei' }}>超级仓门面：</label>
            <div className="flex items-center gap-3 flex-1">
              {sampleImages?.superCang && (
                <img src={sampleImages.superCang} alt="超级仓门面" className="h-12 rounded border cursor-pointer hover:opacity-80" />
              )}
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-4 py-3 flex gap-3 border-t border-gray-100">
          <button
            onClick={handleWriteFeishu}
            disabled={writeStatus === 'loading' || writeStatus === 'success'}
            className={`px-6 py-2 rounded text-sm font-medium transition text-white ${
              writeStatus === 'success' ? 'bg-green-400' : 'hover:scale-[1.02]'
            }`}
            style={{ backgroundColor: writeStatus === 'success' ? '#4ade80' : '#A8D4A8' }}
          >
            {writeStatus === 'loading' ? '写入中...' : writeStatus === 'success' ? '✓ 已写入' : '写入飞书'}
          </button>
          <button
            onClick={handleClear}
            className="px-5 py-2 rounded text-sm font-medium transition hover:scale-[1.02] text-white"
            style={{ backgroundColor: '#FFCCCC' }}
          >
            清空
          </button>
        </div>
      </div>
    </div>
  )
}

function FieldRow({ label, children }) {
  return (
    <div className="flex items-center">
      <label className="w-28 text-sm px-3 py-1.5 rounded text-right" style={{ backgroundColor: '#C7EDCC', fontFamily: 'Microsoft YaHei' }}>
        {label}：
      </label>
      <div className="flex-1 flex gap-2 items-center">
        {children}
      </div>
    </div>
  )
}