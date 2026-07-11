# 崩塌模式 + 幽灵竞速 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现崩塌模式（迷宫从起点沿路径崩塌）和幽灵竞速（与历史路径幽灵赛跑）

**Architecture:** 两个独立模式，共用 config 常量和 UI 入口，但引擎逻辑和渲染各自独立

**Tech Stack:** ES Modules / Canvas 2D / localStorage

---

### Task 1: config.js — 新增两个模式常量

**Files:**
- Modify: `D:\Claudeworkspace\maze-game\js\config.js`

- [ ] **Step 1: 更新 MODE_KEYS 添加 collapse/ghost**

```js
export const MODE_KEYS = ['standard', 'torch', 'treasure', 'torchpro', 'collapse', 'ghost']
```

- [ ] **Step 2: 更新 MODE_LABELS**

```js
export const MODE_LABELS = {
  standard: '标准模式',
  torch:    '火炬模式',
  treasure: '寻宝模式',
  torchpro: '黑灯模式',
  collapse: '💥崩塌',
  ghost:    '👻幽灵'
}
```

- [ ] **Step 3: 更新 MODE_DESC**

```js
export const MODE_DESC = {
  standard: '完整功能',
  torch:    '强制迷雾·无轨迹·纯探索',
  treasure: '收集宝石·解锁出口',
  torchpro: '仅视野内可见·无记忆·极致',
  collapse: '迷宫逐步崩塌·无路可退',
  ghost:    '和历史影子赛跑·超越自我'
}
```

- [ ] **Step 4: 更新 MODE_SCORE_MULT**

```js
export const MODE_SCORE_MULT = {
  standard: 1.0,
  torch:    1.5,
  treasure: 2.0,
  torchpro: 2.5,
  collapse: 1.3,
  ghost:    1.0
}
```

- [ ] **Step 5: 新增崩塌步数间隔常量**

```js
export const COLLAPSE_INTERVAL = {
  beginner: 15,
  normal:   12,
  hard:     10,
  hell:     8,
  super:    6,
  supermax: 5
}
```

- [ ] **Step 6: Commit**

```bash
git add js/config.js && git commit -m "feat: add collapse/ghost mode constants"
```

---

### Task 2: engine.js — 崩塌逻辑 + 幽灵数据加载

**Files:**
- Modify: `D:\Claudeworkspace\maze-game\js\engine.js`

- [ ] **Step 1: 构造函数添加新属性**

```js
// 在 constructor() 末尾添加
this.collapseMode = false
this.collapsePath = []
this.collapseHead = 0
this.collapseStepInterval = 10
this.collapseStepCounter = 0
this.collapseZone = new Set()
this.collapseFlash = 0
this.ghostData = null
this.ghostPos = null
this.ghostStepDiff = 0
this.ghostIsPerfect = false
```

- [ ] **Step 2: newGame 中初始化模式**

在 `newGame()` 方法中，在 `this.state = STATE.PLAYING` 之前添加：

```js
// Collapse mode init
if (mode === 'collapse') {
  this.collapseMode = true
  this.collapsePath = [{ r: this.sc.r, c: this.sc.c }]
  this.collapseHead = 0
  this.collapseStepInterval = COLLAPSE_INTERVAL[diff] || 10
  this.collapseStepCounter = 0
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
```

- [ ] **Step 3: move() 中插入崩塌检测**

在 `move()` 方法中，在墙壁碰撞检测之后、移动之前添加：

```js
// Collapse: check if target cell is collapsed
if (this.collapseMode && this.collapseZone.has(cellKey(nr, nc))) {
  return { moved: false, wall: true }
}
```

- [ ] **Step 4: move() 中移动后插入崩塌推进**

在 `this.steps++` 之后、`this.ph.push` 之前添加：

```js
// Collapse: track path and advance collapse
if (this.collapseMode) {
  this.collapsePath.push({ r: nr, c: nc })
  this.collapseStepCounter++
  if (this.collapseStepCounter >= this.collapseStepInterval) {
    this.collapseStepCounter = 0
    this.collapseHead++
    const cell = this.collapsePath[this.collapseHead - 1]
    if (cell) {
      this.collapseZone.add(cellKey(cell.r, cell.c))
      this.collapseFlash = performance.now()
      if (this.collapseZone.has(cellKey(this.pc.r, this.pc.c))) {
        // Player is standing on collapsed cell — fail
        this.fail('collapse')
      }
    }
  }
}
```

- [ ] **Step 5: reset() 中重置崩塌状态**

```js
// 在 reset() 方法中，this.state = STATE.PLAYING 之前添加
if (this.collapseMode) {
  this.collapsePath = [{ r: this.sc.r, c: this.sc.c }]
  this.collapseHead = 0
  this.collapseStepCounter = 0
  this.collapseZone = new Set()
  this.collapseFlash = 0
}
```

