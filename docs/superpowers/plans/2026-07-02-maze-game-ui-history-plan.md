# 迷宫游戏 — 闯关报告/历史图表/UI 重构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成闯关完成报告、历史记录与进度图表、UI 全面重构三大模块

**Architecture:** 零依赖纯前端，CSS 变量 + Canvas 手绘图表 + localStorage 持久化，所有新功能以现有 ES Module 模式扩展

**Tech Stack:** 纯 ES Modules / Canvas 2D / CSS Variables / localStorage

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `css/style.css` | 重写 | 全套色彩系统、布局、控件样式 |
| `index.html` | 修改 | 历史记录弹窗 DOM 结构 |
| `js/config.js` | 修改 | 新增历史相关常量 |
| `js/score.js` | 修改 | 新增 `addHistory` / `getHistory` / `getHistoryStats` 方法 |
| `js/app.js` | 修改 | 闯关数据收集、历史记录入口、弹窗逻辑 |
| `js/charts.js` | 新建 | Canvas 图表绘制组件 |
| `js/history-ui.js` | 新建 | 历史记录 UI 渲染与交互 |

---

### Task 1: CSS 色彩系统重构

**Files:**
- Modify: `css/style.css:1-220`

- [ ] **Step 1: 替换 CSS 变量为新的色彩系统**

```css
:root {
  --bg-primary: #161616;
  --bg-secondary: #1E1E1E;
  --bg-input: #222222;
  --border-default: #333333;
  --border-active: #C89F68;
  --gold: #D4B382;
  --accent: #C89F68;
  --accent-dark: #382C20;
  --text-primary: #E8E8E8;
  --text-secondary: #BBBBBB;
  --text-tertiary: #999999;
  --text-disabled: #707070;
  --color-success: #66BB6A;
  --color-danger: #EF5350;
  --overlay-bg: rgba(0,0,0,0.65);
  --font-serif: 'Noto Serif SC','Source Han Serif SC','STSong','SimSun',serif;
  --font-sans: 'Inter',system-ui,-apple-system,sans-serif;
  --font-mono: 'SF Mono','Cascadia Code','Consolas',monospace;
  --max-w: 520px;
  --nav-h: 46px;
  --ease-out: cubic-bezier(.16,1,.3,1);
  --gold-grad: linear-gradient(135deg, #B88C57, #D4B382);
}
```

- [ ] **Step 2: 更新暗色主题变量（注意：dark 主题现在就是默认风格，所以 data-theme="dark" 基本一致，light 主题需要额外映射）**

```css
[data-theme="dark"] {
  --bg-primary: #161616;
  --bg-secondary: #1E1E1E;
  --bg-input: #222222;
  --border-default: #333333;
  --text-primary: #E8E8E8;
  --text-secondary: #BBBBBB;
  --text-tertiary: #999999;
  --text-disabled: #707070;
  --overlay-bg: rgba(0,0,0,0.65);
}
[data-theme="light"] {
  --bg-primary: #F5F0EB;
  --bg-secondary: #FFFFFF;
  --bg-input: #FFFFFF;
  --border-default: #D0C8BE;
  --text-primary: #1A1A1A;
  --text-secondary: #555555;
  --text-tertiary: #999999;
  --text-disabled: #BBBBBB;
  --overlay-bg: rgba(0,0,0,0.4);
}
```

- [ ] **Step 3: 更新 body 背景、文字颜色引用新变量**

```css
body {
  background: var(--bg-primary);
  color: var(--text-primary);
}
```

- [ ] **Step 4: 更新导航栏 (`navbar`) 样式**

```css
.navbar {
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-default);
}
.navbar.scrolled { border-bottom-color: var(--border-default); }
```

- [ ] **Step 5: 重写 Heroes 标题区（移除遮罩，文字发光）**

```css
.hero h1 { font-size: 42px; color: var(--gold); font-weight: 700; }
.hero h1 .accent { color: var(--gold); }
.hero h1 .accent::after { display: none; }
.hero h1 { text-shadow: 0 0 20px rgba(212,179,130,0.15); }
.hero .subtitle { font-size: 14px; color: var(--text-tertiary); }
```

- [ ] **Step 6: 重写难度按钮 (`diff-card`) — 76px 高度，圆角 8px，等宽均分，间距 20px**

