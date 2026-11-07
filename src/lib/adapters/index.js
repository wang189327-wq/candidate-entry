// 写入目标注册表
//
// 设计目标：把「识别」与「写入」彻底解耦 ——
// 解析逻辑只负责产出标准记录，写入目标由用户在「接入配置」中自由切换。
// 新增一个目标系统只需实现 { id, name, fields, write(), test() } 并注册到这里。
import { supabaseAdapter } from './supabase'
import { feishuAdapter } from './feishu'
import { webhookAdapter } from './webhook'
import { localAdapter } from './local'

export const ADAPTERS = [supabaseAdapter, feishuAdapter, webhookAdapter, localAdapter]

export const DEFAULT_ADAPTER_ID = 'supabase'
const STORAGE_KEY = 'integration_config'

export function getAdapter(id) {
  return ADAPTERS.find((a) => a.id === id) || ADAPTERS.find((a) => a.id === DEFAULT_ADAPTER_ID)
}

// localStorage 存储结构：{ adapterId: 当前生效目标, configs: { 目标id: 该目标的参数 } }
// 每个目标的参数彼此隔离 —— 切换目标再切回来，之前填的参数还在；
// 保存一个目标的参数也不会覆盖其他目标（旧版单配置结构会互相冲掉）。
function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const saved = JSON.parse(raw)
    if (!saved || typeof saved !== 'object') return {}
    // 兼容旧版单配置结构 { adapterId, config } → 迁移为按目标隔离的 configs
    if (!saved.configs && saved.config && typeof saved.config === 'object') {
      saved.configs = { [saved.adapterId || DEFAULT_ADAPTER_ID]: saved.config }
    }
    return saved
  } catch {
    return {}
  }
}

function writeAll(all) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

// 读取当前生效的接入配置（适配器 id + 该适配器自己的参数）
export function loadIntegration() {
  const all = readAll()
  const adapterId = getAdapter(all.adapterId).id
  return {
    adapterId,
    config: all.configs?.[adapterId] || {},
  }
}

export function saveIntegration(adapterId, config) {
  const all = readAll()
  all.adapterId = adapterId
  all.configs = { ...(all.configs || {}), [adapterId]: config }
  writeAll(all)
  // 通知同页其他组件（Tab1）写入目标已变更（非浏览器环境跳过）
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('integration-changed', { detail: { adapterId } }))
  }
}

// 订阅写入目标变更（供 Tab1 等组件实时刷新按钮文案）
export function onIntegrationChange(handler) {
  const listener = (e) => handler(e.detail?.adapterId)
  window.addEventListener('integration-changed', listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener('integration-changed', listener)
    window.removeEventListener('storage', listener)
  }
}

// 写入一条候选人记录：按当前配置路由到对应适配器
export async function writeCandidate(record) {
  const { adapterId, config } = loadIntegration()
  const adapter = getAdapter(adapterId)
  try {
    const res = await adapter.write(record, config)
    return { ...res, adapterId: adapter.id, adapterName: adapter.name }
  } catch (e) {
    return { ok: false, message: '写入异常：' + (e?.message || e), adapterId: adapter.id, adapterName: adapter.name }
  }
}

// 写入按钮上的文案：随目标系统变化
export function writeButtonLabel(adapterId) {
  switch (adapterId) {
    case 'feishu':
      return '写入飞书'
    case 'webhook':
      return '发送到接口'
    case 'local':
      return '导出文件'
    default:
      return '录入云端'
  }
}
