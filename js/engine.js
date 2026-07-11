/* ── GameEngine: state machine + movement logic ── */

import { DIFF, DIRS, FOG_R, TORCH_SIZES, COLLAPSE_TIME } from './config.js'
import { cellKey } from './util.js'
import { PathFinder } from './pathfinder.js'
import { MazeGen } from './maze-gen.js'
import { MazeGenV2 } from './maze-gen-v2.js'

export const STATE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', WON: 'won', FAILED: 'failed' }

export class GameEngine {
  constructor() {
    this.state = STATE.MENU
    this.diff = 'normal'
    this.cells = DIFF.normal.cells
    this.grid = null
    this.solutionPath = null
    this.pc = { r: 0, c: 0 }; this.sc = { r: 0, c: 0 }; this.ec = { r: 0, c: 0 }
    this.steps = 0; this.ph = []; this.vis = new Set()
    this.hintPath = null; this.hintOn = false
    this.ghostPath = null; this.ghostOn = false
    this.fogOn = false; this.fogR = FOG_R
    this.fogRevealed = new Set(); this.fogJustRevealed = new Set()
    this.fogRevealTime = 0
    this.bcOn = true; this.wallBumps = 0; this.btCount = 0; this.failCount = 0
    this.seed = null; this.isDaily = false
    this.mode = 'standard'
    this.gems = null; this.gemCollected = null; this.gemsTotal = 0
    this.endLocked = false; this._justGem = false; this.mazeMetrics = null
    this.isCampaign = false; this.campaignIndex = 0; this.campaignTotal = 1
    this.collapseMode = false
    this.collapsePath = []
    this.collapseHead = 0
    this.collapseTimeInterval = 10
    this.collapseTimer = 0
    this.collapseTimeLeft = 0
    this.collapseZone = new Set()
    this.collapseFlash = 0
    this.ghostData = null
    this.ghostPos = null
    this.ghostStepDiff = 0
    this.ghostIsPerfect = false
  }

  newGame(diff, chT, chS, seed, isDaily, mode, engine, campaignIdx, campaignTotal) {
    this.diff = diff; this.cells = DIFF[diff].cells
    this.seed = seed; this.isDaily = !!isDaily; this.mode = mode || 'standard'
    this.chT = chT || null; this.chS = chS || null
    this.isCampaign = campaignIdx != null; this.campaignIndex = campaignIdx || 0; this.campaignTotal = campaignTotal || 1
    const gen = engine === 'experimental' ? MazeGenV2 : MazeGen
    const res = gen.generate(this.cells, diff, seed, mode)
    this.grid = res.grid; this.solutionPath = res.solutionPath
    this.sc = res.start; this.ec = res.end
    this.mazeMetrics = res.metrics || null
    this.pc = { r: this.sc.r, c: this.sc.c }
    this.steps = 0; this.ph = [{ r: this.sc.r, c: this.sc.c }]
    this.vis = new Set([cellKey(this.sc.r, this.sc.c)])
    this.hintPath = null; this.hintOn = false
    this.ghostPath = null; this.ghostOn = false
    this.fogOn = mode === 'torch' || mode === 'torchpro'; this.fogR = FOG_R
    this.fogRevealed = new Set([cellKey(this.sc.r, this.sc.c)])
    if (this.fogOn) this._initFogRadius()
    this.fogJustRevealed = new Set(); this.fogRevealTime = 0
    this.bcOn = mode !== 'torch' && mode !== 'torchpro'
    this.wallBumps = 0; this.btCount = 0
    this.gems = res.gems
    this.gemCollected = new Set()
    this.gemsTotal = this.gems ? this.gems.size : 0
    this.endLocked = mode === 'treasure' && this.gemsTotal > 0
    this._justGem = false
    // Collapse mode init
    if (mode === 'collapse') {
      this.collapseMode = true
      this.collapsePath = [{ r: this.sc.r, c: this.sc.c }]
      this.collapseHead = 0
      this.collapseTimeInterval = COLLAPSE_TIME[diff] || 10
      this.collapseTimer = 0
      this.collapseTimeLeft = COLLAPSE_TIME[diff] || 10
      this.collapseZone = new Set()
      this.collapseFlash = 0
      this.bcOn = false
    } else {
      this.collapseMode = false
    }

    // Ghost mode init
    if (mode === 'ghost') {
      this.ghostData = null
      this.ghostPos = null
      this.ghostStepDiff = 0
      this.ghostIsPerfect = false
    } else {
      this.ghostData = null
      this.ghostPos = null
    }
    this.state = STATE.PLAYING
  }

