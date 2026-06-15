import { useState } from 'react'
import Tab1 from './components/Tab1'
import Tab2 from './components/Tab2'
import Tab3 from './components/Tab3'
import Tab4 from './components/Tab4'

const TAB_COMPONENTS = [Tab1, Tab2, Tab3, Tab4]
const TAB_LABELS = ['信息识别', 'SAP代码管理', '图片库', '飞书账号']

export default function App() {
  const [activeTab, setActiveTab] = useState(0)
  const ActiveComponent = TAB_COMPONENTS[activeTab]

  return (
    <div className="min-h-screen bg-styleBg flex flex-col">
      {/* 顶部标题 */}
      <div className="bg-white border-b border-styleBtn px-6 py-3 flex items-center justify-between shadow-sm">
        <h1 className="text-lg font-bold text-purple" style={{ fontFamily: 'Microsoft YaHei' }}>
          门店求职者信息录入
        </h1>
        <span className="text-xs text-gray-400">Web 原型演示版</span>
      </div>

      {/* Tab 导航 */}
      <div className="bg-white border-b border-styleBg2 px-6">
        <div className="flex gap-1">
          {TAB_LABELS.map((label, i) => (
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
          ))}
        </div>
      </div>

      {/* Tab 内容 */}
      <div className="flex-1 overflow-auto">
        <ActiveComponent />
      </div>
    </div>
  )
}