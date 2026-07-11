export class Particles {
  constructor() { this.ps = []; this.r = false; this.aid = null }

  burst(c, x, y, accent) {
    const cnt = 60
    this.ps = []
    const cols = [accent, '#e53935', '#4caf50', '#ff9800', '#2196f3', '#9c27b0', '#ffeb3b']
    for (let i = 0; i < cnt; i++) {
      const ang = Math.PI * 2 * i / cnt + (Math.random() - 0.5) * 0.6
      const sp = 2 + Math.random() * 5
      this.ps.push({
        x, y, rotation: Math.random() * Math.PI * 2,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1,
        life: 1, decay: 0.008 + Math.random() * 0.02,
        size: 2 + Math.random() * 5,
        rs: (Math.random() - 0.5) * 0.3,
        color: cols[Math.floor(Math.random() * cols.length)]
      })
    }
    this.r = true; this.canvas = c; this.ctx = c.getContext('2d'); this._a()
  }

  _a() {
    if (!this.r) return
    this.ctx.save()
    const dpr = devicePixelRatio || 1
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    let alive = false
    for (const p of this.ps) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= p.decay
      p.rotation += p.rs
      if (p.life <= 0) continue
      alive = true
      this.ctx.save()
      this.ctx.translate(p.x, p.y); this.ctx.rotate(p.rotation)
      this.ctx.globalAlpha = p.life
      this.ctx.fillStyle = p.color
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
      this.ctx.restore()
    }
    this.ctx.restore()
    if (alive) this.aid = requestAnimationFrame(() => this._a())
    else { this.r = false; this.ps = [] }
  }

  stop() { this.r = false; if (this.aid) cancelAnimationFrame(this.aid); this.ps = [] }
}
