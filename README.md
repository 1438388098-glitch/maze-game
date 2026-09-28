# 迷宫 Maze

> **English**: A minimalist, keyboard-only 2D maze game with quantitatively evaluated maze generation and pathfinding — zero dependencies, zero build.
> Mazes come from a parameterized Growing Tree algorithm (α continuously blends DFS and Prim behaviors) refined by MCMC (Metropolis-Hastings with simulated annealing), and are scored on 7 quality metrics (tortuosity, dead-end rate, branching factor, entropy, fractal dimension, etc.).
> Four grid difficulties (15×15 up to 45×45), four game modes (Standard / Torch / Treasure / Blackout), and 14 achievements.
> **Run**: double-click `start.bat`, or `python -m http.server 8080` (Node one-liner also provided), then open http://localhost:8080.

纯键盘操控的极简 2D 平面迷宫游戏。**零依赖、零构建、丢服务器即跑。**

---

## 快速启动

```bash
# Windows: 双击 start.bat
# 或终端运行：
python -m http.server 8080
# 或 Node：
node -e "require('http').createServer((q,r)=>{var f=require('fs'),p=q.url=='/'?'/index.html':q.url;try{r.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[require('path').extname(p)]||'text/plain'});r.end(f.readFileSync(__dirname+p))}catch(e){r.writeHead(404);r.end('Not found')}}).listen(8080)"
```

浏览器打开 `http://localhost:8080`

---

## 迷宫生成引擎

### Growing Tree + MCMC 调优

用 **Growing Tree 参数化算法**替代传统 4 种算法，通过 α ∈ [0,1] 连续调节迷宫拓扑：

| α | 行为 | 拓扑特征 |
|---|------|----------|
| 1.0 | 纯 DFS | 长走廊、高迂回度、少分支 |
| 0.5 | 均衡混合 | 适中分岔 |
| 0.0 | 纯 Prim | 多分支、低迂回度 |

每档难度设定不同 α：
- 极简：0.50 — 均衡，适合入门
- 普通：0.50 — 均衡
- 困难：0.35 — 偏向 Prim，更多分岔
- 地狱：0.20 — 高度分岔，复杂拓扑

### MCMC 精细调优（Metropolis-Hastings）

在基础迷宫上运行 **马尔可夫链蒙特卡洛** 调优，替代传统 10 次随机重试：

1. 定义损失函数 L(maze) = Σ wᵢ · (metricᵢ - targetᵢ)
2. 局部提议：随机翻转一面墙（保持连通性）
3. Metropolis 接受准则：P(accept) = min(1, e^(-ΔL/T))
4. 模拟退火降温：T 从 0.5 → 0.01

**数学保证**：马尔可夫链的平稳分布 ∝ e^(-L/T)，在低损失区域集中概率质量。

### 后处理

- 死路延长 + 死路桩（从走廊上打 stub）
- 捷径（打穿墙减少死路率）
- 房间（3×3 开阔区）
- 假主干道（地狱难度特有）

---

## 质量指标

| 指标 | 含义 | 数学定义 |
|------|------|----------|
| 迂回度 Tortuosity | 解路径弯曲程度 | pathLength / ManhattanDistance |
| 死路率 DeadEnd% | 死路格子占比 | deadEnds / totalPassages × 100 |
| 死路深 DeadEndLen | 平均死路长度 | Σ depthᵢ / count |
| 分支因子 BranchFactor | 岔路口平均分支 | Σ choices / junctions (choices ≥ 3) |
| 决策熵 Entropy | 单位格子决策信息 | Σ junctions log₂(k) / totalCells |
| 分形维 FractalDim | 迷宫空间填充度 | box-counting on cell grid |
| 回路 Loops | 额外连通环 | edges - (passages - 1) |

---

## 游戏玩法

### 难度

