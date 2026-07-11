# 迷宫游戏 — 代码结构优化计划

## 当前问题

| 文件 | 问题 | 影响 |
|------|------|------|
| `app.js` | `_tryMove` 一个方法做 7 件事 | 加新玩法必须改这坨逻辑，容易出 bug |
| `renderer.js` | opts 参数 17 个平铺 | 每次加新渲染层要改 3 个地方 |
| `engine.js` | 崩塌/幽灵状态混在核心引擎里 | 引擎越来越大 |

## 优化方案

### 1. app.js — 拆分 _tryMove

```
_tryMove(dr, dc)
  ├── 移动 + 碰撞检测（保留）
  ├── if won → _onWin(el, steps)
  │   ├── _recordHistory()    ← 历史记录
  │   ├── _saveGhost()        ← 幽灵保存
  │   ├── _collectCampaign()  ← 闯关统计
  │   └── _handleCampaignWin / UI.showWin
  └── if failed → _onFail(reason)
```

### 2. renderer.js — opts 命名空间化

```js
render(grid, pc, ghostPath, hintPath, diff, {
  fog: { enabled, revealed, radius },
  ghost: { on, path, data, pos, isPerfect },
  collapse: { zone, flash },
  effects: { wallFlash, shake, lerpFrom, lerpStart, backtrack },
  markers: { start, end, endLocked, gems, collected }
})
```

### 3. engine.js — 提取崩塌/幽灵初始化方法

```js
_initCollapse(diff)
_initGhost()
```

## 实施顺序

1. renderer.js — opts 分组
2. app.js — _tryMove 拆分
3. engine.js — 提取方法
4. 联调验证