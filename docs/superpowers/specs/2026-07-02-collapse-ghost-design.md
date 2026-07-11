# 新玩法设计详细文档：崩塌模式 + 幽灵竞速

日期：2026-07-02 | 状态：设计

---

## 一、崩塌模式 (Collapse Mode)

### 1.1 核心机制

迷宫从起点开始**沿玩家路径逐步崩塌**。玩家走过的路会从起点开始一段段碎掉，变成不可通行的废墟。不能回头，只能向前。

### 1.2 崩塌数据模型

```js
// engine.js 新增属性
this.collapseMode = false              // 是否开启崩塌模式
this.collapsePath = []                 // 玩家路径坐标数组 [{r, c}, ...]
this.collapseHead = 0                  // 已崩塌的路径索引（从0开始，表示前N个格子已塌）
this.collapseStepInterval = 10         // 步数间隔
this.collapseStepCounter = 0           // 距上次崩塌的步数
this.collapseZone = new Set()          // 已崩塌的格子集合（快速查表）
this.collapseFlash = 0                 // 闪烁动画计时器（ms）
```

### 1.3 崩塌逻辑（逐帧）

**初始化 `newGame()`：**
```js
if (mode === 'collapse') {
    this.collapseMode = true
    this.collapsePath = [{ r: this.sc.r, c: this.sc.c }]
    this.collapseHead = 0
    this.collapseStepInterval = getCollapseInterval(diff)  // 见1.4
    this.collapseStepCounter = 0
    this.collapseZone = new Set()
    this.bcOn = false  // 禁用轨迹
}
```

**每次移动 `move()`：**
```js
// 1. 检查目标格是否已崩塌
if (this.collapseMode && this.collapseZone.has(cellKey(nr, nc))) {
    return { moved: false, wall: true }  // 撞墙
}

// 2. 移动到新格
this.pc = { r: nr, c: nc }
this.steps++
this.collapsePath.push({ r: nr, c: nc })
this.collapseStepCounter++

// 3. 判断是否触发崩塌
if (this.collapseMode && this.collapseStepCounter >= this.collapseStepInterval) {
    this.collapseStepCounter = 0
    this._advanceCollapse()
}
```

**`_advanceCollapse()`：**
```js
_advanceCollapse() {
    // 崩塌往前推进一格（从路径起点开始吃）
    this.collapseHead++
    const cell = this.collapsePath[this.collapseHead - 1]
    if (!cell) return
    this.collapseZone.add(cellKey(cell.r, cell.c))
    this.collapseFlash = performance.now()  // 触发闪烁动画

    // 检查玩家当前位置是否在崩塌区内
    if (this.collapseZone.has(cellKey(this.pc.r, this.pc.c))) {
        this.fail('collapse')
    }
}
```

### 1.4 步数间隔（按难度）

| 难度 | 间隔（步） | 说明 |
|------|-----------|------|
| 极简入门 | 15 | 每 15 步崩塌 1 格，很宽松 |
| 休闲普通 | 12 | 略有压力 |
| 进阶困难 | 10 | 需要留意 |
| 硬核地狱 | 8 | 紧迫 |
| 无尽深渊 | 6 | 高度紧张 |
| 无尽深渊MAX | 5 | 极限压迫，几乎无法走回头路 |

### 1.5 边界条件

**玩家走到死路尽头：** 如果玩家进入一条死路，然后走回来，回来时崩塌可能已经吞掉了死路出口。玩家会被困在死路里，但不会立即死亡——下一次崩塌会吃掉他脚下的格子导致失败。这给玩家数步的缓冲时间。

**崩塌与回溯键：** 回溯（B键）在崩塌模式下完全禁用。如果用户按B，无反应。

**崩塌与迷雾：** 崩塌模式下迷雾可选。如果开启迷雾，崩塌区域在迷雾中显示为暗红色（即使未被探索过）。

**重置：** `reset()` 方法中 `collapsePath` 重置为 `[{ r: sc.r, c: sc.c }]`，`collapseHead` 重置为 0，`collapseZone` 清空。但 `collapseStepInterval` 保持不变。

**通关检测：** 通关时玩家到达终点，崩塌停止。报告仍显示正常通关数据。

### 1.6 视觉渲染

**renderer.js 新增渲染层：**

**第1层：崩塌区域（在迷宫墙壁之上）**
```js
// 在绘制完所有墙壁后
if (opts.collapseZone) {
    for (const ck of opts.collapseZone) {
        const [cr, cc] = ck.split(',').map(Number)
        const cx = ox + (cc * 2 + 1) * cs
        const cy = oy + (cr * 2 + 1) * cs
        // 暗红色崩塌块
        ctx.fillStyle = 'rgba(180, 40, 40, 0.7)'
        ctx.fillRect(cx - cs, cy - cs, cs * 3, cs * 3)
        // 裂缝纹理
        ctx.strokeStyle = 'rgba(200, 60, 60, 0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(cx - cs, cy - cs)
        ctx.lineTo(cx + cs * 0.5, cy + cs * 0.3)
        ctx.lineTo(cx + cs, cy - cs * 0.5)
        ctx.stroke()
    }
}
```

