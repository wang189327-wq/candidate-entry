// 适配器统一契约
//
// 每个适配器导出以下结构，便于新增目标系统：
// {
//   id: 'webhook',
//   name: '通用 Webhook',
//   desc: '...',
//   fields: [{ key, label, placeholder, type, hint }],  // 配置表单字段定义
//   write(record, config): Promise<{ ok, message }>,  // 写入一条候选人记录
//   test(config): Promise<{ ok, message }>,            // 连通性测试
// }
//
// record 标准字段：姓名 / 年龄 / 性别 / 联系方式 / SAP代码 / 意向岗位 / 门店名称

export const RECORD_FIELDS = ['姓名', '年龄', '性别', '联系方式', 'SAP代码', '意向岗位', '门店名称']

// 把标准记录转成「姓名：xxx｜年龄：xx｜…」的可读文本
export function recordToText(record, sep = '｜') {
  return RECORD_FIELDS
    .map(k => (record[k] ? `${k}：${record[k]}` : null))
    .filter(Boolean)
    .join(sep)
}

// 把标准记录转成 { 姓名: 'xxx', ... } 形态的扁平对象（去掉空值）
export function recordToObject(record) {
  const out = {}
  Object.keys(record).forEach(k => {
    if (record[k] !== '' && record[k] !== undefined && record[k] !== null) out[k] = record[k]
  })
  return out
}
