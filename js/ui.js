/* ── UI: DOM manipulation ── */

import { DIFF, DIFF_ORDER, MODE_KEYS, MODE_LABELS, MODE_DESC, SKIN_PALETTES, SKIN_KEYS, FONT_SIZE_LABELS, FONT_SIZE_VALUES, MODE_HINTS } from './config.js'
import { gridSize } from './util.js'
import { Score } from './score.js'
import { HistoryUI } from './history-ui.js'

export const UI = {
  init() {
    this._buildDiffCards()
    this._buildModeBtns()
    // Set initial mode hint for default mode
    const hintEl = document.getElementById('mode-hint')
    if (hintEl) hintEl.textContent = MODE_HINTS['standard'] || ''
    this._initEngineBtns()
    this._initHeroFooter()
    this._initTheme()
    this._initSkins()
    this._initSettings()
    // Apply saved font size
    const p = Score.prefs()
    this._applyFontSize(p.fontSize || 'medium')
    document.getElementById('ch-time-cb').addEventListener('change', function () {
      document.getElementById('ch-time-val').disabled = !this.checked
    })
    document.getElementById('ch-steps-cb').addEventListener('change', function () {
      document.getElementById('ch-steps-val').disabled = !this.checked
    })
  },

  _buildDiffCards() {
    const g = document.getElementById('diff-cards')
    for (const d of DIFF_ORDER) {
      const inf = DIFF[d]
      const b = document.createElement('button')
      b.className = 'diff-card' + (d === 'normal' ? ' active' : '')
      b.dataset.diff = d
      b.innerHTML = `<span class="card-label">${inf.label}</span><span class="card-size">${inf.cells}\u00D7${inf.cells} \u00B7 ${gridSize(inf.cells)}\u00D7${gridSize(inf.cells)}</span>`
      b.addEventListener('click', () => { g.querySelectorAll('.diff-card').forEach(x => x.classList.remove('active')); b.classList.add('active') })
      g.appendChild(b)
    }
  },

  _buildModeBtns() {
    const r = document.getElementById('mode-row')
    for (const k of MODE_KEYS) {
      const b = document.createElement('button')
      b.className = 'mode-btn' + (k === 'standard' ? ' active' : '')
      b.dataset.mode = k
      b.innerHTML = '<span class="mode-label">' + MODE_LABELS[k] + '</span><span class="mode-desc">' + MODE_DESC[k] + '</span>'
      b.addEventListener('click', () => {
        r.querySelectorAll('.mode-btn').forEach(x => x.classList.remove('active'))
        b.classList.add('active')
        const hintEl = document.getElementById('mode-hint')
        if (hintEl) hintEl.textContent = MODE_HINTS[k] || ''
      })
      r.appendChild(b)
    }
  },

  _initEngineBtns() {
    const p = Score.prefs()
    const row = document.getElementById('engine-row')
    if (!row) return
    row.querySelectorAll('.engine-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.engine === (p.engine || 'standard'))
      b.addEventListener('click', () => {
        row.querySelectorAll('.engine-btn').forEach(x => x.classList.remove('active'))
        b.classList.add('active')
        Score.setPrefs({ engine: b.dataset.engine })
      })
    })
  },

  _initHeroFooter() {
    this.updateStats()
    document.getElementById('hf-toggle').addEventListener('click', () => {
      HistoryUI.open()
    })
  },

  updateStats(key) {
    if (!key) key = 'mz-best'
    const r = Score.best(key)
    const el = document.getElementById('hf-records')
    if (!el) return
    const parts = []
    for (const d of DIFF_ORDER) {
      const inf = DIFF[d], rec = r[d]
      if (rec) {
        const m = Math.floor(rec.time / 60), s = rec.time % 60
        parts.push(`<span class="hf-item"><span class="hf-val">${inf.label}</span> ${m}:${String(s).padStart(2, '0')} / ${rec.steps}步</span>`)
      } else {
        parts.push(`<span class="hf-item"><span class="hf-val">${inf.label}</span> 暂无</span>`)
      }
    }
    el.innerHTML = parts.join('')
    this._buildHeroLeaderboard()
    this._updRecords()
  },

  _buildHeroLeaderboard() {
    const el = document.getElementById('hf-leaderboard')
    if (!el) return
    const lb = Score.leaderboard()
    if (!lb || lb.length === 0) {
      el.innerHTML = ''; return
    }
    let html = '<table class="lb-table"><thead><tr><th>#</th><th>得分</th><th>难度</th><th>用时</th><th>步数</th></tr></thead><tbody>'
    for (let i = 0; i < Math.min(lb.length, 10); i++) {
      const e = lb[i]
      const m = Math.floor(e.time / 60), s = e.time % 60
      const diffLabel = DIFF[e.diff] ? DIFF[e.diff].label : e.diff
      html += `<tr><td class="lb-rank">${i + 1}</td><td class="lb-score">${e.score}</td><td class="lb-diff">${diffLabel}</td>`
      html += `<td class="lb-time">${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}</td><td class="lb-steps">${e.steps}</td></tr>`
    }
    html += '</tbody></table>'
    el.innerHTML = html
  },

  _initTheme() {
    const p = Score.prefs()
    if (p.theme) document.documentElement.setAttribute('data-theme', p.theme)
    window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', e => {
      if (!Score.prefs().theme) document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : '')
    })
  },

  _initSkins() {
    const p = Score.prefs()
    if (p.skin) document.documentElement.setAttribute('data-skin', p.skin)
    const sw = document.getElementById('skin-swatches')
    for (const k of SKIN_KEYS) {
      const s = SKIN_PALETTES[k]
      const el = document.createElement('div')
      el.className = 'skin-swatch' + (k === (p.skin || 'default') ? ' active' : '')
      el.title = s.name
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
      const co = s[isDark ? 'dark' : 'light']
      el.style.background = `linear-gradient(135deg,${co.bg} 50%,${co.wall} 50%)`
      el.dataset.skin = k
      el.addEventListener('click', () => {
        sw.querySelectorAll('.skin-swatch').forEach(x => x.classList.remove('active'))
        el.classList.add('active')
        document.documentElement.setAttribute('data-skin', k)
        Score.setPrefs({ skin: k })
      })
      sw.appendChild(el)
    }
  },

  _initSettings() {
    const p = Score.prefs()
    this._updSoundBtn(p.sound !== false)
    this._updRecords()
    this._buildSpeedBtns()
    this._buildFontSizeBtns()
    this._buildAchievements()
    document.getElementById('btn-clear-leaderboard').addEventListener('click', () => {
      if (confirm('确定清空排行榜?')) { Score.clearLeaderboard(); this.updateStats() }
    })
  },

  _buildSpeedBtns() {
    const p = Score.prefs()
    const btns = document.querySelectorAll('#speed-btns .btn')
    btns.forEach(b => {
      b.classList.toggle('active', b.dataset.speed === (p.moveSpeed || 'medium'))
      b.addEventListener('click', () => {
        btns.forEach(x => x.classList.remove('active'))
        b.classList.add('active')
        Score.setPrefs({ moveSpeed: b.dataset.speed })
      })
    })
  },

  _buildFontSizeBtns() {
    const p = Score.prefs()
    const target = document.getElementById('font-size-btns')
    if (!target) return
    target.innerHTML = ''
    for (const [k, label] of Object.entries(FONT_SIZE_LABELS)) {
      const b = document.createElement('button')
      b.className = 'btn btn-sm' + (k === (p.fontSize || 'medium') ? ' active' : '')
      b.dataset.size = k
      b.textContent = label
      b.addEventListener('click', () => {
        target.querySelectorAll('.btn').forEach(x => x.classList.remove('active'))
        b.classList.add('active')
        Score.setPrefs({ fontSize: k })
        this._applyFontSize(k)
      })
      target.appendChild(b)
    }
  },

  _applyFontSize(size) {
    const px = FONT_SIZE_VALUES[size] || 16
    document.documentElement.style.setProperty('--font-size-base', px + 'px')
  },

  _buildAchievements() {
    const el = document.getElementById('achievements-display')
    if (!el) return
    const a = Score.achievements()
    const defs = Score.ACH_DEFS
    el.innerHTML = defs.map(d => {
      const unlocked = !!a[d.id]
      return `<span style="display:inline-block;margin:.15rem .25rem;padding:.1rem .3rem;border:1px solid ${unlocked ? 'var(--accent)' : 'var(--border)'};border-radius:2px;font-size:.6rem;opacity:${unlocked ? 1 : 0.4}">${d.icon} ${d.label}</span>`
    }).join('')
  },

  _updSoundBtn(on) { const b = document.getElementById('btn-sound-toggle'); if (b) b.textContent = on ? '\u5F00' : '\u5173' },

  _updRecords() {
    const el = document.getElementById('best-records-display')
    if (!el) return
    const r = Score.best()
    let h = ''
    for (const d of DIFF_ORDER) {
      const inf = DIFF[d], rec = r[d]
      if (rec) {
        const m = Math.floor(rec.time / 60), s = rec.time % 60
        h += `<div>${inf.label}: ${m}\u5206${s}\u79D2 / ${rec.steps}\u6B65 (${rec.date})</div>`
      } else {
        h += `<div>${inf.label}: \u6682\u65E0\u8BB0\u5F55</div>`
      }
    }
    el.innerHTML = h || '<div style="color:var(--text-muted)">\u6682\u65E0\u8BB0\u5F55</div>'
  },

  getDiff() { const a = document.querySelector('#diff-cards .diff-card.active'); return a ? a.dataset.diff : 'normal' },
  getMode() { const a = document.querySelector('#mode-row .mode-btn.active'); return a ? a.dataset.mode : 'standard' },

  getChallenge() {
    const tc = document.getElementById('ch-time-cb'), sc = document.getElementById('ch-steps-cb')
    return {
      time: tc.checked ? parseInt(document.getElementById('ch-time-val').value) || 300 : null,
      steps: sc.checked ? parseInt(document.getElementById('ch-steps-val').value) || 500 : null
    }
  },

  getSeed() { const v = document.getElementById('seed-input').value.trim(); return v ? hashStr(v) : null },

  showMenu() {
    document.getElementById('hero-section').classList.remove('hidden')
    document.getElementById('game-section').classList.remove('active')
    ;['win-modal', 'fail-modal', 'pause-modal', 'settings-modal', 'confirm-modal'].forEach(id => document.getElementById(id).classList.add('hidden'))
    document.getElementById('navbar').classList.add('scrolled')
    document.getElementById('nav-center').innerHTML = ''
    document.body.classList.remove('playing')
  },

  showGame(diff, mode, seed, isDaily, challenge, campaignIdx, campaignTotal) {
    document.getElementById('hero-section').classList.add('hidden')
    document.getElementById('game-section').classList.add('active')
    ;['win-modal', 'fail-modal', 'pause-modal', 'settings-modal', 'confirm-modal'].forEach(id => document.getElementById(id).classList.add('hidden'))
    document.getElementById('navbar').classList.add('scrolled')
    document.body.classList.add('playing')
    const isCamp = campaignIdx != null
    document.getElementById('hud-diff').textContent = isCamp
      ? `🏆 第 ${campaignIdx+1}/${campaignTotal} 关 · ${DIFF[diff].label}`
      : `${DIFF[diff].label} ${MODE_LABELS[mode] || ''}`
    document.getElementById('hud-seed').textContent = seed != null ? `#${String(seed % 1000000).padStart(6, '0')}` : ''
    if (isDaily) document.getElementById('hud-seed').textContent += ' \u6BCF\u65E5'
    const cd = document.getElementById('hud-countdown')
    if (challenge && (challenge.time || challenge.steps)) {
      const p = []
      if (challenge.time) p.push(`\u9650\u65F6${challenge.time}s`)
      if (challenge.steps) p.push(`\u9650\u6B65${challenge.steps}\u6B65`)
      cd.style.display = ''; cd.textContent = p.join(' \u00B7 ')
    } else cd.style.display = 'none'
    Score.setPrefs({ difficulty: diff, mode })
  },

  showPause()   { document.getElementById('pause-modal').classList.remove('hidden') },
  hidePause()   { document.getElementById('pause-modal').classList.add('hidden') },
  showConfirm(m){ document.getElementById('confirm-msg').textContent = m || '\u5F53\u524D\u8FDB\u5EA6\u5C06\u4E22\u5931'; document.getElementById('confirm-modal').classList.remove('hidden') },
  hideConfirm() { document.getElementById('confirm-modal').classList.add('hidden') },

  showWin(time, steps, isNB, prev, stats, mazeMetrics, score, newAch) {
    document.getElementById('win-time').textContent = time
    document.getElementById('win-steps').textContent = steps
    const comp = document.getElementById('best-compare')
    if (isNB) comp.innerHTML = '<span class="new-best">\u2605 \u65B0\u7EAA\u5F55!</span>'
    else if (prev) { const m = Math.floor(prev.time / 60), s = prev.time % 60; comp.innerHTML = `\u6700\u4F73: ${m}\u5206${s}\u79D2 / ${prev.steps}\u6B65` }
    else comp.innerHTML = ''
    const det = document.getElementById('stats-detail')
    if (stats) det.innerHTML = `<div class="sd-i"><div class="sd-v">${stats.wallBumps || 0}</div>\u649E\u5899</div><div class="sd-i"><div class="sd-v">${stats.backtracks || 0}</div>\u56DE\u6EAF</div><div class="sd-i"><div class="sd-v">${stats.efficiency || '?'}</div>\u6548\u7387</div>`
    else det.innerHTML = ''
    // Score display
    const scoreEl = document.getElementById('win-score')
    if (score) scoreEl.textContent = `\u5F97\u5206: ${score}`
    else scoreEl.textContent = ''
    const achEl = document.getElementById('win-achievements')
    if (achEl && newAch && newAch.length > 0) {
      const defs = Score.ACH_DEFS
      achEl.innerHTML = newAch.map(id => {
        const d = defs.find(x => x.id === id)
        return d ? `<span style="margin:0 .2rem">${d.icon} ${d.label}</span>` : ''
      }).join('')
      achEl.style.display = ''
    } else if (achEl) achEl.style.display = 'none'
    // Maze metrics
    const mz = document.getElementById('maze-stats')
    if (mazeMetrics) {
      mz.innerHTML = `<div style="display:flex;gap:.8rem;justify-content:center">
        <span>\u6B7B\u8DEF ${mazeMetrics.deadEndPct.toFixed(0)}%</span>
        <span>\u89E3\u8986\u76D6 ${mazeMetrics.solutionPct.toFixed(1)}%</span>
        <span>\u7ED5\u66F2 ${mazeMetrics.tortuosity.toFixed(2)}</span>
        <span>\u5206\u5C94 ${mazeMetrics.branchFactor.toFixed(1)}</span>
      </div>`
    } else mz.innerHTML = ''
    document.getElementById('win-modal').classList.remove('hidden')
  },

  showFail(reason, time, steps) {
    const msg = reason === 'time' ? '\u65F6\u95F4\u8017\u5C3D!' : reason === 'steps' ? '\u6B65\u6570\u8017\u5C3D!' : reason === 'collapse' ? '\u88AB\u5D29\u584C\u541E\u566C!' : '\u6311\u6218\u5931\u8D25!'
    document.getElementById('fail-reason').textContent = msg
    document.getElementById('fail-time').textContent = time
    document.getElementById('fail-steps').textContent = steps
    document.getElementById('fail-modal').classList.remove('hidden')
  },

  showSettings() { document.getElementById('settings-modal').classList.remove('hidden'); this._updRecords(); this._buildAchievements() },
  hideSettings() { document.getElementById('settings-modal').classList.add('hidden') },

  updateHUD(time, steps, cd, gems, dist) {
    document.getElementById('hud-timer').textContent = time
    document.getElementById('hud-steps').textContent = steps
    if (cd) document.getElementById('hud-countdown').textContent = cd
    const gel = document.getElementById('hud-gems')
    if (gems) { gel.style.display = ''; gel.textContent = `\uD83D\uDC8E ${gems.collected}/${gems.total}` }
    else gel.style.display = 'none'
    const del = document.getElementById('hud-dist')
    if (del && dist != null) del.textContent = '📍 ' + dist
  },

  updateHelpers(hint, ghost, fog, bc, endLocked) {
    const set = (id, a) => { const b = document.getElementById(id); if (b) b.classList.toggle('active', a) }
    set('btn-hint', hint); set('btn-ghost', ghost); set('btn-breadcrumb', bc)
    const fb = document.getElementById('btn-fog')
    if (typeof fog === 'number') { fb.textContent = `\u706B\u70AC ${fog}`; fb.classList.add('active') }
    else { fb.textContent = '\u8FF7\u96FE'; fb.classList.toggle('active', fog) }
    const d = (id, dis) => { const b = document.getElementById(id); if (b) b.classList.toggle('disabled', dis) }
    d('btn-breadcrumb', this._mode === 'torch' || this._mode === 'torchpro' || this._mode === 'collapse'); d('btn-hint', this._mode === 'torch' || this._mode === 'torchpro')
  },

  toggleTheme() {
    const c = document.documentElement.getAttribute('data-theme')
    const n = c === 'dark' ? '' : c === 'light' ? 'dark' : 'light'
    if (n) document.documentElement.setAttribute('data-theme', n)
    else document.documentElement.removeAttribute('data-theme')
    Score.setPrefs({ theme: n || null })
  },

  startKbFade() { document.getElementById('kb-hint').classList.add('fading') },
  pulseTimer(w)  { document.getElementById('btn-pause-game').classList.toggle('warning', w) },
  setChallenge(c){ this._challenge = c },
  setMode(m)     { this._mode = m },

  showMetricsPanel(metrics, seed, diff) {
    const el = document.getElementById('mp-content')
    if (!el) return
    if (!metrics) { el.innerHTML = '<div style="padding:.5rem;color:var(--text-muted);font-size:.65rem;text-align:center">生成中...</div>'; return }
    const diffLabel = diff ? {beginner:'入门',normal:'普通',hard:'困难',hell:'地狱'}[diff] || diff : ''
    el.innerHTML =
      `<div class="mp-title">${diffLabel}</div>` +
      `<div class="mp-row"><span class="mp-label">迂回度</span><span class="mp-val">${metrics.tortuosity ? metrics.tortuosity.toFixed(2) : '?'}</span></div>` +
      `<div class="mp-row"><span class="mp-label">死路率</span><span class="mp-val">${metrics.deadEndPct ? metrics.deadEndPct.toFixed(1) + '%' : '?'}</span></div>` +
      `<div class="mp-row"><span class="mp-label">死路深</span><span class="mp-val">${metrics.deadEndLen ? metrics.deadEndLen.toFixed(1) : '?'}</span></div>` +
      `<div class="mp-row"><span class="mp-label">解覆盖率</span><span class="mp-val">${metrics.solutionPct ? metrics.solutionPct.toFixed(1) + '%' : '?'}</span></div>` +
      `<div class="mp-row"><span class="mp-label">分支因子</span><span class="mp-val">${metrics.branchFactor ? metrics.branchFactor.toFixed(2) : '?'}</span></div>` +
      `<div class="mp-row"><span class="mp-label">决策熵</span><span class="mp-val">${metrics.entropy ? metrics.entropy.toFixed(2) : '?'}</span></div>` +
      `<div class="mp-row"><span class="mp-label">分形维</span><span class="mp-val">${metrics.fractalDim ? metrics.fractalDim.toFixed(2) : '?'}</span></div>` +
      `<div class="mp-row"><span class="mp-label">回路</span><span class="mp-val">${metrics.loops != null ? metrics.loops : '?'}</span></div>` +
      (metrics.lambda2 != null ? `<div class="mp-row"><span class="mp-label">λ₂</span><span class="mp-val">${metrics.lambda2.toFixed(4)}</span></div>` : '') +
      (seed != null ? `<div class="mp-seed">#${String(seed % 1000000).padStart(6, '0')}</div>` : '')
  },

  showCampaignReport(levels, summary) {
    const el = document.getElementById('win-modal')
    if (!el) return
    // Remove existing report if any
    const existing = el.querySelector('.campaign-report')
    if (existing) existing.remove()

    const report = document.createElement('div')
    report.className = 'campaign-report'
    report.style.cssText = 'margin-top:8px;border-top:1px solid var(--border-default);padding-top:8px;text-align:left;font-size:12px'

    // Stars
    const starsStr = '★'.repeat(summary.stars) + '☆'.repeat(3 - summary.stars)
    report.innerHTML = `
      <div style="text-align:center;margin-bottom:6px;font-size:16px;color:var(--gold)">${starsStr}</div>
      <div style="display:flex;justify-content:center;gap:16px;margin-bottom:6px;font-size:11px;color:var(--text-secondary)">
        <span>总用时 ${Math.floor(summary.totalTime/60)}:${String(summary.totalTime%60).padStart(2,'0')}</span>
        <span>总步数 ${summary.totalSteps}</span>
        <span>总分 ${summary.totalScore}</span>
        <span>平均效率 ${(summary.avgEfficiency*100).toFixed(0)}%</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;color:var(--text-secondary)">
        <thead><tr>
          <th style="padding:2px 4px;text-align:center;border-bottom:1px solid var(--border-default);color:var(--text-tertiary)">#</th>
          <th style="padding:2px 4px;text-align:center;border-bottom:1px solid var(--border-default);color:var(--text-tertiary)">难度</th>
          <th style="padding:2px 4px;text-align:center;border-bottom:1px solid var(--border-default);color:var(--text-tertiary)">用时</th>
          <th style="padding:2px 4px;text-align:center;border-bottom:1px solid var(--border-default);color:var(--text-tertiary)">步数</th>
          <th style="padding:2px 4px;text-align:center;border-bottom:1px solid var(--border-default);color:var(--text-tertiary)">效率</th>
          <th style="padding:2px 4px;text-align:center;border-bottom:1px solid var(--border-default);color:var(--text-tertiary)">得分</th>
        </tr></thead>
        <tbody>
          ${levels.map(l => {
            const diffLabels = { beginner:'极简', normal:'普通', hard:'困难', hell:'地狱' }
            const m = Math.floor(l.time / 60), s = l.time % 60
            const effPct = Math.round((l.efficiency || 0) * 100)
            const bestEff = Math.max(...levels.map(x => Math.round((x.efficiency || 0) * 100)))
            const isBest = effPct === bestEff
            return `<tr${isBest ? ' style="color:var(--gold);font-weight:600"' : ''}>
              <td style="padding:2px 4px;text-align:center">${l.level}</td>
              <td style="padding:2px 4px;text-align:center">${diffLabels[l.diff] || l.diff}</td>
              <td style="padding:2px 4px;text-align:center;font-family:var(--font-mono)">${m}:${String(s).padStart(2,'0')}</td>
              <td style="padding:2px 4px;text-align:center;font-family:var(--font-mono)">${l.steps}</td>
              <td style="padding:2px 4px;text-align:center">
                <div style="display:flex;align-items:center;gap:4px">
                  <div style="flex:1;height:4px;background:var(--bg-primary);border-radius:2px;overflow:hidden">
                    <div style="height:100%;width:${effPct}%;background:var(--gold);border-radius:2px"></div>
                  </div>
                  <span>${effPct}%</span>
                </div>
              </td>
              <td style="padding:2px 4px;text-align:center;font-family:var(--font-mono)">${l.score}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    `
    const card = el.querySelector('.modal-card')
    if (card) card.appendChild(report)
  }
}

/* Local helper for seed input */
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0 }
  return Math.abs(h)
}
