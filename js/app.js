/* ── App: orchestrator, game loop, input handling ── */

import { KEY_MAP, MOVE_CD, MOVE_CDS, MODE_LABELS, FOG_R } from './config.js'
import { cellKey, isInputFocused, getDailySeed } from './util.js'
import { GameEngine, STATE } from './engine.js'
import { MazeRenderer } from './renderer.js'
import { Timer } from './timer.js'
import { Sound } from './sound.js'
import { Particles } from './particles.js'
import { Score } from './score.js'
import { UI } from './ui.js'
import { HistoryUI } from './history-ui.js'

class App {
  constructor() {
    this.engine = new GameEngine()
    this.renderer = new MazeRenderer(document.getElementById('maze-canvas'))
    this.timer = new Timer()
    this.sound = new Sound()
    this.particles = new Particles()
    this.held = new Set(); this.moveInt = null; this.fid = null
    this.chTime = null; this.chSteps = null
    this.wf = 0; this.st = 0; this.needR = false; this.rto = null
    this.lf = null; this.ls = 0
    this.bt = null; this.btt = 0
    this.replay = false; this.raid = null; this.ccb = null; this._lt = -1
    this.campaignQueue = null; this.campaignIdx = 0
    this.autoSeed = Math.floor(Math.random() * 900000) + 100000
    this.moveCd = MOVE_CD
  }

  init() {
    UI.init()
    const prefs = Score.prefs()
    this.moveCd = MOVE_CDS[prefs.moveSpeed] || MOVE_CD
    const seedInput = document.getElementById('seed-input')
    if (seedInput) seedInput.placeholder = String(this.autoSeed)
    this._bind()
    this._loop()
    document.addEventListener('click', () => this.sound.ensure(), { once: true })
  }