| 档位 | 网格 | 特点 |
|------|------|------|
| 极简入门 | 15×15 | Growing Tree α=0.5，低迂回，多回路 |
| 休闲普通 | 25×25 | Growing Tree α=0.5，适中分支 |
| 进阶困难 | 35×35 | α=0.35，高分岔，死路更长 |
| 硬核地狱 | 45×45 | α=0.2 + 假主干道，高复杂度 |

### 模式

| 模式 | 说明 |
|------|------|
| 标准模式 | 完整功能，支持轨迹/迷雾/幽灵/提示/回溯 |
| 火炬模式 | 强制迷雾 + 环形视野，轨迹和提示禁用 |
| 寻宝模式 | 收集宝石后终点解锁 |
| 黑灯模式 | 仅当前火炬范围内可见，无地图记忆 |

### 自定义

- **移动速度**：设置面板可选慢/中/快（200ms/130ms/70ms）
- **火炬大小**：F 键循环切换 2/4/6 格半径
- **种子系统**：自定义种子 + 每日挑战 + 点击复制种子
- **速度归一化评分**：时间按速度档位归一化到基准 130ms，消除不公平

### 成就系统

14 个成就，通关时自动检测解锁（首胜/全难度通关/速通/效率/撞墙100次等）。

### 评分配方

```
Score = deadPct × tortuosity × deadEndLen × branch × efficiency
      × modeMul ÷ timeFactor × 10
```

- modeMul: 标准×1.0 / 火炬×1.5 / 寻宝×2.0 / 黑灯×2.5
- timeFactor = 1 + adjustedTime / 120，时间已按速度归一化

---

## 项目结构

```
maze-game/
├── index.html          ← HTML 入口
├── css/
│   └── style.css       ← 全部样式（响应式、暗色/亮色主题、4 套皮肤）
├── js/
│   ├── app.js          ← 主控制器：事件绑定、主循环、键盘输入、回放
│   ├── config.js       ← 常量配置（难度、模式、皮肤、速度、指标范围）
│   ├── engine.js       ← 游戏引擎（状态机 + 移动逻辑）
│   ├── maze-gen.js     ← 迷宫生成器（Growing Tree + MCMC + 后处理 + 指标）
│   ├── pathfinder.js   ← BFS 寻路
│   ├── particles.js    ← 通关粒子特效
│   ├── renderer.js     ← Canvas 渲染管线
│   ├── score.js        ← localStorage 持久化 + 排行榜 + 成就系统
│   ├── sound.js        ← Web Audio 音效
│   ├── timer.js        ← 计时器
│   ├── ui.js           ← DOM 操控
│   └── util.js         ← 工具函数（RNG、shuffle、加权随机）
├── start.bat           ← Windows 一键启动
└── README.md
```

采用 ES Modules 标准，所有浏览器自 2020 年起原生支持。

---

## 快捷键

| 按键 | 功能 |
|------|------|
| ↑↓←→ / WASD | 移动 |
| Esc | 暂停/继续/关闭弹窗 |
| H | 路径提示 |
| G | 幽灵路径 |
| B | 一键回溯 |
| F | 迷雾切换 / 火炬大小 |
| R | 重置当前迷宫 |
| N | 同难度新迷宫 |
| D | 切换暗/亮主题 |
| Enter | 开始游戏 |
| 种子号点击 | 复制种子到剪贴板 |

---

## 技术栈

- **零外部依赖** — 纯 ES Modules，无 npm、无构建工具
- **Canvas 2D** — 迷宫渲染 + 迷雾系统 + 粒子特效
- **Web Audio API** — 音效（移动/通关/失败/倒计时提示）
- **localStorage** — 成绩/排行榜/成就/偏好设置持久化
- **Splitmix32** — 确定性种子 RNG，保证同一种子生成相同迷宫
- **MCMC + 模拟退火** — 迷宫质量优化
- **Growing Tree** — 参数化生成树算法
- **Box-counting 分形维** — 空间复杂度验证
- **Shannon 决策熵** — 路径选择难度量化
