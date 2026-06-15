import { useState, useEffect, useRef } from 'react'
import { generateAllSampleImages } from '../utils/generateImages.jsx'

// Tab3：图片库
export default function Tab3() {
  const [sampleImages, setSampleImages] = useState(null)
  const [imageList, setImageList] = useState([])
  const [selectedKey, setSelectedKey] = useState(null)
  const [previewFull, setPreviewFull] = useState(false)
  const [detailText, setDetailText] = useState('')
  const fileInputRef = useRef()

  useEffect(() => {
    const imgs = generateAllSampleImages()
    setSampleImages(imgs)
    const list = [
      { key: 'common', label: '常用图片', src: imgs.common },
      { key: 'superCang', label: '超级仓门面', src: imgs.superCang },
    ]
    for (let i = 1; i <= 6; i++) {
      const k = `SAP00${i}`
      list.push({ key: k, label: k, src: imgs[k] })
    }
    setImageList(list)
    setSelectedKey('common')
  }, [])

  function handleSelect(key) {
    setSelectedKey(key)
    setPreviewFull(false)
    // 详情面板文字
    if (key === 'common') {
      setDetailText('')
    } else {
      setDetailText(`门店示例图片 - ${key}`)
    }
  }

  function handleUpload(e) {
    const files = Array.from(e.target.files)
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        setImageList(prev => [...prev, {
          key: `upload_${Date.now()}_${file.name}`,
          label: file.name,
          src: ev.target.result,
          uploaded: true,
        }])
      }
      reader.readAsDataURL(file)
    })
  }

  function handleDelete(key) {
    if (!confirm(`确定删除「${key}」吗？`)) return
    setImageList(prev => prev.filter(item => item.key !== key))
    if (selectedKey === key) setSelectedKey(null)
  }

  const selected = imageList.find(i => i.key === selectedKey)

  return (
    <div className="flex gap-4 p-4 h-full" style={{ minHeight: 'calc(100vh - 110px)' }}>
      {/* 左侧列表 */}
      <div className="w-56 bg-white rounded border border-gray-200 flex flex-col">
        <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100">
          <span className="text-sm font-bold text-purple">图片列表</span>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs px-2 py-0.5 rounded text-white"
            style={{ backgroundColor: '#A8D4A8' }}
          >
            上传
          </button>
          <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden"
            onChange={handleUpload} />
        </div>
        <div className="flex-1 overflow-auto py-1">
          {imageList.map(item => (
            <div key={item.key} className="relative group">
              <button
                onClick={() => handleSelect(item.key)}
                className={`w-full text-left px-4 py-1.5 text-xs transition ${
                  selectedKey === item.key
                    ? 'bg-styleBtn text-white'
                    : 'hover:bg-indigo-50'
                }`}
              >
                {item.label}
              </button>
              {item.uploaded && (
                <button
                  onClick={() => handleDelete(item.key)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 右侧预览 */}
      <div className="flex-1 bg-white rounded border border-gray-200 flex flex-col overflow-hidden">
        <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100">
          <span className="text-sm font-bold text-purple">详情描述</span>
        </div>

        {/* 预览大图 */}
        <div
          className="flex-1 flex items-center justify-center overflow-hidden p-4 bg-white cursor-pointer"
          onClick={() => selected && setPreviewFull(true)}
        >
          {selected ? (
            <img
              src={selected.src}
              alt={selected.label}
              className="max-w-full max-h-full object-contain rounded"
              style={{ maxHeight: 420 }}
            />
          ) : (
            <span className="text-gray-300 text-sm">请选择一张图片</span>
          )}
        </div>

        {/* 详情文字 */}
        <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 min-h-[40px]">
          {detailText || (selected ? '' : '← 点击图片查看大图')}
        </div>

        {/* 操作按钮 */}
        <div className="px-4 py-3 flex gap-2 border-t border-gray-100">
          <button
            onClick={() => selected && navigator.clipboard.writeText(selected.key)}
            className="px-4 py-1.5 rounded text-xs text-white transition hover:scale-[1.02]"
            style={{ backgroundColor: '#A8D4A8' }}
          >
            复制路径
          </button>
          <button
            onClick={() => selected && navigator.clipboard.writeText(selected.src)}
            className="px-4 py-1.5 rounded text-xs text-white transition hover:scale-[1.02]"
            style={{ backgroundColor: '#A8D4A8' }}
          >
            复制图片
          </button>
          <button
            onClick={() => selected && handleDelete(selected.key)}
            className="px-4 py-1.5 rounded text-xs text-white transition"
            style={{ backgroundColor: '#FFCCCC' }}
          >
            删除
          </button>
        </div>
      </div>

      {/* 放大 Modal */}
      {previewFull && selected && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center"
          onClick={() => setPreviewFull(false)}
        >
          <img
            src={selected.src}
            alt={selected.label}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl"
          />
          <div className="absolute bottom-6 text-white text-sm">点击任意处关闭</div>
        </div>
      )}
    </div>
  )
}