- [ ] **Step 6: backtrack() 中崩塌模式禁用**

```js
backtrack() {
  if (this.diff === 'supermax' || this.collapseMode) return
  // ...
}
```

- [ ] **Step 7: 导入 COLLAPSE_INTERVAL**

```js
import { DIFF, DIRS, FOG_R, TORCH_SIZES, COLLAPSE_INTERVAL } from './config.js'
```

- [ ] **Step 8: Commit**

```bash
git add js/engine.js && git commit -m "feat: add collapse mode state machine and ghost data model"
```

---

### Task 3: renderer.js — 崩塌渲染 + 幽灵渲染

**Files:**
- Modify: `D:\Claudeworkspace\maze-game\js\renderer.js`

- [ ] **Step 1: 在 render() 墙壁绘制之后、Gems 之前添加崩塌渲染**

```js
/* Collapse zone */
if (opts.collapseZone && opts.collapseZone.size > 0) {
  for (const ck of opts.collapseZone) {
    const [cr, cc] = ck.split(',').map(Number)
    const cx = ox + (cc * 2 + 1) * cs
    const cy = oy + (cr * 2 + 1) * cs
    // Dark red collapsed block
    ctx.fillStyle = 'rgba(180, 40, 40, 0.7)'
    ctx.fillRect(cx - cs * 0.8, cy - cs * 0.8, cs * 2.6, cs * 2.6)
    // Crack lines
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
if (opts.collapseFlash && performance.now() - opts.collapseFlash < 400) {
  const elapsed = performance.now() - opts.collapseFlash
  const alpha = 0.3 + 0.4 * Math.sin(elapsed / 25)
  ctx.save()
  ctx.strokeStyle = `rgba(255, 50, 50, ${alpha})`
  ctx.lineWidth = 3
  ctx.strokeRect(2, 2, bgW - 4, bgH - 4)
  ctx.restore()
}
```

- [ ] **Step 2: 在玩家绘制之前添加幽灵渲染**

```js
/* Ghost */
if (opts.ghostPos && opts.ghostData) {
  const gp = opts.ghostPos
  const gx = ox + (gp.c * 2 + 1.5) * cs
  const gy = oy + (gp.r * 2 + 1.5) * cs
  const ghostColor = opts.ghostIsPerfect ? '#888' : C.gold

  // Ghost trail
  ctx.save()
  ctx.globalAlpha = 0.15
  ctx.strokeStyle = ghostColor
  ctx.lineWidth = Math.max(1, cs * 0.08)
  ctx.setLineDash([cs * 0.3, cs * 0.3])
  ctx.beginPath()
  for (let i = 0; i < opts.ghostData.path.length; i++) {
    const p = opts.ghostData.path[i]
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
  // Outer glow
  ctx.globalAlpha = 0.12
  ctx.beginPath()
  ctx.arc(gx, gy, cs * 0.55, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
```

- [ ] **Step 3: 在 render() 调用处传递新 opts**

```js
// 在 app.js 的 _loop() 中，构造 render opts 时添加：
collapseZone: this.engine.collapseMode ? this.engine.collapseZone : null,
collapseFlash: this.engine.collapseFlash,
ghostPos: this.engine.ghostPos,
ghostData: this.engine.ghostData,
ghostIsPerfect: this.engine.ghostIsPerfect,
```

- [ ] **Step 4: Commit**

```bash
git add js/renderer.js && git commit -m "feat: add collapse zone rendering and ghost rendering"
```

---

### Task 4: app.js — 崩塌步数检测 + 幽灵记录 + 幽灵回放 + HUD

**Files:**
- Modify: `D:\Claudeworkspace\maze-game\js\app.js`

- [ ] **Step 1: 在 _loop() 中添加幽灵位置更新**

在 `_loop()` 方法中，在 `if (this.engine.state === STATE.PLAYING)` 块内添加：

```js
// Ghost position update
if (this.engine.mode === 'ghost' && this.engine.ghostData) {
  const elapsed = this.timer.getMs()
  const ghostPath = this.engine.ghostData.path
  let ghostIdx = ghostPath.length - 1
  for (let i = ghostPath.length - 1; i >= 0; i--) {
    if (ghostPath[i].t <= elapsed) { ghostIdx = i; break }
  }
  this.engine.ghostPos = ghostPath[ghostIdx] || null
  this.engine.ghostStepDiff = this.engine.steps - ghostIdx
}
```

- [ ] **Step 2: 在 _tryMove() 通关时记录幽灵路径**

在 `_tryMove()` 的 win 分支中，在 `this.sound.win()` 之前添加：

