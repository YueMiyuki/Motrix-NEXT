import { APP_THEME, TRAY_CANVAS_CONFIG } from '@shared/constants'

const bytesToSize = (bytes) => {
  const b = parseInt(bytes, 10)
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  if (b === 0) {
    return '0 KB'
  }
  const i = Math.trunc(Math.floor(Math.log(b) / Math.log(1024)))
  if (i === 0) {
    return `${b} ${sizes[i]}`
  }
  return `${(b / 1024 ** i).toFixed(1)} ${sizes[i]}`
}

const { WIDTH, HEIGHT, ICON_WIDTH, ICON_HEIGHT, TEXT_WIDTH, TEXT_FONT_SIZE } = TRAY_CANVAS_CONFIG
const fontFamily = 'Arial'

export const draw = async ({
  canvas,
  theme,
  icon,
  uploadSpeed,
  downloadSpeed,
  scale,
  resultType,
}) => {
  if (!canvas) {
    throw new Error('canvas is required')
  }

  const width = WIDTH * scale
  const height = HEIGHT * scale
  const textColor = theme === APP_THEME.LIGHT ? '#000' : '#fff'
  const fontSize = TEXT_FONT_SIZE * scale + 1
  const iconWidth = ICON_WIDTH * scale
  const iconHeight = ICON_HEIGHT * scale
  const textWidth = TEXT_WIDTH * scale

  if (canvas.width !== width) {
    canvas.width = width
  }

  if (canvas.height !== height) {
    canvas.height = height
  }

  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (icon) {
    ctx.drawImage(icon, 0, 0, iconWidth, iconHeight)
  }

  ctx.font = `${fontSize}px "${fontFamily}"`
  ctx.textBaseline = 'top'
  ctx.textAlign = 'right'
  ctx.fillStyle = textColor

  ctx.fillText(`${bytesToSize(uploadSpeed)}/s`, width, 0, textWidth)
  ctx.fillText(`${bytesToSize(downloadSpeed)}/s`, width, TEXT_FONT_SIZE * scale + 0.5, textWidth)

  return transferCanvasTo(canvas, resultType)
}

const transferCanvasTo = (canvas, type) => {
  switch (type) {
    case 'DATA_URL':
      return canvas.toDataURL()
    case 'BLOB':
      return canvas.convertToBlob()
    case 'BITMAP':
      return canvas.transferToImageBitmap()
    default:
      return canvas.convertToBlob()
  }
}