  reset() {
    this.pc = { r: this.sc.r, c: this.sc.c }
    this.steps = 0; this.ph = [{ r: this.sc.r, c: this.sc.c }]
    this.vis = new Set([cellKey(this.sc.r, this.sc.c)])
    this.hintPath = null; this.hintOn = false
    this.ghostPath = null
    this.fogRevealed = new Set([cellKey(this.sc.r, this.sc.c)])
    if (this.fogOn) this._initFogRadius()
    this.fogJustRevealed = new Set(); this.wallBumps = 0; this.btCount = 0
    this.gemCollected = new Set()
    this.endLocked = this.mode === 'treasure' && this.gemsTotal > 0
    this._justGem = false
    if (this.collapseMode) {
      this.collapsePath = [{ r: this.sc.r, c: this.sc.c }]
      this.collapseHead = 0
      this.collapseTimer = 0
      this.collapseTimeLeft = this.collapseTimeInterval
      this.collapseZone = new Set()
      this.collapseFlash = 0
    }
    this.state = STATE.PLAYING
  }

  /** Advance collapse by delta time (seconds), called from game loop */
  advanceCollapse(dt) {
    if (!this.collapseMode || this.state !== STATE.PLAYING) return
    this.collapseTimer += dt
    this.collapseTimeLeft = Math.max(0, this.collapseTimeInterval - this.collapseTimer)
    if (this.collapseTimer >= this.collapseTimeInterval) {
      this.collapseTimer = 0
      this.collapseHead++
      const cell = this.collapsePath[this.collapseHead - 1]
      if (cell) {
        this.collapseZone.add(cellKey(cell.r, cell.c))
        this.collapseFlash = performance.now()
        if (this.collapseZone.has(cellKey(this.pc.r, this.pc.c))) {
          this.fail('collapse')
        }
      }
    }
  }

  move(dr, dc) {
    if (this.state !== STATE.PLAYING) return { moved: false }
    const nr = this.pc.r + dr, nc = this.pc.c + dc
    if (nr < 0 || nr >= this.cells || nc < 0 || nc >= this.cells) return { moved: false, wall: false }
    const wr = this.pc.r * 2 + 1 + dr, wc = this.pc.c * 2 + 1 + dc
    if (this.grid[wr][wc] === 1) { this.wallBumps++; return { moved: false, wall: true } }
    // Collapse: target cell is collapsed
    if (this.collapseMode && this.collapseZone.has(cellKey(nr, nc))) {
      return { moved: false, wall: true }
    }

    this.pc = { r: nr, c: nc }
    this.steps++
    this.ph.push({ r: nr, c: nc })
    this.vis.add(cellKey(nr, nc))

    // Collapse: track path only (time-based advance happens in game loop)
    if (this.collapseMode) {
      this.collapsePath.push({ r: nr, c: nc })
    }

    if (this.fogOn) {
      this.fogJustRevealed = new Set(); this.fogRevealTime = performance.now()
      if (this.mode === 'torchpro') {
        this.fogRevealed = new Set()
        for (let dr2 = -this.fogR; dr2 <= this.fogR; dr2++)
          for (let dc2 = -this.fogR; dc2 <= this.fogR; dc2++) {
            if (Math.sqrt(dr2 * dr2 + dc2 * dc2) > this.fogR) continue
            const fr = nr + dr2, fc = nc + dc2
            if (fr >= 0 && fr < this.cells && fc >= 0 && fc < this.cells) this.fogRevealed.add(cellKey(fr, fc))
          }
      } else {
        for (let dr2 = -this.fogR; dr2 <= this.fogR; dr2++)
          for (let dc2 = -this.fogR; dc2 <= this.fogR; dc2++) {
            if (Math.sqrt(dr2 * dr2 + dc2 * dc2) > this.fogR) continue
            const fr = nr + dr2, fc = nc + dc2
            if (fr >= 0 && fr < this.cells && fc >= 0 && fc < this.cells) {
              const ck = cellKey(fr, fc)
              if (!this.fogRevealed.has(ck)) this.fogJustRevealed.add(ck)
              this.fogRevealed.add(ck)
            }
          }
      }
    }

    if (this.hintOn) this.hintPath = PathFinder.findPath(this.grid, this.pc, this.ec, this.cells)
    if (this.ghostOn) this.ghostPath = PathFinder.findPath(this.grid, this.pc, this.ec, this.cells)

    /* Gem collection */
    if (this.gems && this.gems.has(cellKey(nr, nc)) && !this.gemCollected.has(cellKey(nr, nc))) {
      this.gemCollected.add(cellKey(nr, nc))
      this._justGem = true
      if (this.gemCollected.size >= this.gemsTotal) this.endLocked = false
    }

    /* Win / fail checks */
    if (!this.endLocked && nr === this.ec.r && nc === this.ec.c) {
      this.state = STATE.WON; return { moved: true, won: true }
    }
    if (this.chS && this.steps >= this.chS) { this.fail('steps'); return { moved: true, failed: 'steps' } }
    return { moved: true }
  }