```js
// Save ghost path
if (this.engine.mode === 'ghost' && !this.engine.isDaily && score > 0) {
  const ghostPath = this.engine.ph.map((p, i) => ({
    r: p.r, c: p.c, t: i * this.moveCd
  }))
  Score.saveGhost(this.engine.seed, this.engine.diff, this.engine.mode, ghostPath, el, steps)
}
```

- [ ] **Step 3: 在 _start() 中加载幽灵**

在 `_start()` 方法中，在 `engine.newGame()` 之后添加：

```js
// Load ghost for ghost mode
if (mode === 'ghost' && !isDaily) {
  const ghost = Score.loadGhost(seed, this.engine.diff, mode)
  if (ghost) {
    this.engine.ghostData = ghost
    this.engine.ghostIsPerfect = false
  } else if (this.engine.solutionPath) {
    // No ghost record — show perfect ghost (optimal solution)
    const perfectPath = this.engine.solutionPath.map((p, i) => ({
      r: p.r, c: p.c, t: i * this.moveCd
    }))
    this.engine.ghostData = { path: perfectPath }
    this.engine.ghostIsPerfect = true
  }
}
```

- [ ] **Step 4: 在 _tryMove() 中添加幽灵击败加成**

在 win 分支中，计算分数后，幽灵模式额外加成：

```js
// Ghost mode bonus
if (this.engine.mode === 'ghost' && this.engine.ghostData && !this.engine.isDaily) {
  const ghostSteps = this.engine.ghostData.steps || Infinity
  const ghostTime = this.engine.ghostData.time || Infinity
  const beatGhost = steps < ghostSteps || el < ghostTime
  const beatPerfect = this.engine.ghostIsPerfect && beatGhost
  if (beatPerfect) {
    score = Math.round(score * 1.25)
  } else if (beatGhost) {
    score = Math.round(score * 1.1)
  }
}
```

- [ ] **Step 5: 更新 HUD 显示幽灵对比**

在 `_loop()` 的 HUD 更新部分添加：

```js
// Ghost HUD
if (this.engine.mode === 'ghost' && this.engine.ghostData) {
  const diff = this.engine.ghostStepDiff
  const ghostLabel = this.engine.ghostIsPerfect ? '完美' : ''
  let ghostText
  if (diff > 0) ghostText = `👻 领先 ${diff} 步`
  else if (diff < 0) ghostText = `👻 落后 ${Math.abs(diff)} 步`
  else ghostText = '👻 同步!'
  // 追加到 HUD 中显示
}
```

- [ ] **Step 6: 更新 _tryMove 的 fail 处理**

```js
// 在 showFail 调用处，检查 collapse 失败原因
if (res.failed === 'collapse') {
  UI.showFail('collapse', this.timer.getDisp(), this.engine.steps)
}
```

- [ ] **Step 7: 更新 UI.showFail 处理 collapse 失败**

```js
// 在 ui.js 的 showFail 方法中
showFail(reason, time, steps) {
  const msg = reason === 'time' ? '时间耗尽!' : reason === 'steps' ? '步数耗尽!' : reason === 'collapse' ? '被崩塌吞噬!' : '挑战失败!'
  document.getElementById('fail-reason').textContent = msg
  // ...
}
```

- [ ] **Step 8: 改造 render 调用传递 opts**

在 `_loop()` 中找到 `this.renderer.render(...)` 调用，在 opts 对象中添加：

```js
collapseZone: this.engine.collapseMode ? this.engine.collapseZone : null,
collapseFlash: this.engine.collapseFlash,
ghostPos: this.engine.ghostPos,
ghostData: this.engine.ghostData,
ghostIsPerfect: this.engine.ghostIsPerfect,
```

- [ ] **Step 9: Commit**

```bash
git add js/app.js js/ui.js && git commit -m "feat: add collapse detection, ghost recording/replay, HUD, score bonus"
```

---

### Task 5: score.js — 幽灵持久化

**Files:**
- Modify: `D:\Claudeworkspace\maze-game\js\score.js`

- [ ] **Step 1: 新增 saveGhost 和 loadGhost 方法**

```js
  /* ── Ghost ── */
  saveGhost(seed, diff, mode, path, time, steps) {
    if (seed == null || diff == null) return
    const key = `mz-ghost-${seed}-${diff}-${mode}`
    this._set(key, { seed, diff, mode, path, time, steps, date: new Date().toISOString().split('T')[0] })
  },

  loadGhost(seed, diff, mode) {
    if (seed == null || diff == null) return null
    const key = `mz-ghost-${seed}-${diff}-${mode}`
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
```

- [ ] **Step 2: 在 resetAll 中添加幽灵清除**

```js
resetAll() {
  // ... existing code ...
  // Clear all ghosts
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith('mz-ghost-')) localStorage.removeItem(k)
  }
},
```

- [ ] **Step 3: Commit**