```css
.diff-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 0;
}
.diff-card {
  height: 76px;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  background: var(--bg-secondary);
  padding: 10px 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
  font-family: var(--font-sans);
  transform: translateY(0);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.diff-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: 0 0 12px rgba(200,159,104,0.15);
}
.diff-card.active {
  background: var(--gold-grad);
  border-color: var(--border-active);
  box-shadow: 0 0 16px rgba(200,159,104,0.3);
}
.diff-card .card-label { font-size: 18px; font-weight: 500; color: var(--text-primary); line-height: 1.3; }
.diff-card .card-size { font-size: 13px; color: var(--text-tertiary); margin-top: 2px; }
.diff-card.active .card-label { color: #FFF; }
.diff-card.active .card-size { color: rgba(255,255,255,0.7); }
```

- [ ] **Step 7: 重写模式按钮 (`mode-btn`) — 36px 高度，圆角 4px，等距均分**

```css
.mode-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 0;
}
.mode-btn {
  height: 36px;
  border-radius: 4px;
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-tertiary);
  padding: 4px 8px;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
  font-family: var(--font-sans);
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.mode-btn:hover { border-color: var(--accent); color: var(--text-primary); }
.mode-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #FFF;
}
.mode-btn .mode-label { font-weight: 500; }
.mode-btn .mode-desc { font-size: 11px; color: var(--text-tertiary); opacity: 0.7; }
.mode-btn.active .mode-desc { color: rgba(255,255,255,0.7); }
```

- [ ] **Step 8: 重写种子行、挑战行、引擎行**

```css
.seed-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-family: var(--font-sans);
  font-size: 15px;
}
.seed-input {
  width: 120px;
  padding: 8px 12px;
  border: 1px solid var(--border-default);
  border-radius: 4px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 14px;
  text-align: center;
  outline: none;
  transition: border-color 0.2s;
}
.seed-input:focus { border-color: var(--border-active); }
.seed-input::placeholder { color: var(--text-disabled); }

.challenge-row {
  display: flex;
  justify-content: center;
  gap: 16px;
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--text-secondary);
}
.challenge-row label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.challenge-row input[type=number] {
  width: 60px;
  padding: 6px 8px;
  border: 1px solid var(--border-default);
  border-radius: 4px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 13px;
  text-align: right;
  outline: none;
}
.challenge-row input[type=number]:focus { border-color: var(--border-active); }
.challenge-row input[type=number]:disabled { opacity: 0.35; }

.engine-row { margin-top: 8px; }
.engine-btn {
  font-size: 12px;
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-disabled);
  padding: 4px 10px;
  cursor: pointer;
  border-radius: 3px;
}
.engine-btn.active { border-color: var(--accent); color: var(--accent); background: var(--accent-dark); }
```