  /* ── Event Bindings ── */
  _bind() {
    window.addEventListener('keydown', e => this._kd(e))
    window.addEventListener('keyup', e => this._ku(e))

    document.getElementById('nav-logo').addEventListener('click', () => {
      if (this.engine.state !== STATE.MENU && this.engine.state !== STATE.WON && this.engine.state !== STATE.FAILED) {
        this.ccb = () => this._toMenu(); UI.showConfirm('\u5F53\u524D\u8FDB\u5EA6\u5C06\u4E22\u5931\uFF0C\u786E\u5B9A\u9000\u51FA?')
      } else this._toMenu()
    })
    document.getElementById('nav-theme').addEventListener('click', () => UI.toggleTheme())
    document.getElementById('nav-sound').addEventListener('click', () => {
      this.sound.on = !this.sound.on
      Score.setPrefs({ sound: this.sound.on })
      document.getElementById('nav-sound').textContent = this.sound.on ? '\uD83D\uDD0A' : '\uD83D\uDD07'
    })
    document.getElementById('nav-settings').addEventListener('click', () => {
      if (this.engine.state === STATE.PLAYING) { this.engine.pause(); this.timer.pause() }
      UI.showSettings()
    })

    document.getElementById('btn-start').addEventListener('click', () => this._start(false))
    document.getElementById('btn-daily').addEventListener('click', () => { document.getElementById('seed-input').value = ''; this._start(true) })
    document.getElementById('btn-campaign').addEventListener('click', () => {
      const cfg = document.getElementById('campaign-config')
      cfg.classList.toggle('hidden')
    })
    document.getElementById('btn-campaign-start').addEventListener('click', () => {
      document.getElementById('campaign-config').classList.add('hidden')
      // Save counts from inputs
      const counts = {}
      document.querySelectorAll('.cc-input').forEach(inp => counts[inp.dataset.diff] = parseInt(inp.value) || 1)
      Score.setPrefs({ campaignCounts: counts })
      this._startCampaign()
    })
    document.getElementById('btn-resume').addEventListener('click', () => this._resume())
    document.getElementById('btn-quit').addEventListener('click', () => { this.ccb = () => this._toMenu(); UI.showConfirm('\u5F53\u524D\u8FDB\u5EA6\u5C06\u4E22\u5931\uFF0C\u786E\u5B9A\u9000\u51FA?'); UI.hidePause() })
    document.getElementById('btn-confirm-yes').addEventListener('click', () => { UI.hideConfirm(); if (this.ccb) this.ccb() })
    document.getElementById('btn-confirm-no').addEventListener('click', () => UI.hideConfirm())
    document.getElementById('btn-win-new').addEventListener('click', () => this._start(false))
    document.getElementById('btn-win-menu').addEventListener('click', () => this._toMenu())
    document.getElementById('btn-win-replay').addEventListener('click', () => this._replay())
    document.getElementById('btn-fail-retry').addEventListener('click', () => this._start(false))
    document.getElementById('btn-fail-menu').addEventListener('click', () => this._toMenu())
    document.getElementById('btn-new-game').addEventListener('click', () => this._start(false))
    document.getElementById('btn-reset-maze').addEventListener('click', () => this._reset())
    document.getElementById('btn-pause-game').addEventListener('click', () => this._togglePause())
    document.getElementById('btn-hint').addEventListener('click', () => this._toggleHint())
    document.getElementById('btn-ghost').addEventListener('click', () => this._toggleGhost())
    document.getElementById('btn-backtrack').addEventListener('click', () => this._backtrack())
    document.getElementById('btn-fog').addEventListener('click', () => this._cycleFog())
    document.getElementById('btn-breadcrumb').addEventListener('click', () => this._toggleBC())
    document.getElementById('btn-settings-open').addEventListener('click', () => {
      if (this.engine.state === STATE.PLAYING) { this.engine.pause(); this.timer.pause() }
      UI.showSettings()
    })
    document.getElementById('btn-settings-close').addEventListener('click', () => {
      UI.hideSettings()
      if (this.engine.state === STATE.PAUSED) { this.engine.resume(); this.timer.resume(); this.needR = true }
    })
    document.getElementById('btn-theme-toggle').addEventListener('click', () => UI.toggleTheme())
    document.getElementById('btn-reset-records').addEventListener('click', () => {
      if (confirm('\u786E\u5B9A\u6E05\u7A7A\u6240\u6709\u5386\u53F2\u6700\u4F73\u6210\u7EE9?')) { Score.resetAll(); UI._updRecords(); UI.updateStats() }
    })
    document.getElementById('btn-sound-toggle').addEventListener('click', () => {
      this.sound.on = !this.sound.on; Score.setPrefs({ sound: this.sound.on }); UI._updSoundBtn(this.sound.on)
    })
    // History button — binding in ui.js: _initHeroFooter
    document.getElementById('history-close').addEventListener('click', () => {
      HistoryUI.close()
    })
    // History filter buttons
    document.querySelectorAll('.history-filter').forEach(b => {
      b.addEventListener('click', () => {
        HistoryUI.setFilter(b.dataset.type, b.dataset.value)
      })
    })
    document.getElementById('hud-seed').addEventListener('click', () => {
      if (this.engine.seed != null) {
        navigator.clipboard.writeText(String(this.engine.seed)).then(() => {
          const el = document.getElementById('hud-seed')
          const orig = el.textContent
          el.textContent = '\u5DF2\u590D\u5236!'
          setTimeout(() => el.textContent = orig, 1000)
        }).catch(() => {})
      }
    })
    window.addEventListener('resize', () => this._onResize())
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.engine.state === STATE.PLAYING) { this.engine.pause(); this.timer.pause(); UI.showPause(); this._stopMove() }
    })
  }

  /* ── Game Loop ── */
  _loop() {
    this.fid = requestAnimationFrame(() => this._loop())
    if (this.replay) return

    if (this.engine.state === STATE.PLAYING) {
      const el = this.timer.getSec(), disp = this.timer.getDisp()
      let cd = null
      if (this.chTime) {
        const r = this.chTime - el; cd = r > 0 ? `剩${r}秒` : null
        if (r <= 30 && r > 0) { UI.pulseTimer(true); if (r <= 5 && r > 0 && el !== this._lt) { this.sound.tick(); this._lt = el } }
        else UI.pulseTimer(false)
      }
      if (this.chSteps) { const r = Math.max(0, this.chSteps - this.engine.steps); cd = cd ? `${cd} \u00B7 剩${r}步` : `剩${r}步` }
      // Collapse: advance by time, show countdown
      if (this.engine.collapseMode) {
        const now = performance.now()
        const dt = this._lastCollapseTime ? (now - this._lastCollapseTime) / 1000 : 0
        this._lastCollapseTime = now
        if (dt > 0 && dt < 1) this.engine.advanceCollapse(dt)
        const left = Math.ceil(this.engine.collapseTimeLeft)
        cd = cd ? cd + ' \u00B7 ' + left + 's' : left + 's'
      } else {
        this._lastCollapseTime = 0
      }
      const gemInfo = this.engine.gems ? { collected: this.engine.gemCollected.size, total: this.engine.gemsTotal } : null
      const dist = Math.abs(this.engine.pc.r - this.engine.ec.r) + Math.abs(this.engine.pc.c - this.engine.ec.c)
      UI.updateHUD(disp, this.engine.steps, cd, gemInfo, dist)

      if (this.chTime && el >= this.chTime) {
        this.engine.fail('time'); this.timer.pause(); this._stopMove(); this.sound.fail()
        UI.showFail('time', disp, this.engine.steps)
      }

      // Ghost position update
      if (this.engine.mode === 'ghost' && this.engine.ghostData && this.engine.ghostData.path) {
        const elapsed = this.timer.getMs()
        const ghostPath = this.engine.ghostData.path
        let ghostIdx = 0
        for (let i = ghostPath.length - 1; i >= 0; i--) {
          if (ghostPath[i].t <= elapsed) { ghostIdx = i; break }
        }
        this.engine.ghostPos = ghostPath[ghostIdx] || null
        this.engine.ghostStepDiff = this.engine.steps - ghostIdx
      }
    }

    if (this.engine.state !== STATE.MENU && this.needR) {
      const fogOpts = {
        enabled: this.engine.fogOn, revealed: this.engine.fogRevealed,
        justRevealed: this.engine.fogJustRevealed, revealTime: this.engine.fogRevealTime,
        radius: this.engine.fogR
      }
      this.renderer.render(
        this.engine.grid, this.engine.pc, this.engine.ghostPath, this.engine.hintPath, this.engine.diff,
        {
          fog: fogOpts, breadcrumb: this.engine.bcOn ? this.engine.ph : null,
          ghost: {
            on: this.engine.ghostOn,
            pos: this.engine.ghostPos,
            data: this.engine.ghostData,
            isPerfect: this.engine.ghostIsPerfect
          },
          collapse: {
            zone: this.engine.collapseMode ? this.engine.collapseZone : null,
            flash: this.engine.collapseFlash
          },
          effects: {
            wallFlashTime: this.wf,
            shakeTime: this.st,
            lerpFrom: this.lf,
            lerpStart: this.ls,
            backtrackTrail: this.bt
          },
          markers: {
            startCell: this.engine.sc,
            endCell: this.engine.ec,
            endLocked: this.engine.endLocked,
            gems: this.engine.gems,
            gemCollected: this.engine.gemCollected
          }
        }
      )
      const minimapEl = document.getElementById('minimap')
      if (this.engine.fogOn) {
        if (minimapEl) minimapEl.style.display = 'none'
      } else {
        if (minimapEl) minimapEl.style.display = ''
        this.renderer.renderMinimap(
          this.engine.grid, this.engine.pc, this.engine.cells,
          this.engine.sc, this.engine.ec,
          this.engine.gems, this.engine.gemCollected, this.engine.endLocked
        )
      }
      if (this.engine.state !== STATE.PLAYING) this.needR = false
    }

    if (this.lf && performance.now() - this.ls > 60) this.lf = null
    if (this.bt && performance.now() - this.btt > 300) this.bt = null
  }

  /* ── Game Actions ── */
  _start(isDaily) {
    this.autoSeed = Math.floor(Math.random() * 900000) + 100000
    const seedInput = document.getElementById('seed-input')
    if (seedInput) seedInput.placeholder = String(this.autoSeed)
    const diff = UI.getDiff(), mode = UI.getMode(), ch = UI.getChallenge()
    this.chTime = ch.time; this.chSteps = ch.steps
    UI.setChallenge(ch); UI.setMode(mode)
    let seed = isDaily ? getDailySeed() : UI.getSeed()
    if (seed == null && !isDaily) seed = this.autoSeed
    Score.trackSeed(seed)
    this.replay = false
    const engine = Score.prefs().engine || 'standard'
    this.engine.newGame(diff, ch.time, ch.steps, seed, isDaily, mode, engine)
    // Load ghost for ghost mode
    if (mode === 'ghost' && !isDaily) {
      const ghost = Score.loadGhost(seed, this.engine.diff, mode)
      if (ghost && ghost.path) {
        this.engine.ghostData = ghost
        this.engine.ghostIsPerfect = false
      } else if (this.engine.solutionPath) {
        const perfectPath = this.engine.solutionPath.map((p, i) => ({
          r: p.r, c: p.c, t: i * this.moveCd
        }))
        this.engine.ghostData = { path: perfectPath }
        this.engine.ghostIsPerfect = true
      }
    }
    UI.showGame(diff, mode, seed, isDaily, ch)
    this.timer.start(); this._stopMove(); this.particles.stop()
    this.needR = true; this.lf = null; this.bt = null; this._lt = -1
    const prefs = Score.prefs()
    this.moveCd = MOVE_CDS[prefs.moveSpeed] || MOVE_CD
    this.engine.bcOn = mode !== 'torch' && mode !== 'torchpro' && prefs.breadcrumb !== false
    UI.updateHelpers(false, false, this.engine.fogOn, this.engine.bcOn, this.engine.endLocked)
    const gemInfo = this.engine.gems ? { collected: this.engine.gemCollected.size, total: this.engine.gemsTotal } : null
    UI.updateHUD('00:00:00', 0, null, gemInfo)
    UI.showMetricsPanel(this.engine.mazeMetrics, seed, diff)
    setTimeout(() => UI.startKbFade(), 8000)
    this.sound.click()
    requestAnimationFrame(() => this.renderer.resize(this.engine.cells))
  }

  _reset() {
    if (this.engine.state !== STATE.PLAYING && this.engine.state !== STATE.PAUSED) return
    this.engine.reset()
    this.timer.start(); this._stopMove(); this.particles.stop()
    this.needR = true; this.lf = null; this.bt = null; this._lt = -1
    UI.updateHelpers(this.engine.hintOn, this.engine.ghostOn, this.engine.fogOn, this.engine.bcOn, this.engine.endLocked)
    const gemInfo = this.engine.gems ? { collected: this.engine.gemCollected.size, total: this.engine.gemsTotal } : null
    UI.updateHUD('00:00:00', 0, null, gemInfo)
    UI.hidePause()
    if (this.engine.state === STATE.PAUSED) this.engine.resume()
    this.sound.click()
  }

  _toMenu() {
    HistoryUI.close()
    this.timer.reset(); this._stopMove(); this.particles.stop()
    this.replay = false
    // Save campaign progress if quitting mid-campaign
    if (this.campaignQueue && this.engine.isCampaign) {
      Score.setCampaignProgress({
        queue: this.campaignQueue,
        idx: this.campaignIdx,
        date: new Date().toISOString().split('T')[0]
      })
    }
    this.engine.toMenu()
    UI.showMenu(); UI.hidePause(); UI.hideConfirm()
    UI.updateStats(); this.needR = false
  }

  _togglePause() {
    if (this.engine.togglePause()) {
      if (this.engine.state === STATE.PAUSED) { this.timer.pause(); UI.showPause(); this._stopMove() }
      else { this.timer.resume(); UI.hidePause(); this.needR = true }
    }
  }

  _resume() { this.engine.resume(); this.timer.resume(); UI.hidePause(); this.needR = true }

  _toggleHint() {
    if (this.engine.mode === 'torch' || this.engine.mode === 'torchpro') return
    const a = this.engine.toggleHint()
    UI.updateHelpers(a, this.engine.ghostOn, this.engine.fogOn, this.engine.bcOn, this.engine.endLocked)
    this.needR = true; this.sound.click()
  }

  _toggleGhost() {
    const a = this.engine.toggleGhost()
    UI.updateHelpers(this.engine.hintOn, a, this.engine.fogOn, this.engine.bcOn, this.engine.endLocked)
    this.needR = true; this.sound.click()
  }

  _cycleFog() {
    if (this.engine.mode === 'torch' || this.engine.mode === 'torchpro') {
      this.engine.cycleFog(); this.needR = true; this.sound.click()
      UI.updateHelpers(this.engine.hintOn, this.engine.ghostOn, this.engine.fogR, this.engine.bcOn, this.engine.endLocked)
    } else {
      const a = this.engine.cycleFog()
      UI.updateHelpers(this.engine.hintOn, this.engine.ghostOn, this.engine.fogOn, this.engine.bcOn, this.engine.endLocked)
      this.needR = true; this.sound.click()
    }
  }

  _toggleBC() {
    if (this.engine.mode === 'torch' || this.engine.mode === 'torchpro') return
    const a = this.engine.toggleBC()
    UI.updateHelpers(this.engine.hintOn, this.engine.ghostOn, this.engine.fogOn, a, this.engine.endLocked)
    Score.setPrefs({ breadcrumb: a }); this.needR = true; this.sound.click()
  }

  _backtrack() {
    if (this.engine.state !== STATE.PLAYING) return
    const op = { r: this.engine.pc.r, c: this.engine.pc.c }
    this.engine.backtrack()
    this.bt = [{ r: op.r, c: op.c }, { r: this.engine.pc.r, c: this.engine.pc.c }]
    this.btt = performance.now(); this.needR = true; this.sound.click()
  }

  _tryMove(dr, dc) {
    if (this.engine.state !== STATE.PLAYING) return
    const op = { r: this.engine.pc.r, c: this.engine.pc.c }
    const res = this.engine.move(dr, dc)

    if (res.moved) {
      this.sound.move(); this.lf = op; this.ls = performance.now(); this.needR = true
      if (this.engine._justGem) { this.engine._justGem = false; this.sound.gem() }

      if (this.sound.on) {
        const dist = Math.abs(this.engine.pc.r - this.engine.ec.r) + Math.abs(this.engine.pc.c - this.engine.ec.c)
        const norm = 1 - dist / (this.engine.cells * 2)
        if (norm > 0.7) this.sound.proximity(300 + norm * 500)
      }

      if (res.won) {
        this.timer.pause(); this._stopMove()
        const el = this.timer.getSec(), steps = this.engine.steps
        const modeKey = this.engine.mode === 'torch' ? 'mz-best-torch'
          : this.engine.mode === 'treasure' ? 'mz-best-treasure'
          : this.engine.mode === 'torchpro' ? 'mz-best-torchpro' : 'mz-best'
        const isNB = this.engine.isDaily
          ? Score.setDailyBest(new Date().toISOString().split('T')[0], el, steps)
          : Score.setBest(this.engine.diff, el, steps, modeKey)
        const prev = this.engine.isDaily
          ? Score.dailyBest(new Date().toISOString().split('T')[0])
          : Score.best(modeKey)[this.engine.diff]
        const solLen = this.engine.solutionPath ? this.engine.solutionPath.length : 0
        const eff = solLen > 0 ? (solLen / steps * 100).toFixed(0) + '%' : '?'
        const stats = { wallBumps: this.engine.wallBumps, backtracks: this.engine.btCount, efficiency: eff }
        /* Score calculation & leaderboard */
        let score = Score.calcScore(this.engine.mazeMetrics, steps, this.engine.mode, el, this.moveCd, this.engine.diff)
        // Ghost mode bonus
        score = this._applyGhostBonus(score, steps, el)
        if (score > 0 && !this.engine.isDaily) {
          Score.addLeaderboard({
            score, diff: this.engine.diff, mode: this.engine.mode,
            time: el, steps, seed: this.engine.seed,
            date: new Date().toISOString().split('T')[0],
            details: this.engine.mazeMetrics ? {
              deadPct: this.engine.mazeMetrics.deadEndPct,
              tort: this.engine.mazeMetrics.tortuosity,
              deadLen: this.engine.mazeMetrics.deadEndLen,
              branch: this.engine.mazeMetrics.branchFactor
            } : {}
          })
        }
        this.sound.win()
        // Save ghost path
        this._saveGhostPath(el, steps, score)
        // Record to history (not for campaign — campaign records per-level)
        this._recordHistory(el, steps, score, solLen)
        const newAch = Score.checkAchievements(this.engine, el)
        // Collect campaign level stats
        this._collectCampaignStats(el, steps, score, solLen)
        UI.updateStats(modeKey)
        const C = this.renderer._clrs()
        const px = (this.renderer.ox || 0) + (this.engine.ec.c * 2 + 1.5) * (this.renderer.cs || 1)
        const py = (this.renderer.oy || 0) + (this.engine.ec.r * 2 + 1.5) * (this.renderer.cs || 1)
        this.particles.burst(this.renderer.canvas, px, py, C.accent)

        if (this.engine.isCampaign) {
          const nextIdx = this.campaignIdx + 1
          if (nextIdx >= this.campaignQueue.length) {
            UI.showWin(this.timer.getDisp(), steps, false, null, stats, this.engine.mazeMetrics, score, newAch)
            Score.resetCampaign()
            // Calculate stars
            const avgEff = this._campaignStats.length
              ? this._campaignStats.reduce((s, l) => s + l.efficiency, 0) / this._campaignStats.length
              : 0
            const stars = avgEff >= 0.8 ? 3 : avgEff >= 0.6 ? 2 : 1
            UI.showCampaignReport(this._campaignStats, {
              totalTime: this._campaignStats.reduce((s, l) => s + l.time, 0),
              totalSteps: this._campaignStats.reduce((s, l) => s + l.steps, 0),
              totalScore: this._campaignStats.reduce((s, l) => s + l.score, 0),
              avgEfficiency: avgEff,
              stars
            })
            // Record each level to history
            this._campaignStats.forEach(l => {
              Score.addHistory({
                mode: 'campaign',
                diff: l.diff,
                time: l.time,
                steps: l.steps,
                score: l.score,
                efficiency: l.efficiency,
                wallBumps: l.wallBumps,
                backtracks: l.backtracks,
                seed: this.engine.seed,
                isCampaign: true
              })
            })
            this._campaignStats = null
            const btnNew = document.getElementById('btn-win-new')
            if (btnNew) { const c = btnNew.cloneNode(true); btnNew.parentNode.replaceChild(c, btnNew); c.textContent = '🏆 闯关完成!'; c.addEventListener('click', () => { this.campaignQueue = null; this._toMenu() }) }
          } else {
            UI.showWin(this.timer.getDisp(), steps, false, null, stats, this.engine.mazeMetrics, score, newAch)
            const btnNew = document.getElementById('btn-win-new')
            if (btnNew) { const c = btnNew.cloneNode(true); btnNew.parentNode.replaceChild(c, btnNew); c.textContent = '下一关 (' + this._getCampaignDiffLabel(nextIdx) + ')'; c.addEventListener('click', () => this._advanceLevel()) }
            const btnMenu = document.getElementById('btn-win-menu')
            if (btnMenu) { const c = btnMenu.cloneNode(true); btnMenu.parentNode.replaceChild(c, btnMenu); c.textContent = '放弃闯关'; c.addEventListener('click', () => { Score.resetCampaign(); this.campaignQueue = null; this._toMenu() }) }
          }
        } else {
          UI.showWin(this.timer.getDisp(), steps, isNB, prev, stats, this.engine.mazeMetrics, score, newAch)
        }
      }

      if (res.failed) {
        this.timer.pause(); this._stopMove(); this.sound.fail()
        UI.showFail(res.failed, this.timer.getDisp(), this.engine.steps)
      }
    } else if (res.wall) {
      this.sound.wallBump(); this.wf = performance.now(); this.st = performance.now(); this.needR = true
    }
  }

  /* ── Campaign ── */
  _startCampaign() {
    const counts = Score.prefs().campaignCounts || { beginner: 1, normal: 1, hard: 1, hell: 1 }
    const queue = []
    for (const d of ['beginner', 'normal', 'hard', 'hell']) {
      for (let i = 0; i < (counts[d] || 1); i++) queue.push({ diff: d, idx: queue.length })
    }
    // Resume only if saved queue matches current config
    const saved = Score.campaignProgress()
    if (saved && saved.queue && saved.queue.length > 0 &&
        saved.queue.length === queue.length &&
        saved.queue.every((q, i) => q.diff === queue[i].diff)) {
      this.campaignQueue = saved.queue
      this.campaignIdx = saved.idx || 0
      if (this.campaignIdx < this.campaignQueue.length) {
        this._loadCampaignLevel(this.campaignIdx)
        return
      }
    }
    // Start fresh
    this.campaignQueue = queue
    this.campaignIdx = 0
    this._campaignStats = []
    this._loadCampaignLevel(0)
  }

  _loadCampaignLevel(idx) {
    if (idx >= this.campaignQueue.length) {
      Score.resetCampaign()
      this.campaignQueue = null
      this._toMenu()
      return
    }
    const level = this.campaignQueue[idx]
    this.campaignIdx = idx
    const seed = Math.abs((idx + 1) * 7919 + new Date().toISOString().split('T')[0].split('-').reduce((a, b) => a * 31 + +b, 0))
    const engine = Score.prefs().engine || 'standard'
    this.chTime = 0; this.chSteps = 0
    UI.setChallenge({ time: null, steps: null })
    this.replay = false
    this.engine.newGame(level.diff, 0, 0, seed, false, 'standard', engine, idx, this.campaignQueue.length)
    const mode = 'standard'
    UI.showGame(level.diff, mode, seed, false, {}, idx, this.campaignQueue.length)
    this.timer.start(); this._stopMove(); this.particles.stop()
    this.needR = true; this.lf = null; this.bt = null; this._lt = -1
    const prefs = Score.prefs()
    this.engine.bcOn = prefs.breadcrumb !== false
    UI.updateHelpers(false, false, false, this.engine.bcOn, false)
    UI.updateHUD('00:00:00', 0, null, null, 0)
    this.sound.click()
    requestAnimationFrame(() => this.renderer.resize(this.engine.cells))
    // Save progress
    Score.setCampaignProgress({
      queue: this.campaignQueue,
      idx: this.campaignIdx,
      date: new Date().toISOString().split('T')[0]
    })
  }

  _advanceLevel() {
    this.campaignIdx++
    this._loadCampaignLevel(this.campaignIdx)
  }


  /** Apply ghost mode score bonus */
  _applyGhostBonus(score, steps, el) {
    if (this.engine.mode === 'ghost' && this.engine.ghostData && !this.engine.isDaily) {
      const ghostSteps = this.engine.ghostData.steps || Infinity
      const ghostTime = this.engine.ghostData.time || Infinity
      const beatGhost = steps < ghostSteps || el < ghostTime
      const beatPerfect = this.engine.ghostIsPerfect && beatGhost
      if (beatPerfect) score = Math.round(score * 1.25)
      else if (beatGhost && !this.engine.ghostIsPerfect) score = Math.round(score * 1.1)
    }
    return score
  }

  /** Save ghost path on win */
  _saveGhostPath(el, steps, score) {
    if (this.engine.mode === 'ghost' && !this.engine.isDaily && score > 0 && this.engine.ph.length > 1) {
      const ghostPath = this.engine.ph.map((p, i) => ({ r: p.r, c: p.c, t: i * this.moveCd }))
      Score.saveGhost(this.engine.seed, this.engine.diff, this.engine.mode, ghostPath, el, steps)
    }
  }

  /** Record game to history */
  _recordHistory(el, steps, score, solLen) {
    if (!this.engine.isCampaign) {
      Score.addHistory({
        mode: this.engine.mode, diff: this.engine.diff, time: el,
        steps: this.engine.steps, score: score,
        efficiency: solLen > 0 ? solLen / Math.max(1, steps) : 0,
        wallBumps: this.engine.wallBumps, backtracks: this.engine.btCount,
        seed: this.engine.seed, isCampaign: false
      })
    }
  }

  /** Collect campaign level stats */
  _collectCampaignStats(el, steps, score, solLen) {
    if (this.engine.isCampaign) {
      this._campaignStats.push({
        level: this.campaignIdx + 1, diff: this.engine.diff,
        time: el, steps: this.engine.steps, score: score,
        efficiency: solLen > 0 ? (solLen / steps) : 0,
        wallBumps: this.engine.wallBumps, backtracks: this.engine.btCount
      })
    }
  }

  _getCampaignDiffLabel(idx) {
    const diffs = ['beginner', 'normal', 'hard', 'hell']
    const labels = { beginner: '极简入门', normal: '休闲普通', hard: '进阶困难', hell: '硬核地狱' }
    const d = this.campaignQueue?.[idx]?.diff || 'beginner'
    return labels[d] || d
  }

  /* ── Keyboard ── */
  _kd(e) {
    if (isInputFocused()) return

    if (e.code === 'Escape') {
      e.preventDefault()
      if (this.replay) { this._stopReplay(); return }
      if (!document.getElementById('confirm-modal').classList.contains('hidden')) { UI.hideConfirm(); return }
      if (!document.getElementById('settings-modal').classList.contains('hidden')) {
        UI.hideSettings(); if (this.engine.state === STATE.PAUSED) { this.engine.resume(); this.timer.resume(); this.needR = true }
        return
      }
      if (!document.getElementById('win-modal').classList.contains('hidden')) { this._toMenu(); return }
      if (!document.getElementById('fail-modal').classList.contains('hidden')) { this._toMenu(); return }
      if (this.engine.state !== STATE.MENU) this._togglePause()
      return
    }

    if (e.code === 'Enter' && !e.ctrlKey && !e.metaKey && !document.getElementById('hero-section').classList.contains('hidden')) { this._start(false); return }

    if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); if (this.engine.state === STATE.PLAYING || this.engine.state === STATE.PAUSED) this._reset(); return }
    if (e.code === 'KeyN' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); if (this.engine.state !== STATE.MENU) this._start(false); return }
    if (e.code === 'KeyH' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); if (this.engine.state === STATE.PLAYING) this._toggleHint(); return }
    if (e.code === 'KeyG' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); if (this.engine.state === STATE.PLAYING) this._toggleGhost(); return }
    if (e.code === 'KeyB' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); if (this.engine.state === STATE.PLAYING) this._backtrack(); return }
    if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); if (this.engine.state === STATE.PLAYING) this._cycleFog(); return }
    if (e.code === 'KeyT' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); UI.toggleTheme(); return }

    if (e.ctrlKey || e.metaKey) return
    const dir = KEY_MAP[e.code]
    if (!dir) return
    e.preventDefault()
    if (this.engine.state !== STATE.PLAYING) return
    if (this.held.has(e.code)) return

    this.held.add(e.code)
    this._tryMove(dir.dr, dir.dc)

    if (!this.moveInt) {
      this.moveInt = setInterval(() => {
        let moved = false
        for (const c of this.held) {
          const d = KEY_MAP[c]
          if (d && this.engine.state === STATE.PLAYING) { this._tryMove(d.dr, d.dc); moved = true }
        }
        if (!moved) this._stopMove()
      }, this.moveCd)
    }
  }

  _ku(e) {
    this.held.delete(e.code)
    if (this.held.size === 0) this._stopMove()
  }

  _stopMove() { if (this.moveInt) { clearInterval(this.moveInt); this.moveInt = null } }

  _onResize() {
    if (this.rto) clearTimeout(this.rto)
    this.rto = setTimeout(() => {
      if (this.engine.state !== STATE.MENU) { this.renderer.resize(this.engine.cells); this.needR = true }
    }, 150)
  }

  /* ── Replay ── */
  _replay() {
    this.replay = true; this.particles.stop()
    const hist = [...this.engine.ph]
    const opt = this.engine.solutionPath ? [...this.engine.solutionPath] : []
    const totalFrames = Math.min(hist.length, 400)
    const speed = Math.max(1, Math.floor(hist.length / totalFrames))
    let frame = 0
    const fn = () => {
      if (!this.replay) return
      const idx = Math.min(frame * speed, hist.length - 1)
      const pc = hist[idx]
      this.renderer.render(
        this.engine.grid, pc, null, null, this.engine.diff,
        { breadcrumb: hist.slice(0, idx + 1), fog: {},
          ghost: { on: false },
          effects: { wallFlashTime: 0, shakeTime: 0, lerpFrom: null, lerpStart: 0, backtrackTrail: null },
          markers: { startCell: this.engine.sc, endCell: this.engine.ec, endLocked: false } }
      )
      this.renderer.renderMinimap(this.engine.grid, pc, this.engine.cells, this.engine.sc, this.engine.ec)
      frame++
      if (idx < hist.length - 1) this.raid = requestAnimationFrame(fn)
      else setTimeout(() => { this.replay = false; this.needR = true }, 500)
    }
    this.raid = requestAnimationFrame(fn)
  }

  _stopReplay() { this.replay = false; if (this.raid) cancelAnimationFrame(this.raid); this.needR = true }
}

document.addEventListener('DOMContentLoaded', () => { new App().init() })