**第2层：崩塌边缘闪烁**
```js
if (opts.collapseFlash && performance.now() - opts.collapseFlash < 500) {
    const alpha = 0.3 + 0.4 * Math.sin((performance.now() - opts.collapseFlash) / 30)
    // 在崩塌边缘绘制闪烁边框
    ctx.strokeStyle = `rgba(255, 50, 50, ${alpha})`
    ctx.lineWidth = 2
    // 绘制崩塌边缘的轮廓
}
```

**第3层：HUD 崩塌倒计时条**
```js
// 在game-hud中添加
// 格式：████████░░  崩塌倒计时：剩余 6 步
// 颜色：绿色（>50%）→ 黄色（>25%）→ 红色（<25%）
```

### 1.7 崩溃处理

| 场景 | 表现 |
|------|------|
| 踩到崩塌区 | 失败弹窗，原因：「被崩塌吞噬」 |
| 被堵在死路 | 下次崩塌来临时失败 |
| 玩家在崩塌区边缘 | 屏幕边缘红色闪烁警告 |
| 回溯键被按 | 无反应（静默忽略） |

---

## 二、幽灵竞速 (Ghost Racing)

### 2.1 核心机制

每次通关时，系统自动保存玩家的**完整路径 + 时间戳**。后续挑战同一迷宫时，会有一个半透明「幽灵」沿着历史路径移动，你和过去的自己赛跑。

### 2.2 幽灵数据模型

```js
// 单条幽灵记录
{
  seed: 123456,           // 迷宫种子
  diff: 'normal',         // 难度
  mode: 'standard',       // 模式
  path: [                 // 完整路径，每步坐标 + 相对时间戳(ms)
    { r: 0, c: 0, t: 0 },
    { r: 1, c: 0, t: 130 },
    { r: 1, c: 1, t: 260 },
    // ...
  ],
  time: 45,               // 总用时(秒)
  steps: 120,             // 总步数
  date: '2026-07-02'      // 通关日期
}
```

**存储键：** `mz-ghost-{seed}-{diff}-{mode}`
**每个种子+难度+模式只有一条幽灵记录**（最新最佳）

### 2.3 记录时机

**通关时：** 在 `_tryMove()` 的 win 分支中，记录幽灵路径：

```js
// 仅在幽灵模式下且非每日挑战
if (this.engine.mode === 'ghost' && !this.engine.isDaily) {
    // 生成带时间戳的路径
    const ghostPath = this.engine.ph.map((p, i) => ({
        r: p.r, c: p.c,
        t: i * this.moveCd  // 相对时间戳
    }))
    Score.saveGhost(this.engine.seed, this.engine.diff, this.engine.mode, ghostPath, el, steps)
}
```

### 2.4 加载时机

**开始游戏时：** 在 `engine.newGame()` 中加载幽灵：

```js
if (mode === 'ghost') {
    const ghost = Score.loadGhost(seed, diff, mode)
    this.ghostData = ghost || null  // 无历史记录则null
    this.ghostPath = ghost ? ghost.path : null
}
```

### 2.5 幽灵回放逻辑

**每帧渲染 `_loop()`：**
```js
if (this.engine.ghostData) {
    const elapsed = this.timer.getMs()  // 当前游戏已过毫秒数
    const ghostPath = this.engine.ghostData.path
    
    // 找到幽灵当前应处的位置
    let ghostIdx = 0
    for (let i = ghostPath.length - 1; i >= 0; i--) {
        if (ghostPath[i].t <= elapsed) { ghostIdx = i; break }
    }
    this.engine.ghostPos = ghostPath[ghostIdx] || null
    
    // 计算步数差
    this.engine.ghostStepDiff = ghostIdx > 0 ? this.engine.steps - ghostIdx : 0
}
```

**幽灵位置插值：** 如果幽灵在两帧之间，不插值，直接取最近的一帧。因为幽灵路径是离散的，帧率足够高（60fps）时看起来是连续的。

### 2.6 幽灵渲染

**renderer.js 新增幽灵层：**

```js
// 在玩家绘制之前
if (opts.ghostPos && opts.ghostData) {
    const gp = opts.ghostPos
    const gx = ox + (gp.c * 2 + 1.5) * cs
    const gy = oy + (gp.r * 2 + 1.5) * cs
    
    // 幽灵路径轨迹（半透明虚线）
    ctx.save()
    ctx.globalAlpha = 0.2
    ctx.strokeStyle = C.gold
    ctx.lineWidth = Math.max(1, cs * 0.1)
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
    
    // 幽灵本体（半透明金色光环）
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.fillStyle = C.gold
    ctx.beginPath()
    ctx.arc(gx, gy, cs * 0.38, 0, Math.PI * 2)
    ctx.fill()
    // 外圈光晕
    ctx.globalAlpha = 0.15
    ctx.beginPath()
    ctx.arc(gx, gy, cs * 0.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
}
```

