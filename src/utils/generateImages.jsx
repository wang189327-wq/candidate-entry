// Canvas 生成示例图片（手机号截图 + 门面图）
// 返回 base64 data URL

function canvasToDataURL(canvas) {
  return canvas.toDataURL('image/png')
}

// 生成手机号截图
export function generatePhoneImage(sapCode, storeName, phoneNumber) {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 180
  const ctx = canvas.getContext('2d')

  // 背景
  ctx.fillStyle = '#F0F5EC'
  ctx.fillRect(0, 0, 320, 180)

  // 顶部色条
  ctx.fillStyle = '#A8D4A8'
  ctx.fillRect(0, 0, 320, 8)

  // SAP 代码标签
  ctx.fillStyle = '#7755CC'
  ctx.font = 'bold 13px Microsoft YaHei'
  ctx.fillText(sapCode, 12, 32)

  // 门店名称
  ctx.fillStyle = '#333'
  ctx.font = '12px Microsoft YaHei'
  ctx.fillText(storeName, 12, 54)

  // 分隔线
  ctx.strokeStyle = '#A8D4A8'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(12, 68)
  ctx.lineTo(308, 68)
  ctx.stroke()

  // 手机号标签
  ctx.fillStyle = '#666'
  ctx.font = '11px Microsoft YaHei'
  ctx.fillText('店长手机号', 12, 90)

  // 手机号（大字）
  ctx.fillStyle = '#1a1a1a'
  ctx.font = 'bold 26px Microsoft YaHei'
  ctx.fillText(phoneNumber, 12, 126)

  // 底部装饰线
  ctx.fillStyle = '#D5EDD8'
  ctx.fillRect(0, 170, 320, 10)

  return canvasToDataURL(canvas)
}

// 生成固定图片 1.png（模拟常用图片/二维码）
export function generateCommonImage() {
  const canvas = document.createElement('canvas')
  canvas.width = 240
  canvas.height = 240
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#E8F5E9'
  ctx.fillRect(0, 0, 240, 240)

  // 二维码格子图案（模拟）
  const blockSize = 20
  const margin = 30
  ctx.fillStyle = '#333'
  for (let x = margin; x < 240 - margin; x += blockSize) {
    for (let y = margin; y < 240 - margin; y += blockSize) {
      if (Math.random() > 0.5) {
        ctx.fillRect(x, y, blockSize - 2, blockSize - 2)
      }
    }
  }

  // 中心三个定位方块
  const pos = [
    [margin, margin],
    [240 - margin - blockSize * 3, margin],
    [margin, 240 - margin - blockSize * 3],
  ]
  ctx.fillStyle = '#333'
  pos.forEach(([px, py]) => {
    ctx.fillRect(px, py, blockSize * 3, blockSize * 3)
    ctx.fillStyle = '#E8F5E9'
    ctx.fillRect(px + 4, py + 4, blockSize * 3 - 8, blockSize * 3 - 8)
    ctx.fillStyle = '#333'
    ctx.fillRect(px + 8, py + 8, blockSize * 3 - 16, blockSize * 3 - 16)
  })

  return canvasToDataURL(canvas)
}

// 生成超级仓门面图
export function generateSuperCangImage() {
  const canvas = document.createElement('canvas')
  canvas.width = 480
  canvas.height = 320
  const ctx = canvas.getContext('2d')

  // 天空
  ctx.fillStyle = '#D0E8FF'
  ctx.fillRect(0, 0, 480, 320)

  // 地面
  ctx.fillStyle = '#C8D8C0'
  ctx.fillRect(0, 240, 480, 80)

  // 建筑主体
  ctx.fillStyle = '#F5F0E8'
  ctx.fillRect(60, 80, 360, 160)

  // 屋顶
  ctx.fillStyle = '#A8C8A8'
  ctx.beginPath()
  ctx.moveTo(40, 80)
  ctx.lineTo(240, 30)
  ctx.lineTo(440, 80)
  ctx.closePath()
  ctx.fill()

  // 店招
  ctx.fillStyle = '#7755CC'
  ctx.fillRect(80, 90, 320, 40)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 18px Microsoft YaHei'
  ctx.fillText('超级仓', 190, 118)

  // 门
  ctx.fillStyle = '#8B6914'
  ctx.fillRect(190, 160, 100, 80)
  ctx.fillStyle = '#C8A060'
  ctx.fillRect(195, 165, 90, 70)

  // 窗户
  ctx.fillStyle = '#B8D8FF'
  ctx.fillRect(80, 110, 80, 50)
  ctx.fillRect(320, 110, 80, 50)
  ctx.strokeStyle = '#888'
  ctx.lineWidth = 2
  ctx.strokeRect(80, 110, 80, 50)
  ctx.strokeRect(320, 110, 80, 50)

  return canvasToDataURL(canvas)
}

// 预设的 6 张 SAP 图片数据
const PHONE_NUMBERS = [
  '138-0011-2233',
  '139-4455-6677',
  '150-7788-9900',
  '151-1122-3344',
  '152-5566-7788',
  '153-9900-1122',
]
const STORE_NAMES = ['广州正佳广场店', '深圳万象城店', '成都春熙路店', '上海环球港店', '广州天河城店', '深圳海岸城店']

export function generateAllSampleImages() {
  const images = {}
  for (let i = 1; i <= 6; i++) {
    const key = `SAP00${i}`
    images[key] = generatePhoneImage(key, STORE_NAMES[i - 1], PHONE_NUMBERS[i - 1])
  }
  images['common'] = generateCommonImage()
  images['superCang'] = generateSuperCangImage()
  return images
}
