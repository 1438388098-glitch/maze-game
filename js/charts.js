/* ── Charts: Canvas-based progress charts ── */

export const Charts = {
  /**
   * Draw a line chart on the given canvas element
   * @param {HTMLCanvasElement} canvas - The canvas to draw on
   * @param {Array} data - Array of { label, value } objects
   * @param {Object} opts - { color, bgColor, lineColor, min, max, label }
   */
  drawLineChart(canvas, data, opts) {
    if (!canvas || !data || data.length < 2) {
      if (canvas) {
        const ctx = canvas.getContext('2d')
        const dpr = devicePixelRatio || 1
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#999'
        ctx.font = '12px "Noto Serif SC",Georgia,serif'
        ctx.textAlign = 'center'
        ctx.fillText('数据不足', canvas.width / 2 / dpr, canvas.height / 2 / dpr)
      }
      return
    }

    // Filter out entries with invalid values
    const clean = data.filter(d => d.value != null && isFinite(d.value) && d.value >= 0)
    if (clean.length < 2) {
      const ctx = canvas.getContext('2d')
      const dpr = devicePixelRatio || 1
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#999'
      ctx.font = '12px "Noto Serif SC",Georgia,serif'
      ctx.textAlign = 'center'
      ctx.fillText('数据不足', canvas.width / 2 / dpr, canvas.height / 2 / dpr)
      return
    }
    data = clean

    const ctx = canvas.getContext('2d')
    const dpr = devicePixelRatio || 1
    const W = canvas.width / dpr
    const H = canvas.height / dpr
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const pad = { top: 8, bottom: 16, left: 8, right: 8 }
    const cw = W - pad.left - pad.right
    const ch = H - pad.top - pad.bottom

    const values = data.map(d => d.value)
    const min = opts.min != null ? opts.min : Math.min(...values) * 0.9
    const max = opts.max != null ? opts.max : Math.max(...values) * 1.1
    const range = max - min || 1

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + ch * i / 4
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(W - pad.right, y)
      ctx.stroke()
    }

    // Line
    ctx.strokeStyle = opts.color || '#D4B382'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.beginPath()
    data.forEach((d, i) => {
      const x = pad.left + cw * i / (data.length - 1)
      const y = pad.top + ch * (1 - (d.value - min) / range)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Fill area
    const last = data.length - 1
    ctx.lineTo(pad.left + cw, pad.top + ch)
    ctx.lineTo(pad.left, pad.top + ch)
    ctx.closePath()
    const fillColor = (opts.color || '#D4B382')
    ctx.fillStyle = fillColor + '14'  // ~8% opacity hex
    ctx.fill()

    // Dots
    data.forEach((d, i) => {
      const x = pad.left + cw * i / (data.length - 1)
      const y = pad.top + ch * (1 - (d.value - min) / range)
      ctx.fillStyle = opts.color || '#D4B382'
      ctx.beginPath()
      ctx.arc(x, y, 2.5, 0, Math.PI * 2)
      ctx.fill()
    })

    // X labels
    ctx.fillStyle = '#999'
    ctx.font = '9px "Noto Serif SC",Georgia,serif'
    ctx.textAlign = 'center'
    const step = Math.max(1, Math.floor(data.length / 6))
    for (let i = 0; i < data.length; i += step) {
      const x = pad.left + cw * i / (data.length - 1)
      const label = typeof data[i].label === 'string' && data[i].label.length >= 5 ? data[i].label.slice(5) : (data[i].label || '')
      ctx.fillText(label, x, H - 2)
    }
  }
}