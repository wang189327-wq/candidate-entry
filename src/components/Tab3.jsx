import { useState, useEffect, useRef } from 'react'
import { generateAllSampleImages } from '../utils/generateImages.jsx'
import { sb } from '../lib/supabase'

// Tab3：图片库
export default function Tab3() {
  const [imageList, setImageList] = useState([])
  const [selectedKey, setSelectedKey] = useState(null)
  const [previewFull, setPreviewFull] = useState(false)
  const [detailText, setDetailText] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef()

  useEffect(() => {
    const imgs = generateAllSampleImages()
    // 预设图片（不可删）
    const presets = [
      { key: 'common', label: '常用图片', src: imgs.common },
      { key: 'superCang', label: '超级仓门面', src: imgs.superCang },
    ]
    for (let i = 1; i <= 6; i++) {
      const k = `SAP00${i}`
      presets.push({ key: k, label: k, src: imgs[k] })
    }
    setImageList(presets)
    setSelectedKey('common')
    loadCloudImages()
  }, [])

  async function loadCloudImages() {
    const { data } = await sb.from('images').select('*').order('created_at', { ascending: false })
    if (data) {
      const cloudItems = data.map((img) => ({
        key: img.id,
        label: img.name,
        src: img.url,
        uploaded: true,
        sap_code: img.sap_code,
      }))
      setImageList((prev) => {
        const presets = prev.filter((i) => !i.uploaded)
        return [...presets, ...cloudItems]
      })
    }
  }

  function handleSelect(key) {
    setSelectedKey(key)
    setPreviewFull(false)
    const item = imageList.find((i) => i.key === key)
    if (!item) return
    if (item.key === 'common') {
      setDetailText('')
    } else if (item.uploaded) {
      setDetailText(item.sap_code ? `上传图片 - ${item.sap_code} - ${item.label}` : `上传图片 - ${item.label}`)
    } else {
      setDetailText(`门店示例图片 - ${key}`)
    }
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)

    const user = JSON.parse(localStorage.getItem('portfolio_user') || '{}')

    for (const file of files) {
      try {
        // 清理文件名：去掉路径和特殊字符，只保留文件名
        const cleanName = file.name.replace(/^[A-Za-z]:\\[^\\]+\\/, '').replace(/[\\/]/g, '_')
        const filePath = `${Date.now()}_${cleanName}`

        const { error: uploadError } = await sb.storage.from('images').upload(filePath, file, { upsert: true })
        if (uploadError) throw uploadError

        // 手动拼接 public URL（避免 SDK 返回 null）
        const publicUrl = `https://zwzaultkadnoglwkvnrs.supabase.co/storage/v1/object/public/images/${filePath}`

        const { error: insertError } = await sb.from('images').insert({
          name: file.name,
          url: publicUrl,
          sap_code: '',
          created_by: user.username || 'unknown',
        })
        if (insertError) throw insertError
      } catch (err) {
        alert(`上传失败：${file.name}\n${err.message}`)
      }
    }

    setUploading(false)
    await loadCloudImages()
    e.target.value = ''
  }

  async function handleDelete(key) {
    const item = imageList.find((i) => i.key === key)
    if (!item) return
    if (!confirm(`确定删除「${item.label}」吗？`)) return

    if (item.uploaded) {
      // 从云端删除
      const { error } = await sb.from('images').delete().eq('id', key)
      if (error) {
        alert('删除失败：' + error.message)
        return
      }
      // 从 storage 删除（用路径提取文件名）
      const filename = item.src.split('/images/')[1]
      if (filename) await sb.storage.from('images').remove([filename])
    }

    setImageList((prev) => prev.filter((i) => i.key !== key))
    if (selectedKey === key) setSelectedKey(null)
  }

  const selected = imageList.find((i) => i.key === selectedKey)

  return (
    <div className="flex gap-4 p-4 h-full" style={{ minHeight: 'calc(100vh - 110px)' }}>
      {/* 左侧列表 */}
      <div className="w-56 bg-white rounded border border-gray-200 flex flex-col">
        <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100">
          <span className="text-sm font-bold text-purple">图片列表</span>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs px-2 py-0.5 rounded text-white disabled:opacity-50"
            style={{ backgroundColor: '#A8D4A8' }}
          >
            {uploading ? '上传中…' : '上传'}
          </button>
          <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} />
        </div>
        <div className="flex-1 overflow-auto py-1">
          {/* 上传图片（云端） */}
          {imageList.filter((i) => i.uploaded).length > 0 && (
            <div className="px-4 py-1 text-xs text-gray-400 uppercase tracking-wide mt-1">已上传</div>
          )}
          {imageList
            .filter((i) => i.uploaded)
            .map((item) => (
              <div key={item.key} className="relative group">
                <button
                  onClick={() => handleSelect(item.key)}
                  className={`w-full text-left px-4 py-1.5 text-xs transition ${
                    selectedKey === item.key ? 'bg-styleBtn text-white' : 'hover:bg-indigo-50'
                  }`}
                >
                  {item.label}
                </button>
                <button
                  onClick={() => handleDelete(item.key)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition"
                >
                  ✕
                </button>
              </div>
            ))}
          <div className="px-4 py-1 text-xs text-gray-400 uppercase tracking-wide mt-2">示例图片</div>
          {imageList
            .filter((i) => !i.uploaded)
            .map((item) => (
              <button
                key={item.key}
                onClick={() => handleSelect(item.key)}
                className={`w-full text-left px-4 py-1.5 text-xs transition ${
                  selectedKey === item.key ? 'bg-styleBtn text-white' : 'hover:bg-indigo-50'
                }`}
              >
                {item.label}
              </button>
            ))}
        </div>
      </div>

      {/* 右侧预览 */}
      <div className="flex-1 bg-white rounded border border-gray-200 flex flex-col overflow-hidden">
        <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100">
          <span className="text-sm font-bold text-purple">详情描述</span>
          {selected?.sap_code && <span className="text-xs text-gray-400">{selected.sap_code}</span>}
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
          {selected?.uploaded && (
            <button
              onClick={() => selected && handleDelete(selected.key)}
              className="px-4 py-1.5 rounded text-xs text-white transition"
              style={{ backgroundColor: '#FFCCCC' }}
            >
              删除
            </button>
          )}
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
