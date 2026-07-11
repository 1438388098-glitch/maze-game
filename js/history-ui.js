/* ── HistoryUI: history modal rendering and interaction ── */

import { Score } from './score.js'
import { Charts } from './charts.js'

export const HistoryUI = {
  _filter: { mode: '', diff: '' },

  open() {
    const el = document.getElementById('history-modal')
    if (!el) return
    el.classList.remove('hidden')
    this._filter = { mode: '', diff: '' }
    this._render()
  },

  close() {
    const el = document.getElementById('history-modal')
    if (el) el.classList.add('hidden')
  },

  _render() {
    const hist = Score.getHistory()
    const filtered = hist.filter(e => {
      if (this._filter.mode && e.mode !== this._filter.mode) return false
      if (this._filter.diff && e.diff !== this._filter.diff) return false
      return true
    })

    // Update filter buttons
    document.querySelectorAll('.history-filter').forEach(b => {
      const isAll = b.dataset.type === 'all'
      const hasFilter = !!this._filter.mode || !!this._filter.diff
      b.classList.toggle('active', isAll ? !hasFilter : b.dataset.value === (this._filter[b.dataset.type] || ''))
    })

    // Charts
    this._renderCharts(filtered)

    // Stats summary
    const stats = Score.getHistoryStats(this._filter.mode || this._filter.diff ? Object.keys(this._filter).reduce((acc, k) => { if (this._filter[k]) acc[k] = this._filter[k]; return acc }, {}) : null)
    const statsEl = document.getElementById('history-stats')
    if (statsEl) {
      statsEl.innerHTML = `
        <span>共 ${stats.count} 局</span>
        <span>平均分 ${stats.avgScore}</span>
        <span>最佳时间 ${stats.bestTime < Infinity ? Math.floor(stats.bestTime/60) + ':' + String(stats.bestTime%60).padStart(2, '0') : '--'}</span>
        <span>最高分 ${stats.maxScore}</span>
      `
    }

    // List
    const listEl = document.getElementById('history-list')
    if (!listEl) return
    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="history-empty">暂无记录，开始一局游戏吧</div>'
      return
    }
    const diffLabels = { beginner: '极简', normal: '普通', hard: '困难', hell: '地狱' }
    const modeIcon = { standard: '🎮', torch: '🔦', treasure: '💎', torchpro: '🦇', campaign: '🏆' }
    listEl.innerHTML = filtered.map(e => {
      const m = Math.floor(e.time / 60), s = e.time % 60
      return `<div class="history-item">
        <span class="hi-date">${e.date || '--'}</span>
        <span class="hi-mode">${modeIcon[e.mode] || '🎮'}</span>
        <span class="hi-diff">${diffLabels[e.diff] || e.diff || '--'}</span>
        <span class="hi-time">${e.time != null ? m + ':' + String(s).padStart(2, '0') : '--'}</span>
        <span class="hi-steps">${e.steps != null ? e.steps : '--'}</span>
        <span class="hi-score">${e.score != null ? e.score : '--'}</span>
      </div>`
    }).join('')
  },

  _renderCharts(data) {
    if (data.length < 2) {
      ;['chart-score', 'chart-time', 'chart-eff'].forEach(id => {
        const c = document.getElementById(id)
        if (c) Charts.drawLineChart(c, [{ label: '', value: 0 }], {})
      })
      return
    }

    // Score chart
    const scoreData = data.map(e => ({ label: e.date, value: e.score })).reverse()
    const scoreC = document.getElementById('chart-score')
    if (scoreC) Charts.drawLineChart(scoreC, scoreData, { color: '#D4B382' })

    // Time chart (lower is better)
    const timeData = data.map(e => ({ label: e.date, value: e.time })).reverse()
    const timeC = document.getElementById('chart-time')
    if (timeC) Charts.drawLineChart(timeC, timeData, { color: '#66BB6A' })

    // Efficiency chart
    const effData = data.map(e => ({ label: e.date, value: Math.round((e.efficiency || 0) * 100) })).reverse()
    const effC = document.getElementById('chart-eff')
    if (effC) Charts.drawLineChart(effC, effData, { color: '#C89F68' })
  },

  setFilter(type, value) {
    if (type === 'all') { this._filter = { mode: '', diff: '' }; this._render(); return }
    if (type === 'mode') this._filter.mode = this._filter.mode === value ? '' : value
    if (type === 'diff') this._filter.diff = this._filter.diff === value ? '' : value
    this._render()
  }
}