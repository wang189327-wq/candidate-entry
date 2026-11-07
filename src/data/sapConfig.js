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

// 初始飞书账号（占位示例，真实凭证在 Tab4 中由用户自行配置，仅存于本地/云端自己的账号体系）
export const INITIAL_ACCOUNTS = [
  {
    alias: '示例账号（请填入你自己的飞书应用凭证）',
    app_id: 'cli_xxxxxxxxxxxxxxxx',
    app_secret: 'your_app_secret_here',
    app_token: 'your_bitable_app_token_here',
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