### 2.7 HUD 显示

**幽灵模式额外 HUD：**
```
👻 领先 15 步     ← 绿色（玩家领先）
👻 落后 8 步      ← 红色（幽灵领先）
👻 同步！         ← 金色（步数相同）
```

**计算方式：** `diff = playerSteps - ghostStepsAtSameTime`

幽灵的步数 = 在相同时间点幽灵已经走了多少步。如果玩家在同一时间走了更多步，说明玩家更快。

### 2.8 完美幽灵

如果玩家没有历史记录，可以显示「完美幽灵」— 理论最优解路径（`this.solutionPath`）：

```js
// 完美幽灵 = 理论最优解
if (mode === 'ghost' && !this.ghostData) {
    // 用 solutionPath 生成完美幽灵，步速为 130ms/步
    const perfectPath = this.solutionPath.map((p, i) => ({
        r: p.r, c: p.c, t: i * 130
    }))
    this.ghostData = { path: perfectPath }
    this.ghostIsPerfect = true
}
```

完美幽灵显示为**灰色**（而非金色），HUD 显示为「👻 完美路线」。

### 2.9 边界条件

| 场景 | 表现 |
|------|------|
| 无历史记录 | 显示完美幽灵（灰色） |
| 玩家与幽灵路径不同 | 幽灵在远处按原路径移动，可能出屏幕 |
| 幽灵已完成通关 | 幽灵到达终点后消失，不再显示 |
| 迷雾模式 | 幽灵始终可见，不受迷雾影响 |
| 每日挑战 | 不记录幽灵，不显示幽灵（种子每天不同） |
| 同一种子多局游戏 | 只保留最后/最佳一条幽灵记录 |

---

## 三、模式入口 UI

### 3.1 模式按钮（6 列）

```html
[标准] [火炬] [寻宝] [黑灯] [💥崩塌] [👻幽灵]
```

### 3.2 规则提示

选择崩塌模式时，在模式行下方显示：
```
💥 崩塌模式：每走 {N} 步，起点方向崩塌 1 格。无法回头。
```

选择幽灵模式时：
```
👻 幽灵模式：和历史记录赛跑，共 {N} 条幽灵记录可用。
```

### 3.3 禁用功能

| 功能 | 崩塌模式 | 幽灵模式 |
|------|---------|---------|
| 回溯 (B) | ❌ 禁用 | ✅ 可用 |
| 轨迹 | ❌ 禁用 | ✅ 可用 |
| 幽灵 | ❌ 禁用 | ✅ 可用（但幽灵模式本身已显示） |
| 提示 (H) | ✅ 可用 | ✅ 可用 |

---

## 四、评分调整

### 4.1 崩塌模式基础倍率

| 难度 | 倍率 | 说明 |
|------|------|------|
| 标准 | 1.0× | 崩塌模式本身增加难度 |
| 火炬 | 1.5× | 叠加迷雾 |
| 寻宝 | 2.0× | 收集宝石 + 崩塌 |
| 黑灯 | 2.5× | 极致难度 |

崩塌模式在 `MODE_SCORE_MULT` 中不单独设倍率，而是通过 `modeMul` 的 `collapse` 条目控制：

```js
MODE_SCORE_MULT.collapse = 1.3
```

### 4.2 幽灵模式击败加成

- 击败自己的幽灵（时间或步数更优）：最终得分 × 1.1
- 击败完美幽灵（和理论最优解一样好）：最终得分 × 1.25
- 加成在 `calcScore()` 之后由 `app.js` 额外追加

---

## 五、文件变更清单

| 文件 | 改动 |
|------|------|
| `js/config.js` | MODE_KEYS 新增 `collapse`/`ghost`, MODE_LABELS/DESC/MODE_SCORE_MULT 更新 |
| `js/engine.js` | 崩塌状态机 + 幽灵数据加载 + 禁用回溯(崩塌) |
| `js/renderer.js` | 崩塌区域渲染 + 崩塌边缘闪烁 + 幽灵渲染 + 幽灵轨迹 |
| `js/app.js` | 崩塌步数检测 + 幽灵路径记录 + 幽灵回放更新 + 幽灵 HUD |
| `js/score.js` | 新增 `saveGhost`/`loadGhost` 方法 |
| `js/ui.js` | 模式按钮 6 列布局 + 规则提示 |
| `index.html` | 规则提示 DOM 区域 |
| `css/style.css` | 模式行 6 列 + 崩塌HUD样式 + 闪烁动画 |

## 六、实施顺序

1. `config.js` — 新增 collapse/ghost 模式常量
2. `engine.js` — 崩塌逻辑 + 幽灵数据加载 + 禁用回溯
3. `renderer.js` — 崩塌渲染 + 幽灵渲染
4. `app.js` — 崩塌步数检测 + 幽灵记录 + 幽灵回放 + HUD
5. `score.js` — 幽灵持久化
6. `ui.js` + `index.html` + `css` — 6 列模式按钮 + 规则提示
7. 联调测试