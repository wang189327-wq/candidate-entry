// 初始 SAP 配置数据（与原桌面工具一致）
export const INITIAL_SAP_CONFIG = {
  '企划实习生（广州）': { sap: 'SAP001', city: '广州', published: '是', note: '' },
  '企划实习生（深圳）': { sap: 'SAP002', city: '深圳', published: '是', note: '' },
  '设计实习生（广州）': { sap: 'SAP003', city: '广州', published: '是', note: '' },
  '设计实习生（成都）': { sap: 'SAP004', city: '成都', published: '否', note: '' },
  '费用实习生（广州）': { sap: 'SAP005', city: '广州', published: '是', note: '' },
  '费用实习生（上海）': { sap: 'SAP006', city: '上海', published: '是', note: '' },
  '招聘实习生（广州）': { sap: 'SAP007', city: '广州', published: '是', note: '' },
}

export const INITIAL_ACCOUNTS = [
  {
    alias: '王馨梅',
    app_id: 'cli_a97af88467781bcb',
    app_secret: 'Ypg1jnWwrDDZU3CQ1okOKAQPVzi7paKC',
    app_token: 'FuB2bd5ovazQPPsJEdTc9xovn3v',
    active: true,
  },
]

// 虚拟门店名称列表（用于示例聊天记录）
export const SAMPLE_STORES = [
  '广州正佳广场店',
  '深圳万象城店',
  '成都春熙路店',
  '上海环球港店',
]

// 随机挑一个门店
export function randomStore() {
  return SAMPLE_STORES[Math.floor(Math.random() * SAMPLE_STORES.length)]
}