  pause()   { if (this.state === STATE.PLAYING) this.state = STATE.PAUSED }
  resume()  { if (this.state === STATE.PAUSED) this.state = STATE.PLAYING }

  togglePause() {
    if (this.state === STATE.PLAYING) { this.pause(); return true }
    if (this.state === STATE.PAUSED) { this.resume(); return true }
    return false
  }

  fail(r) { this.state = STATE.FAILED; this.failCount++ }

  _unvisitedAdj(r, c) {
    let cnt = 0
    for (const d of DIRS) {
      const nr = r + d.dr, nc = c + d.dc
      if (nr >= 0 && nr < this.cells && nc >= 0 && nc < this.cells) {
        const wr = r * 2 + 1 + d.dr, wc = c * 2 + 1 + d.dc
        if (this.grid[wr][wc] === 0 && !this.vis.has(cellKey(nr, nc))) cnt++
      }
    }
    return cnt
  }

  backtrack() {
    if (this.diff === 'supermax' || this.collapseMode) return
    this.btCount++
    for (let i = this.ph.length - 1; i >= 0; i--) {
      const p = this.ph[i]
      if (this._unvisitedAdj(p.r, p.c) >= 1 && !(p.r === this.pc.r && p.c === this.pc.c)) {
        this.pc = { r: p.r, c: p.c }; this.ph = this.ph.slice(0, i + 1); return
      }
    }
    this.pc = { r: this.sc.r, c: this.sc.c }; this.ph = [{ r: this.sc.r, c: this.sc.c }]
  }

  toggleHint() {
    this.hintOn = !this.hintOn
    if (this.hintOn) this.hintPath = PathFinder.findPath(this.grid, this.pc, this.ec, this.cells)
    else this.hintPath = null
    return this.hintOn
  }

  toggleGhost() {
    this.ghostOn = !this.ghostOn
    if (this.ghostOn) this.ghostPath = PathFinder.findPath(this.grid, this.pc, this.ec, this.cells)
    else this.ghostPath = null
    return this.ghostOn
  }

  cycleFog() {
    if (this.mode === 'torch' || this.mode === 'torchpro') {
      const i = TORCH_SIZES.indexOf(this.fogR); this.fogR = TORCH_SIZES[(i + 1) % TORCH_SIZES.length]
      return this.fogR
    } else {
      this.fogOn = !this.fogOn
      if (this.fogOn) {
        this.fogRevealed = new Set([cellKey(this.pc.r, this.pc.c)])
        for (let dr = -this.fogR; dr <= this.fogR; dr++)
          for (let dc = -this.fogR; dc <= this.fogR; dc++) {
            if (Math.sqrt(dr * dr + dc * dc) > this.fogR) continue
            const fr = this.pc.r + dr, fc = this.pc.c + dc
            if (fr >= 0 && fr < this.cells && fc >= 0 && fc < this.cells) this.fogRevealed.add(cellKey(fr, fc))
          }
      }
      return this.fogOn
    }
  }

  toggleBC() { this.bcOn = !this.bcOn; return this.bcOn }
  toMenu()  { this.state = STATE.MENU }

  _initFogRadius() {
    for (let dr = -this.fogR; dr <= this.fogR; dr++)
      for (let dc = -this.fogR; dc <= this.fogR; dc++) {
        if (Math.sqrt(dr * dr + dc * dc) > this.fogR) continue
        const fr = this.pc.r + dr, fc = this.pc.c + dc
        if (fr >= 0 && fr < this.cells && fc >= 0 && fc < this.cells) this.fogRevealed.add(cellKey(fr, fc))
      }
  }
}