```bash
git add js/score.js && git commit -m "feat: add ghost persistence (saveGhost/loadGhost/listGhosts)"
```

---

### Task 6: UI — 6 列模式按钮 + 规则提示

**Files:**
- Modify: `D:\Claudeworkspace\maze-game\js\ui.js`
- Modify: `D:\Claudeworkspace\maze-game\index.html`
- Modify: `D:\Claudeworkspace\maze-game\css\style.css`

- [ ] **Step 1: 模式行改为 6 列**

```css
.mode-row{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:.75rem}
```

- [ ] **Step 2: 响应式适配**

```css
@media(max-width:768px){
  .mode-row{grid-template-columns:repeat(3,1fr);gap:6px}
}
@media(max-width:480px){
  .mode-row{grid-template-columns:repeat(2,1fr);gap:4px}
  .mode-btn{font-size:11px;height:30px;padding:3px 6px}
}
```

- [ ] **Step 3: 在 index.html 中添加规则提示区域**

```html
<!-- 在 mode-row 下方添加 -->
<div class="mode-hint" id="mode-hint" style="font-size:12px;color:var(--text-tertiary);margin-bottom:.5rem;min-height:1.2em;font-family:var(--font-sans)"></div>
```

- [ ] **Step 4: 在 ui.js 中添加模式选择事件监听**

在 `_buildModeBtns()` 中，在点击事件里添加提示更新：

```js
// 在 mode-btn 的 click 事件中
const hints = {
  standard: '',
  torch: '🔦 火炬模式：强制迷雾，轨迹和提示禁用',
  treasure: '💎 寻宝模式：收集所有宝石后终点解锁',
  torchpro: '🦇 黑灯模式：仅当前火炬范围内可见，无地图记忆',
  collapse: '💥 崩塌模式：每走一步，起点方向崩塌一格。无法回头！',
  ghost: '👻 幽灵模式：和历史记录赛跑，超越自我'
}
const hintEl = document.getElementById('mode-hint')
if (hintEl) hintEl.textContent = hints[k] || ''
```

- [ ] **Step 5: 更新 _buildModeBtns 使用 MODE_KEYS，模式标签使用 MODE_LABELS**

```js
// 确保 _buildModeBtns 使用 MODE_KEYS 和 MODE_LABELS 而不是硬编码
for (const k of MODE_KEYS) {
  const b = document.createElement('button')
  b.className = 'mode-btn' + (k === 'standard' ? ' active' : '')
  b.dataset.mode = k
  b.innerHTML = `<span class="mode-label">${MODE_LABELS[k]}</span><span class="mode-desc">${MODE_DESC[k]}</span>`
  b.addEventListener('click', () => {
    r.querySelectorAll('.mode-btn').forEach(x => x.classList.remove('active'))
    b.classList.add('active')
    const hintEl = document.getElementById('mode-hint')
    if (hintEl) hintEl.textContent = MODE_HINTS[k] || ''
  })
  r.appendChild(b)
}
```

- [ ] **Step 6: 添加 MODE_HINTS 常量**

在 `ui.js` 中或 `config.js` 中添加：

```js
export const MODE_HINTS = {
  standard: '',
  torch: '🔦 火炬模式：强制迷雾，轨迹和提示禁用',
  treasure: '💎 寻宝模式：收集所有宝石后终点解锁',
  torchpro: '🦇 黑灯模式：仅当前火炬范围内可见，无地图记忆',
  collapse: '💥 崩塌模式：每走 {N} 步，起点方向崩塌 1 格。无法回头！',
  ghost: '👻 幽灵模式：和历史记录赛跑，超越自我'
}
```

- [ ] **Step 7: Commit**

```bash
git add js/ui.js js/config.js index.html css/style.css && git commit -m "feat: 6-column mode layout, mode hints, collapse/ghost UI"
```

---

### Task 7: 联调测试

- [ ] **Step 1: 启动服务器并验证**

```bash
cd D:/Claudeworkspace/maze-game && node _server.mjs
```

- [ ] **Step 2: 验证崩塌模式**
  - 选择崩塌模式 → 开始游戏 → 前进几步 → 观察起点是否崩塌（暗红方块）
  - 尝试走回崩塌区 → 应该撞墙
  - 验证屏幕闪烁
  - 验证失败弹窗「被崩塌吞噬」
  - 验证回溯键被禁用

- [ ] **Step 3: 验证幽灵模式**
  - 首次选择幽灵模式 → 应该显示完美幽灵（灰色）
  - 完成一局游戏 → 幽灵路径被保存
  - 再次挑战同一迷宫 → 显示金色幽灵
  - 验证 HUD 显示领先/落后步数
  - 验证击败幽灵后的分数加成

- [ ] **Step 4: 最终提交**

```bash
git add -A && git commit -m "feat: complete collapse mode + ghost racing"
```