- [ ] **Step 9: 重写按钮样式**

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 14px 24px;
  font-family: var(--font-sans);
  font-size: 16px;
  font-weight: 500;
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
  border-radius: 6px;
  line-height: 1.2;
}
.btn:hover { border-color: var(--accent); color: var(--accent); }
.btn-primary {
  background: var(--gold-grad);
  color: #FFF;
  border-color: var(--border-active);
  font-size: 20px;
  font-weight: 700;
  padding: 14px 48px;
}
.btn-primary:hover { filter: brightness(1.1); color: #FFF; }
.btn-sm { font-size: 14px; padding: 8px 16px; }
```

- [ ] **Step 10: 重写 game section 布局（确保 canvas 区域正常）**

```css
.game-section { padding-top: var(--nav-h); height: 100vh; display: none; flex-direction: column; }
.game-section.active { display: flex; }
.game-hud {
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-default);
  flex-wrap: wrap;
  flex-shrink: 0;
}
.game-canvas-wrap {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  justify-content: center;
  overflow: hidden;
  min-height: 200px;
  gap: 8px;
  padding: 8px;
}
```

- [ ] **Step 11: 重写弹窗样式**

```css
.modal-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
}
.modal-card h2 { color: var(--text-primary); }
.modal-card .subtitle { color: var(--text-secondary); }
```

- [ ] **Step 12: 重写 stats-detail 和 排行榜表格**

```css
.stats-detail { border-color: var(--border-default); }
.hero-footer { border-top-color: var(--border-default); }
.hero-footer .hf-val { color: var(--text-secondary); }
.hero-footer .lb-table th { color: var(--text-tertiary); border-bottom-color: var(--border-default); }
.hero-footer .lb-table td { border-bottom-color: var(--border-default); color: var(--text-secondary); }
```

- [ ] **Step 13: 重写响应式适配**

```css
@media(max-width:768px){
  .diff-cards { grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .mode-row { grid-template-columns: repeat(2, 1fr); }
  .hero { padding: var(--nav-h) 16px 0; }
  .game-canvas-wrap { flex-direction: column; align-items: center; }
}
@media(max-width:480px){
  .diff-cards { grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .mode-row { grid-template-columns: repeat(2, 1fr); gap: 6px; }
  .mode-btn { font-size: 12px; }
  .challenge-row { flex-direction: column; align-items: center; }
}
```

- [ ] **Step 14: 新增历史记录弹窗样式**

```css
/* History Modal */
.history-modal { position: fixed; inset: 0; z-index: 300; background: var(--overlay-bg); display: flex; align-items: center; justify-content: center; }
.history-modal.hidden { display: none; }
.history-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  width: 90%;
  max-width: 640px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}
.history-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-default); }
.history-header h2 { font-size: 18px; color: var(--text-primary); }
.history-close { background: none; border: none; color: var(--text-tertiary); font-size: 20px; cursor: pointer; }
.history-filters { display: flex; gap: 8px; padding: 12px 20px; border-bottom: 1px solid var(--border-default); flex-wrap: wrap; }
.history-filter { font-size: 12px; padding: 4px 10px; border: 1px solid var(--border-default); border-radius: 3px; background: transparent; color: var(--text-tertiary); cursor: pointer; }
.history-filter.active { border-color: var(--accent); color: var(--accent); background: var(--accent-dark); }
.history-charts { padding: 16px 20px; border-bottom: 1px solid var(--border-default); }
.history-chart { margin-bottom: 16px; }
.history-chart:last-child { margin-bottom: 0; }
.history-chart h3 { font-size: 13px; color: var(--text-tertiary); margin-bottom: 8px; font-weight: 400; }
.history-chart canvas { display: block; width: 100%; height: 100px; border-radius: 4px; background: var(--bg-primary); }
.history-list { flex: 1; overflow-y: auto; padding: 8px 20px; }
.history-item { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border-default); font-size: 13px; }
.history-item:last-child { border-bottom: none; }
.history-item .hi-date { color: var(--text-tertiary); min-width: 80px; }
.history-item .hi-mode { color: var(--accent); min-width: 40px; }
.history-item .hi-diff { color: var(--text-secondary); min-width: 60px; }
.history-item .hi-time { font-family: var(--font-mono); color: var(--text-primary); min-width: 50px; }
.history-item .hi-steps { font-family: var(--font-mono); color: var(--text-primary); min-width: 40px; }
.history-item .hi-score { font-family: var(--font-mono); color: var(--gold); min-width: 60px; font-weight: 600; }
.history-empty { text-align: center; padding: 40px; color: var(--text-tertiary); font-size: 14px; }
```

- [ ] **Step 15: Commit CSS 重构**

```bash
git add css/style.css
git commit -m "style: complete CSS overhaul — new color system, layout, typography, controls"
```

---

### Task 2: 配置常量扩展

**Files:**
- Modify: `js/config.js:1-2`

- [ ] **Step 1: 新增历史记录常量**

```js
export const HISTORY_MAX = 200
export const HISTORY_STORAGE_KEY = 'mz-history'
```

- [ ] **Step 2: Commit**

```bash
git add js/config.js
git commit -m "feat: add history constants"
```

---

### Task 3: Score 类扩展 — 历史记录持久化

**Files:**
- Modify: `js/score.js:1-5`

- [ ] **Step 1: 新增 `addHistory` 方法**

```js
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
```

需要在 `score.js` 顶部导入常量：

```js
import { HISTORY_MAX, HISTORY_STORAGE_KEY } from './config.js'
```

- [ ] **Step 2: 在 `resetAll` 方法中添加 `clearHistory` 调用**

```js
resetAll() {
    this._set('mz-best', { beginner: null, normal: null, hard: null, hell: null })
    this._set('mz-best-torch', { beginner: null, normal: null, hard: null, hell: null })
    this._set('mz-best-treasure', { beginner: null, normal: null, hard: null, hell: null })
    this._set('mz-best-torchpro', { beginner: null, normal: null, hard: null, hell: null })
    this.clearLeaderboard()
    this.clearHistory()
  },
