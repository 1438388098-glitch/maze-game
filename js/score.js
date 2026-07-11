/* ── Score: localStorage persistence + leaderboard + achievements ── */

import { MODE_SCORE_MULT, DIFF_SCORE_MULT, HISTORY_MAX, HISTORY_STORAGE_KEY } from './config.js'

export const Score = {
  _get(k, f) { try { const d = localStorage.getItem(k); return d ? JSON.parse(d) : f } catch (e) { return f } },
  _set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { /* ignore */ } },

  best(key) { if (!key) key = 'mz-best'; return this._get(key, { beginner: null, normal: null, hard: null, hell: null, super: null, supermax: null }) },

  setBest(diff, time, steps, key) {
    if (!key) key = 'mz-best'
    const r = this.best(key)
    const e = { time, steps, date: new Date().toISOString().split('T')[0] }
    const c = r[diff]
    if (!c || time < c.time || (time === c.time && steps < c.steps)) { r[diff] = e; this._set(key, r); return true }
    return false
  },

  dailyBest(ds) { return this._get(`mz-daily-${ds}`, null) },

  setDailyBest(ds, time, steps) {
    const c = this.dailyBest(ds)
    if (!c || time < c.time || (time === c.time && steps < c.steps)) { this._set(`mz-daily-${ds}`, { time, steps, date: ds }); return true }
    return false
  },

  /* ── Leaderboard ── */
  leaderboard() { return this._get('mz-leaderboard', []) },

  addLeaderboard(entry) {
    const lb = this.leaderboard()
    lb.push(entry)
    lb.sort((a, b) => b.score - a.score)
    if (lb.length > 50) lb.length = 50
    this._set('mz-leaderboard', lb)
  },

  clearLeaderboard() { this._set('mz-leaderboard', []) },

  /* ── Campaign ── */
  campaignProgress() { return this._get('mz-campaign', null) },

  setCampaignProgress(p) { this._set('mz-campaign', { ...p }) },

  resetCampaign() { this._set('mz-campaign', null) },

  /* ── Score calculation ── */
  calcScore(metrics, playerSteps, mode, elapsed, moveCd, diff) {
    if (!metrics) return 0
    const deadPct = metrics.deadEndPct || 0
    const tort = metrics.tortuosity || 1
    const deadLen = Math.max(1, metrics.deadEndLen || 1)
    const branch = Math.max(1, metrics.branchFactor || 1)
    const mcells = metrics.totalCells || 1
    const optLen = metrics.solutionPct ? Math.round(metrics.totalCells * metrics.solutionPct / 100) : mcells
    const efficiency = Math.min(1, optLen / Math.max(1, playerSteps))
    const modeMul = MODE_SCORE_MULT[mode] || 1.0
    const diffMul = DIFF_SCORE_MULT[diff] || 1.0
    const baseCd = 130
    const adjCd = (moveCd && moveCd > 0) ? moveCd : baseCd
    const adjustedTime = (elapsed || 0) * (adjCd / baseCd)
    const timeFactor = 1 + adjustedTime / 120
    const raw = deadPct * tort * deadLen * branch * efficiency * modeMul * diffMul / timeFactor * 10
    return Math.max(0, Math.round(raw))
  },

  resetAll() {
    this._set('mz-best', { beginner: null, normal: null, hard: null, hell: null, super: null, supermax: null })
    this._set('mz-best-torch', { beginner: null, normal: null, hard: null, hell: null, super: null, supermax: null })
    this._set('mz-best-treasure', { beginner: null, normal: null, hard: null, hell: null, super: null, supermax: null })
    this._set('mz-best-torchpro', { beginner: null, normal: null, hard: null, hell: null, super: null, supermax: null })
    this.clearLeaderboard()
    this.clearHistory()
    // Clear all ghosts
    const toRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('mz-ghost-')) toRemove.push(k)
    }
    toRemove.forEach(k => localStorage.removeItem(k))
  },

  prefs() { return this._get('mz-prefs', { difficulty: 'normal', sound: true, skin: 'default', breadcrumb: true, mode: 'standard', moveSpeed: 'medium', engine: 'standard', fontSize: 'medium', seedHistory: [], campaignCounts: { beginner: 1, normal: 1, hard: 1, hell: 1, super: 0, supermax: 0 } }) },
  setPrefs(p) { this._set('mz-prefs', { ...this.prefs(), ...p }) },

  trackSeed(seed) {
    if (seed == null) return
    const p = this.prefs()
    const hist = p.seedHistory || []
    const s = String(seed)
    const idx = hist.indexOf(s)
    if (idx !== -1) hist.splice(idx, 1)
    hist.unshift(s)
    if (hist.length > 5) hist.length = 5
    this.setPrefs({ seedHistory: hist })
  },

  /* ── Achievements ── */
  ACH_DEFS: [
    { id: 'first_win',   label: '初入迷宫',   desc: '完成任意难度', icon: '🏁' },
    { id: 'all_beginner', label: '横扫入门',   desc: '完成极简入门', icon: '🌟' },
    { id: 'all_normal',  label: '休闲玩家',   desc: '完成休闲普通', icon: '⭐' },
    { id: 'all_hard',    label: '挑战者',     desc: '完成进阶困难', icon: '🔥' },
    { id: 'all_hell',    label: '地狱使者',   desc: '完成硬核地狱', icon: '💀' },
    { id: 'speed_demon', label: '速通达人',   desc: '普通模式 <60秒', icon: '⏩' },
    { id: 'efficient',   label: '步数优化',   desc: '效率 >80%', icon: '🎯' },
    { id: 'torch_master', label: '暗夜行者',  desc: '完成火炬模式', icon: '🔦' },
    { id: 'torchpro_master', label: '黑灯大师', desc: '完成黑灯模式', icon: '🦇' },
    { id: 'treasure_hunter', label: '寻宝猎人', desc: '完成寻宝模式', icon: '💎' },
    { id: 'wall_basher', label: '撞墙大师',  desc: '累计撞墙100次', icon: '🧱' },
    { id: 'never_give_up', label: '永不言弃', desc: '失败10次', icon: '💪' },
    { id: 'daily_devotee', label: '每日信徒', desc: '完成7天每日挑战', icon: '📅' },
    { id: 'score_king',  label: '得分王',    desc: '单次得分 >10000', icon: '👑' }
  ],

  achievements() {
    return this._get('mz-achievements', {})
  },

  unlockAchievement(id) {
    const a = this.achievements()
    if (a[id]) return false
    a[id] = { unlocked: true, date: new Date().toISOString().split('T')[0] }
    this._set('mz-achievements', a)
    return true
  },

  checkAchievements(engine, elapsed) {
    const a = this.achievements()
    const newly = []
    const tryUnlock = (id) => { if (!a[id] && this.unlockAchievement(id)) newly.push(id) }

    if (engine.state === 'won') tryUnlock('first_win')
    if (engine.state === 'won' && engine.diff === 'beginner') tryUnlock('all_beginner')
    if (engine.state === 'won' && engine.diff === 'normal') tryUnlock('all_normal')
    if (engine.state === 'won' && engine.diff === 'hard') tryUnlock('all_hard')
    if (engine.state === 'won' && engine.diff === 'hell') tryUnlock('all_hell')
    if (engine.state === 'won' && engine.mode === 'torch') tryUnlock('torch_master')
    if (engine.state === 'won' && engine.mode === 'torchpro') tryUnlock('torchpro_master')
    if (engine.state === 'won' && engine.mode === 'treasure') tryUnlock('treasure_hunter')
    if (engine.state === 'won' && elapsed != null && elapsed < 60 && engine.diff === 'normal') tryUnlock('speed_demon')
    if (engine.state === 'won' && engine.solutionPath) {
      const eff = engine.solutionPath.length / Math.max(1, engine.steps)
      if (eff >= 0.8) tryUnlock('efficient')
    }
    if (engine.wallBumps >= 100) tryUnlock('wall_basher')
    if (engine.failCount >= 10) tryUnlock('never_give_up')

    const dailyKey = `mz-daily-${new Date().toISOString().split('T')[0]}`
    if (engine.isDaily && this._get(dailyKey, null)) {
      const days = new Set()
      for (let i = 0; i < 365; i++) {
        const d = new Date(); d.setDate(d.getDate() - i)
        const ds = d.toISOString().split('T')[0]
        if (this._get(`mz-daily-${ds}`, null)) days.add(ds)
      }
      if (days.size >= 7) tryUnlock('daily_devotee')
    }
    return newly
  },

  /* ── History ── */
  addHistory(entry) {
    const hist = this.getHistory()
    const e = {
      id: 'h_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      date: new Date().toISOString().split('T')[0],
      ...entry
    }
    hist.unshift(e)
    if (hist.length > HISTORY_MAX) hist.length = HISTORY_MAX
    this._set(HISTORY_STORAGE_KEY, hist)
    return e
  },

  getHistory() {
    return this._get(HISTORY_STORAGE_KEY, [])
  },

  getHistoryStats(filter) {
    const hist = this.getHistory()
    let filtered = hist
    if (filter) {
      if (filter.mode) filtered = filtered.filter(e => e.mode === filter.mode)
      if (filter.diff) filtered = filtered.filter(e => e.diff === filter.diff)
    }
    if (filtered.length === 0) return { count: 0, avgScore: 0, avgTime: 0, avgEfficiency: 0, maxScore: 0, bestTime: Infinity }
    const scores = filtered.map(e => e.score).filter(s => s > 0)
    const times = filtered.map(e => e.time).filter(t => t > 0)
    const effs = filtered.map(e => e.efficiency).filter(e => e > 0)
    return {
      count: filtered.length,
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      avgTime: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
      avgEfficiency: effs.length ? Math.round(effs.reduce((a, b) => a + b, 0) / effs.length * 100) / 100 : 0,
      maxScore: scores.length ? Math.max(...scores) : 0,
      bestTime: times.length ? Math.min(...times) : 0
    }
  },

  clearHistory() {
    this._set(HISTORY_STORAGE_KEY, [])
  },

  /* ── Ghost ── */
  saveGhost(seed, diff, mode, path, time, steps) {
    if (seed == null || diff == null) return
    const key = 'mz-ghost-' + seed + '-' + diff + '-' + mode
    this._set(key, { seed, diff, mode, path, time, steps, date: new Date().toISOString().split('T')[0] })
  },

  loadGhost(seed, diff, mode) {
    if (seed == null || diff == null) return null
    const key = 'mz-ghost-' + seed + '-' + diff + '-' + mode
    return this._get(key, null)
  },

  listGhosts(diff, mode) {
    const ghosts = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('mz-ghost-')) {
        try {
          const g = JSON.parse(localStorage.getItem(k))
          if ((!diff || g.diff === diff) && (!mode || g.mode === mode)) ghosts.push(g)
        } catch (e) { /* skip */ }
      }
    }
    return ghosts
  },
}
