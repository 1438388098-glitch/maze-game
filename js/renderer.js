/* ── MazeRenderer: full Canvas drawing pipeline ── */

import { FOG_R, SKIN_PALETTES } from './config.js'
import { cellKey, gridSize } from './util.js'

export class MazeRenderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.cs = 0; this.ox = 0; this.oy = 0; this.cl = 0; this.sz = 0
  }

  _clrs() {
    const skin = document.documentElement.getAttribute('data-skin') || 'default'
    const theme = document.documentElement.getAttribute('data-theme')
    const isDark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme:dark)').matches)
    const p = SKIN_PALETTES[skin] || SKIN_PALETTES.default
    return p[isDark ? 'dark' : 'light']
  }

  resize(cells) {
    this.cl = cells
    this.sz = gridSize(cells)
    const wrap = document.getElementById('canvas-wrap')
    const w = Math.max(1, wrap.clientWidth)
    const h = Math.max(1, wrap.clientHeight)
    const dpr = devicePixelRatio || 1
    this.cs = Math.floor(Math.min(w, h) / this.sz)
    if (this.cs < 3) this.cs = 3
    const s = Math.min(w, h, this.sz * this.cs)
    this.canvas.width = s * dpr
    this.canvas.height = s * dpr
    this.canvas.style.width = s + 'px'
    this.canvas.style.height = s + 'px'
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.ox = Math.floor((s - this.sz * this.cs) / 2)
    this.oy = Math.floor((s - this.sz * this.cs) / 2)
  }

  render(grid, pc, ghostPath, hintPath, diff, opts) {
    const ctx = this.ctx, cs = this.cs, ox = this.ox, oy = this.oy, sz = this.sz, C = this._clrs()
    const bgW = this.canvas.width / (devicePixelRatio || 1)
    const bgH = this.canvas.height / (devicePixelRatio || 1)
    // Destructure grouped opts
    const fog = opts.fog || {}
    const ghost = opts.ghost || {}
    const collapse = opts.collapse || {}
    const effects = opts.effects || {}
    const markers = opts.markers || {}
    const ghostOn = ghost.on !== false

    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, bgW, bgH)

    const wt = diff === 'beginner' ? Math.max(2, cs * 0.5) : cs
    for (let r = 0; r < sz; r++) for (let c = 0; c < sz; c++) {
      if (grid[r][c] === 1) {
        const ins = (cs - wt) / 2
        ctx.fillStyle = C.wall
        ctx.fillRect(ox + c * cs + ins, oy + r * cs + ins, wt, wt)
      }
    }

    /* Fog of War */
    const FOG_MAX_R = fog.radius || FOG_R
    if (fog.enabled && fog.revealed && pc) {
      const px = ox + (pc.c * 2 + 1.5) * cs, py = oy + (pc.r * 2 + 1.5) * cs
      const visR = FOG_MAX_R * cs * 1.5

      // Layer 1: solid black blocks for unrevealed cells (bottom layer)
      for (let r = 0; r < this.cl; r++) for (let c = 0; c < this.cl; c++) {
        if (!fog.revealed.has(cellKey(r, c))) {
          ctx.fillStyle = '#000'
          ctx.fillRect(ox + c * 2 * cs, oy + r * 2 * cs, cs * 3, cs * 3)
        }
      }

      // Layer 2: dark overlay over entire canvas
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(0, 0, bgW, bgH)

      // Layer 3: punch torch hole via destination-out gradient
      const torchR = visR * 1.8
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      const grad = ctx.createRadialGradient(px, py, 0, px, py, torchR)
      grad.addColorStop(0, 'rgba(0,0,0,1)')
      grad.addColorStop(0.3, 'rgba(0,0,0,1)')
      grad.addColorStop(0.5, 'rgba(0,0,0,0.85)')
      grad.addColorStop(0.7, 'rgba(0,0,0,0.5)')
      grad.addColorStop(0.85, 'rgba(0,0,0,0.15)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grad
      ctx.beginPath(); ctx.arc(px, py, torchR, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }

    /* Collapse zone */
	if (collapse.zone && collapse.zone.size > 0) {
	  for (const ck of collapse.zone) {
	    const [cr, cc] = ck.split(',').map(Number)
	    const cx = ox + (cc * 2 + 1) * cs
	    const cy = oy + (cr * 2 + 1) * cs
	    ctx.fillStyle = 'rgba(180, 40, 40, 0.7)'
	    ctx.fillRect(cx - cs * 0.8, cy - cs * 0.8, cs * 2.6, cs * 2.6)
	    ctx.strokeStyle = 'rgba(200, 60, 60, 0.4)'
	    ctx.lineWidth = 1
	    ctx.beginPath()
	    ctx.moveTo(cx - cs * 0.5, cy - cs * 0.5)
	    ctx.lineTo(cx + cs * 0.3, cy + cs * 0.2)
	    ctx.lineTo(cx + cs * 0.6, cy - cs * 0.3)
	    ctx.stroke()
	  }
	}
	/* Collapse flash */
	if (collapse.flash && performance.now() - collapse.flash < 400) {
	  const elapsed = performance.now() - collapse.flash
	  const alpha = 0.3 + 0.4 * Math.sin(elapsed / 25)
	  ctx.save()
	  ctx.strokeStyle = 'rgba(255, 50, 50, ' + alpha + ')'
	  ctx.lineWidth = 3
	  ctx.strokeRect(2, 2, bgW - 4, bgH - 4)
	  ctx.restore()
	}

	/* Gems */
    if (markers.gems && markers.gemCollected) {
      for (const ck of markers.gems) {
        if (markers.gemCollected.has(ck)) continue
        const [cr, cc] = ck.split(',').map(Number)
        const gx = ox + (cc * 2 + 1.5) * cs, gy = oy + (cr * 2 + 1.5) * cs
        ctx.fillStyle = C.gem || '#ffeb3b'
        ctx.beginPath(); ctx.arc(gx, gy, Math.max(2, cs * 0.22), 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.4)'
        ctx.beginPath(); ctx.arc(gx - cs * 0.06, gy - cs * 0.06, Math.max(1, cs * 0.08), 0, Math.PI * 2); ctx.fill()
      }
    }

    /* Breadcrumb */
    if (opts.breadcrumb && opts.breadcrumb.length > 1) {
      ctx.strokeStyle = C.accent.replace(')', ',0.18)').replace('rgb', 'rgba')
      ctx.lineWidth = Math.max(1.5, cs * 0.12)
      ctx.beginPath()
      for (let i = 0; i < opts.breadcrumb.length; i++) {
        const p = opts.breadcrumb[i]; const px = ox + (p.c * 2 + 1.5) * cs, py = oy + (p.r * 2 + 1.5) * cs
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.stroke()
    }

    /* Hint path */
    if (hintPath && hintPath.length > 0) {
      ctx.strokeStyle = C.accent.replace(')', ',0.4)').replace('rgb', 'rgba')
      ctx.lineWidth = Math.max(1.5, cs * 0.15)
      ctx.setLineDash([cs * 0.5, cs * 0.3])
      ctx.beginPath()
      for (let i = 0; i < hintPath.length; i++) {
        const p = hintPath[i]; const px = ox + (p.c * 2 + 1.5) * cs, py = oy + (p.r * 2 + 1.5) * cs
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.stroke(); ctx.setLineDash([])
    }

    /* Backtrack trail */
    if (effects.backtrackTrail && effects.backtrackTrail.length > 0) {
      ctx.strokeStyle = C.accent.replace(')', ',0.5)').replace('rgb', 'rgba')
      ctx.lineWidth = cs * 0.2
      ctx.beginPath()
      for (let i = 0; i < effects.backtrackTrail.length; i++) {
        const p = effects.backtrackTrail[i]; const px = ox + (p.c * 2 + 1.5) * cs, py = oy + (p.r * 2 + 1.5) * cs
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.stroke()
    }

    /* Start marker */
    if (markers.startCell) {
      const ss = cs * 0.4
      const sx = ox + (markers.startCell.c * 2 + 1.5) * cs, sy = oy + (markers.startCell.r * 2 + 1.5) * cs
      ctx.fillStyle = C.start
      ctx.beginPath()
      ctx.moveTo(sx - ss, sy - ss * 0.7); ctx.lineTo(sx - ss, sy + ss * 0.7)
      ctx.lineTo(sx + ss * 0.7, sy); ctx.closePath(); ctx.fill()
    } else {
      const ss = cs * 0.4; const sx = ox + 1.5 * cs, sy = oy + 1.5 * cs
      ctx.fillStyle = C.start; ctx.beginPath()
      ctx.moveTo(sx - ss, sy - ss * 0.7); ctx.lineTo(sx - ss, sy + ss * 0.7)
      ctx.lineTo(sx + ss * 0.7, sy); ctx.closePath(); ctx.fill()
    }

    /* End marker (locked/unlocked) with pulsing glow */
    const endLocked = markers.endLocked, endClr = endLocked ? '#888' : C.end
    const endCX = markers.endCell ? markers.endCell.c * 2 + 1.5 : sz - 2 + 0.5
    const endCY = markers.endCell ? markers.endCell.r * 2 + 1.5 : sz - 2 + 0.5
    const ex2 = ox + endCX * cs, ey2 = oy + endCY * cs
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 250)

    // Glow ring
    if (!endLocked) {
      ctx.save()
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(performance.now() / 200)
      ctx.fillStyle = C.end
      for (let d = 2; d >= 0; d--) {
        const r = cs * (0.7 + d * 0.25) * pulse
        ctx.beginPath(); ctx.arc(ex2, ey2, r, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()

      // Outer beam
      ctx.save()
      ctx.globalAlpha = 0.12 * (0.5 + 0.5 * Math.sin(performance.now() / 300))
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.arc(ex2, ey2, cs * 1.2, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }

    // Flag body
    const es2 = cs * 0.55 * pulse
    ctx.fillStyle = endClr
    ctx.beginPath()
    ctx.moveTo(ex2 - es2, ey2 - es2); ctx.lineTo(ex2 + es2, ey2 - es2)
    ctx.lineTo(ex2 + es2, ey2 + es2 * 0.15)
    ctx.lineTo(ex2 + es2 * 0.1, ey2 + es2 * 0.3)
    ctx.lineTo(ex2, ey2 + es2 * 0.1)
    ctx.lineTo(ex2 - es2 * 0.1, ey2 + es2 * 0.3)
    ctx.lineTo(ex2 - es2, ey2 + es2 * 0.15)
    ctx.closePath(); ctx.fill()

    // Label "E"
    ctx.fillStyle = '#fff'
    ctx.font = 'bold ' + (cs * 0.4) + 'px "Noto Serif SC",Georgia,serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('E', ex2, ey2 - es2 * 0.2)

    if (endLocked) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.font = cs * 0.55 + 'px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('\u{1F512}', ex2, ey2)
    }

    /* Shake */
    let sx = 0, sy2 = 0
    if (effects.shakeTime && performance.now() - effects.shakeTime < 40) {
      const i = 3; sx = (Math.random() - 0.5) * i * 2; sy2 = (Math.random() - 0.5) * i * 2
    }

    /* Ghost trail (ctrl-btn feature) */
	if (ghostOn && ghostPath && ghostPath.length > 1) {
	  const _C = this._clrs()
	  ctx.strokeStyle = _C.accent.replace(')', ',0.12)').replace('rgb', 'rgba')
	  ctx.lineWidth = Math.max(1, cs * 0.08)
	  ctx.setLineDash([cs * 0.3, cs * 0.25])
	  ctx.beginPath()
	  for (let i = 0; i < ghostPath.length; i++) {
	    const p = ghostPath[i]; const px = ox + (p.c * 2 + 1.5) * cs, py = oy + (p.r * 2 + 1.5) * cs
	    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
	  }
	  ctx.stroke(); ctx.setLineDash([])
	}

	/* Ghost race mode */
	if (ghost.pos && ghost.data) {
	  const gp = ghost.pos
	  const gx = ox + (gp.c * 2 + 1.5) * cs
	  const gy = oy + (gp.r * 2 + 1.5) * cs
	  const C = this._clrs()
	  const ghostColor = ghost.isPerfect ? '#888' : C.gold

	  // Ghost trail
	  ctx.save()
	  ctx.globalAlpha = 0.15
	  ctx.strokeStyle = ghostColor
	  ctx.lineWidth = Math.max(1, cs * 0.08)
	  ctx.setLineDash([cs * 0.3, cs * 0.3])
	  ctx.beginPath()
	  for (let i = 0; i < ghost.data.path.length; i++) {
	    const p = ghost.data.path[i]
	    const px = ox + (p.c * 2 + 1.5) * cs
	    const py = oy + (p.r * 2 + 1.5) * cs
	    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
	  }
	  ctx.stroke()
	  ctx.restore()

	  // Ghost body
	  ctx.save()
	  ctx.globalAlpha = 0.3 + 0.1 * Math.sin(performance.now() / 300)
	  ctx.fillStyle = ghostColor
	  ctx.beginPath()
	  ctx.arc(gx, gy, cs * 0.35, 0, Math.PI * 2)
	  ctx.fill()
	  ctx.globalAlpha = 0.12
	  ctx.beginPath()
	  ctx.arc(gx, gy, cs * 0.55, 0, Math.PI * 2)
	  ctx.fill()
	  ctx.restore()
	}

	/* Player */
    if (pc) {
      let dr = pc.r, dc = pc.c
      if (effects.lerpFrom) {
        const t = Math.min(1, (performance.now() - effects.lerpStart) / 60)
        dr = effects.lerpFrom.r + (pc.r - effects.lerpFrom.r) * t
        dc = effects.lerpFrom.c + (pc.c - effects.lerpFrom.c) * t
      }
      const px = ox + (dc * 2 + 1.5) * cs + sx, py = oy + (dr * 2 + 1.5) * cs + sy2
      const pr = cs * 0.38

      ctx.fillStyle = C.accent.replace(')', ',0.22)').replace('rgb', 'rgba')
      ctx.beginPath(); ctx.arc(px, py, pr * 1.6, 0, Math.PI * 2); ctx.fill()

      ctx.fillStyle = C.accent
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill()

      if (effects.wallFlashTime && performance.now() - effects.wallFlashTime < 150) {
        const a = (1 - (performance.now() - effects.wallFlashTime) / 150) * 0.5
        ctx.fillStyle = 'rgba(229,57,53,' + a + ')'
        ctx.beginPath(); ctx.arc(px, py, pr * 2.4, 0, Math.PI * 2); ctx.fill()
      }
    }
  }

  renderMinimap(grid, pc, cells, sc, ec, gems, collected, endLocked) {
    const mc = document.getElementById('minimap-canvas')
    if (!mc) return
    const gs = gridSize(cells)
    const sl = Math.floor(120 / gs)
    const cw = gs * sl
    mc.width = cw; mc.height = cw
    mc.style.width = cw + 'px'; mc.style.height = cw + 'px'
    const ctx = mc.getContext('2d'), C = this._clrs()

    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, cw, cw)
    for (let r = 0; r < gs; r++) for (let c = 0; c < gs; c++) {
      if (grid[r][c] === 1) { ctx.fillStyle = C.wall; ctx.fillRect(c * sl, r * sl, sl, sl) }
    }

    if (gems) for (const ck of gems) {
      if (collected && collected.has(ck)) continue
      const [cr, cc] = ck.split(',').map(Number)
      ctx.fillStyle = C.gem || '#ffeb3b'
      ctx.fillRect((cc * 2 + 1) * sl, (cr * 2 + 1) * sl, Math.max(1, sl), Math.max(1, sl))
    }

    if (pc) {
      ctx.fillStyle = C.accent
      ctx.fillRect((pc.c * 2 + 1) * sl, (pc.r * 2 + 1) * sl, Math.max(2, sl), Math.max(2, sl))
    }

    ctx.fillStyle = C.start
    ctx.fillRect(((sc ? sc.c : 0) * 2 + 1) * sl, ((sc ? sc.r : 0) * 2 + 1) * sl, Math.max(1, sl - 1), Math.max(1, sl - 1))

    ctx.fillStyle = endLocked ? '#888' : C.end
    ctx.fillRect(((ec ? ec.c : cells - 1) * 2 + 1) * sl, ((ec ? ec.r : cells - 1) * 2 + 1) * sl, Math.max(1, sl - 1), Math.max(1, sl - 1))
  }
}