```

- [ ] **Step 3: Commit**

```bash
git add js/score.js
git commit -m "feat: add history persistence (addHistory/getHistory/getHistoryStats)"
```

---

### Task 4: 闯关数据收集与完成报告

**Files:**
- Modify: `js/app.js:1-5`

- [ ] **Step 1: 在 `_startCampaign()` 中初始化 `_campaignStats` 数组**

找到 `_startCampaign()` 方法，在构建 queue 后添加：

```js
this._campaignStats = []
```

- [ ] **Step 2: 在 `_tryMove` 通关分支中收集闯关数据**

在 `_tryMove` 的 win 检测分支中，在 `if (this.engine.isCampaign)` 之前添加数据收集：

```js
// Collect campaign level stats
if (this.engine.isCampaign) {
  this._campaignStats.push({
    level: this.campaignIdx + 1,
    diff: this.engine.diff,
    time: el,
    steps: this.engine.steps,
    score: score,
    efficiency: eff,
    wallBumps: this.engine.wallBumps,
    backtracks: this.engine.btCount
  })
}
```

- [ ] **Step 3: 在通关完成时调用 `addHistory` 写入历史记录**

在 `_tryMove` 的 win 分支中，在 `UI.showWin` 之前写入历史：

```js
// Record to history (not for campaign — campaign records per-level)
if (!this.engine.isCampaign) {
  Score.addHistory({
    mode: this.engine.mode,
    diff: this.engine.diff,
    time: el,
    steps: this.engine.steps,
    score: score,
    efficiency: parseFloat(eff) / 100,
    wallBumps: this.engine.wallBumps,
    backtracks: this.engine.btCount,
    seed: this.engine.seed,
    isCampaign: false
  })
}
```

- [ ] **Step 4: 闯关通关完成时，生成报告追加到通关弹窗**

在 `if (nextIdx >= this.campaignQueue.length)` 分支中，在 `UI.showWin` 之后追加报告 DOM：

```js
if (nextIdx >= this.campaignQueue.length) {
  UI.showWin(this.timer.getDisp(), steps, false, null, stats, this.engine.mazeMetrics, score, newAch)
  Score.resetCampaign()
  // 计算星级
  const avgEff = this._campaignStats.length
    ? this._campaignStats.reduce((s, l) => s + parseFloat(l.efficiency), 0) / this._campaignStats.length
    : 0
  const stars = avgEff >= 0.8 ? 3 : avgEff >= 0.6 ? 2 : 1
  UI.showCampaignReport(this._campaignStats, {
    totalTime: this._campaignStats.reduce((s, l) => s + l.time, 0),
    totalSteps: this._campaignStats.reduce((s, l) => s + l.steps, 0),
    totalScore: this._campaignStats.reduce((s, l) => s + l.score, 0),
    avgEfficiency: avgEff,
    stars
  })
  // 记录每关到历史
  this._campaignStats.forEach(l => {
    Score.addHistory({
      mode: 'campaign',
      diff: l.diff,
      time: l.time,
      steps: l.steps,
      score: l.score,
      efficiency: parseFloat(l.efficiency) / 100,
      wallBumps: l.wallBumps,
      backtracks: l.backtracks,
      seed: this.engine.seed,
      isCampaign: true
    })
  })
  this._campaignStats = null
  const btnNew = document.getElementById('btn-win-new')
  if (btnNew) { const c = btnNew.cloneNode(true); btnNew.parentNode.replaceChild(c, btnNew); c.textContent = '🏆 闯关完成!'; c.addEventListener('click', () => { this.campaignQueue = null; this._toMenu() }) }
}
```

- [ ] **Step 5: 在 UI 对象中新增 `showCampaignReport` 方法**

在 `ui.js` 中新增方法：

```js
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
          const isBest = l.efficiency === Math.max(...levels.map(x => parseFloat(x.efficiency)))
          return `<tr${isBest ? ' style="color:var(--gold);font-weight:600"' : ''}>
            <td style="padding:2px 4px;text-align:center">${l.level}</td>
            <td style="padding:2px 4px;text-align:center">${diffLabels[l.diff] || l.diff}</td>
            <td style="padding:2px 4px;text-align:center;font-family:var(--font-mono)">${m}:${String(s).padStart(2,'0')}</td>
            <td style="padding:2px 4px;text-align:center;font-family:var(--font-mono)">${l.steps}</td>
            <td style="padding:2px 4px;text-align:center">
              <div style="display:flex;align-items:center;gap:4px">
                <div style="flex:1;height:4px;background:var(--bg-primary);border-radius:2px;overflow:hidden">
                  <div style="height:100%;width:${l.efficiency};background:var(--gold);border-radius:2px"></div>
                </div>
                <span>${l.efficiency}</span>
              </div>
            </td>
            <td style="padding:2px 4px;text-align:center;font-family:var(--font-mono)">${l.score}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>
  `
  el.querySelector('.modal-card').appendChild(report)
}
```

- [ ] **Step 6: Commit**

```bash
git add js/app.js js/ui.js
git commit -m "feat: add campaign report and history recording"
```

---

### Task 5: Canvas 图表组件

**Files:**
- Create: `js/charts.js`

- [ ] **Step 1: 创建图表组件**

```js
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
        ctx.fillStyle = 'var(--text-tertiary)'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('数据不足', canvas.width / 2 / dpr, canvas.height / 2 / dpr)
      }
      return
    }

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
    ctx.strokeStyle = opts.color || 'var(--gold)'
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
    ctx.fillStyle = (opts.color || 'var(--gold)').replace(')', ',0.08)').replace('rgb', 'rgba')
    ctx.fill()

    // Dots
    data.forEach((d, i) => {
      const x = pad.left + cw * i / (data.length - 1)
      const y = pad.top + ch * (1 - (d.value - min) / range)
      ctx.fillStyle = opts.color || 'var(--gold)'
      ctx.beginPath()
      ctx.arc(x, y, 2.5, 0, Math.PI * 2)
      ctx.fill()
    })

    // X labels
    ctx.fillStyle = 'var(--text-tertiary)'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'center'
    const step = Math.max(1, Math.floor(data.length / 6))
    for (let i = 0; i < data.length; i += step) {
      const x = pad.left + cw * i / (data.length - 1)
      const label = typeof data[i].label === 'string' ? data[i].label.slice(5) : data[i].label
      ctx.fillText(label, x, H - 2)
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/charts.js
git commit -m "feat: add Canvas chart component for progress trends"
```

---

### Task 6: 历史记录 UI 组件

**Files:**
- Create: `js/history-ui.js`

- [ ] **Step 1: 创建历史 UI 组件**

```js
/* ── HistoryUI: history modal rendering and interaction ── */

import { MODE_LABELS, MODE_KEYS, DIFF_ORDER, DIFF } from './config.js'
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
      b.classList.toggle('active', b.dataset.filter === 'all' || b.dataset.value === (this._filter[b.dataset.filter] || ''))
    })

    // Charts
    this._renderCharts(filtered)

    // Stats summary
    const stats = Score.getHistoryStats(this._filter.mode || this._filter.diff ? this._filter : null)
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
    listEl.innerHTML = filtered.map(e => {
      const m = Math.floor(e.time / 60), s = e.time % 60
      const modeIcon = { standard: '🎮', torch: '🔦', treasure: '💎', torchpro: '🦇', campaign: '🏆' }
      return `<div class="history-item">
        <span class="hi-date">${e.date}</span>
        <span class="hi-mode">${modeIcon[e.mode] || '🎮'}</span>
        <span class="hi-diff">${diffLabels[e.diff] || e.diff}</span>
        <span class="hi-time">${m}:${String(s).padStart(2, '0')}</span>
        <span class="hi-steps">${e.steps}</span>
        <span class="hi-score">${e.score}</span>
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
    if (type === 'mode') this._filter.mode = this._filter.mode === value ? '' : value
    if (type === 'diff') this._filter.diff = this._filter.diff === value ? '' : value
    this._render()
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/history-ui.js
git commit -m "feat: add history UI component with filters and charts"
```

---

### Task 7: HTML 弹窗结构 + 入口挂载

**Files:**
- Modify: `index.html:1-20`
- Modify: `js/app.js:1-5`

- [ ] **Step 1: 在 `index.html` 中新增历史记录弹窗 DOM**

在 `</body>` 之前，settings-modal 之后添加：

```html
<div class="history-modal hidden" id="history-modal">
  <div class="history-card">
    <div class="history-header">
      <h2>📊 历史记录</h2>
      <button class="history-close" id="history-close">✕</button>
    </div>
    <div class="history-filters">
      <button class="history-filter active" data-filter="all" data-type="all">全部</button>
      <button class="history-filter" data-filter="mode" data-type="mode" data-value="standard">🎮 标准</button>
      <button class="history-filter" data-filter="mode" data-type="mode" data-value="torch">🔦 火炬</button>
      <button class="history-filter" data-filter="mode" data-type="mode" data-value="treasure">💎 寻宝</button>
      <button class="history-filter" data-filter="mode" data-type="mode" data-value="torchpro">🦇 黑灯</button>
      <button class="history-filter" data-filter="diff" data-type="diff" data-value="beginner">极简</button>
      <button class="history-filter" data-filter="diff" data-type="diff" data-value="normal">普通</button>
      <button class="history-filter" data-filter="diff" data-type="diff" data-value="hard">困难</button>
      <button class="history-filter" data-filter="diff" data-type="diff" data-value="hell">地狱</button>
    </div>
    <div class="history-stats" id="history-stats" style="display:flex;gap:16px;padding:8px 20px;font-size:11px;color:var(--text-tertiary);border-bottom:1px solid var(--border-default)"></div>
    <div class="history-charts" id="history-charts">
      <div class="history-chart">
        <h3>📈 得分趋势</h3>
        <canvas id="chart-score" width="1200" height="200"></canvas>
      </div>
      <div class="history-chart">
        <h3>⏱ 用时趋势</h3>
        <canvas id="chart-time" width="1200" height="200"></canvas>
      </div>
      <div class="history-chart">
        <h3>🎯 效率趋势</h3>
        <canvas id="chart-eff" width="1200" height="200"></canvas>
      </div>
    </div>
    <div class="history-list" id="history-list"></div>
  </div>
</div>
```

- [ ] **Step 2: 在 `app.js` 中绑定历史记录入口**

在 `_bind()` 方法中新增：

```js
// History button
document.getElementById('hf-toggle').addEventListener('click', () => {
  HistoryUI.open()
})
document.getElementById('history-close').addEventListener('click', () => {
  HistoryUI.close()
})
// History filter buttons
document.querySelectorAll('.history-filter').forEach(b => {
  b.addEventListener('click', () => {
    HistoryUI.setFilter(b.dataset.type, b.dataset.value)
  })
})
```

- [ ] **Step 3: 在 `app.js` 顶部导入 `HistoryUI`**

```js
import { HistoryUI } from './history-ui.js'
```

- [ ] **Step 4: 修改 `_toMenu()` 确保历史弹窗关闭**

```js
_toMenu() {
    this.timer.reset(); this._stopMove(); this.particles.stop()
    this.replay = false
    HistoryUI.close() // <-- add this
    ...
}
```

- [ ] **Step 5: Commit**

```bash
git add index.html js/app.js
git commit -m "feat: add history modal DOM and entry bindings"
```

---

### Task 8: 总装联调

**Files:**
- Modify: `js/app.js` (final wiring)

- [ ] **Step 1: 确保所有 import 完整**

检查 `app.js` 头部 import 是否包含：

```js
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
```

- [ ] **Step 2: 手动测试 — 启动服务器**

```bash
node _server.mjs
```

- [ ] **Step 3: 浏览器打开 `http://localhost:8080` 验证**

- [ ] 主标题区：金色 42px 标题，发光效果，无遮罩
- [ ] 难度按钮：4 个等宽，76px 高，选中金色渐变
- [ ] 模式按钮：4 个等距，36px 高，选中金色
- [ ] 种子行：左对齐，输入框深灰底
- [ ] 开始游戏按钮：大按钮，金色渐变
- [ ] 闯关模式：次级按钮，深棕底
- [ ] 底部：历史记录链接

- [ ] **Step 4: 功能测试 — 闯关模式**

- [ ] 点击"闯关模式" → 配置面板
- [ ] 设置各难度关数 → 开始闯关
- [ ] 通关一关 → 下一关按钮
- [ ] 通关所有关 → 报告弹窗（星级 + 逐关表格）
- [ ] 中途退出 → 重新进入闯关 → 从存档恢复

- [ ] **Step 5: 功能测试 — 历史记录**

- [ ] 完成一局普通游戏
- [ ] 点击底部"查看排行榜" → 打开历史记录弹窗
- [ ] 查看三个图表
- [ ] 筛选模式/难度
- [ ] 关闭弹窗

- [ ] **Step 6: 最终提交**

```bash
git add -A
git commit -m "feat: campaign report, history tracking, and UI overhaul"
```