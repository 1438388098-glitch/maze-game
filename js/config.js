/* ── Game Constants ── */

export const DIFF = {
  beginner: { label: '极简入门', cells: 15 },
  normal:   { label: '休闲普通', cells: 25 },
  hard:     { label: '进阶困难', cells: 35 },
  hell:     { label: '硬核地狱', cells: 45 },
  super:    { label: '无尽深渊', cells: 80 },
  supermax: { label: '无尽深渊MAX', cells: 100 }
}
export const DIFF_ORDER = ['beginner', 'normal', 'hard', 'hell', 'super', 'supermax']

export const MODE_KEYS = ['standard', 'torch', 'treasure', 'torchpro', 'collapse', 'ghost']
export const MODE_LABELS = {
  standard: '标准模式',
  torch:    '火炬模式',
  treasure: '寻宝模式',
  torchpro: '黑灯模式',
  collapse: '💥崩塌',
  ghost:    '👻幽灵'
}
export const MODE_DESC = {
  standard: '完整功能',
  torch:    '强制迷雾·无轨迹·纯探索',
  treasure: '收集宝石·解锁出口',
  torchpro: '仅视野内可见·无记忆·极致',
  collapse: '迷宫逐步崩塌·无路可退',
  ghost:    '和历史影子赛跑·超越自我'
}
export const MODE_SCORE_MULT = {
  standard: 1.0,
  torch:    1.5,
  treasure: 2.0,
  torchpro: 2.5,
  collapse: 1.3,
  ghost:    1.0
}

export const COLLAPSE_TIME = {
  beginner: 15,
  normal:   12,
  hard:     10,
  hell:     8,
  super:    6,
  supermax: 5
}

export const MODE_HINTS = {
  standard: '',
  torch: '🔦 火炬模式：强制迷雾，轨迹和提示禁用',
  treasure: '💎 寻宝模式：收集所有宝石后终点解锁',
  torchpro: '🦇 黑灯模式：仅当前火炬范围内可见，无地图记忆',
  collapse: '💥 崩塌模式：迷宫从起点按时间崩塌，无法回头！',
  ghost: '👻 幽灵模式：和历史记录赛跑，超越自我'
}

export const DIFF_SCORE_MULT = {
  beginner: 1.0,
  normal:   1.0,
  hard:     1.0,
  hell:     1.0,
  super:    3.0,
  supermax: 5.0
}

export const DIRS = [
  { dr: -1, dc: 0 }, { dr: 1, dc: 0 },
  { dr: 0, dc: -1 }, { dr: 0, dc: 1 }
]

export const KEY_MAP = {
  ArrowUp:    { dr: -1, dc: 0 },
  ArrowDown:  { dr: 1, dc: 0 },
  ArrowLeft:  { dr: 0, dc: -1 },
  ArrowRight: { dr: 0, dc: 1 },
  KeyW: { dr: -1, dc: 0 }, KeyS: { dr: 1, dc: 0 },
  KeyA: { dr: 0, dc: -1 }, KeyD: { dr: 0, dc: 1 }
}

export const MOVE_CD = 130
export const MOVE_CDS = { slow: 200, medium: 130, fast: 70 }
export const FOG_R = 4
export const TORCH_SIZES = [2, 4, 6]

export const FONT_SIZE_LABELS = { small: '小', medium: '中', large: '大' }
export const FONT_SIZE_VALUES = { small: 14, medium: 16, large: 18 }

export const METRICS_RANGES = {
  beginner: { tortuosity: [1.0, 2.2], deadEndLen: [1, 4], loops: [5, 999], deadEndPct: [20, 45], solutionPct: [4, 35], entropy: [0.5, 1.2], fractal: [1.5, 2.0] },
  normal:   { tortuosity: [1.5, 3.5], deadEndLen: [2, 7], loops: [2, 999], deadEndPct: [20, 50], solutionPct: [2, 15], entropy: [0.6, 1.4], fractal: [1.5, 2.0] },
  hard:     { tortuosity: [1.8, 4.5], deadEndLen: [3, 12], loops: [0, 15], deadEndPct: [25, 55], solutionPct: [1, 10], entropy: [0.7, 1.6], fractal: [1.5, 2.0] },
  hell:     { tortuosity: [2.0, 6.0], deadEndLen: [4, 18], loops: [0, 10], deadEndPct: [28, 60], solutionPct: [1, 6],  entropy: [0.8, 1.8], fractal: [1.5, 2.0] },
  super:    { tortuosity: [2.5, 8.0], deadEndLen: [6, 25], loops: [0, 5], deadEndPct: [30, 65], solutionPct: [0.3, 2.0], entropy: [0.9, 2.0], fractal: [1.5, 2.0] },
  supermax: { tortuosity: [3.0, 10.0], deadEndLen: [8, 30], loops: [0, 3], deadEndPct: [35, 70], solutionPct: [0.2, 1.0], entropy: [1.0, 2.2], fractal: [1.5, 2.0] }
}

export const DEAD_END_PROFILE = {
  beginner: [80, 20, 0],
  normal:   [40, 50, 10],
  hard:     [20, 50, 30],
  hell:     [15, 45, 40],
  super:    [5, 35, 60],
  supermax: [2, 28, 70]
}

export const POWER_LAW_GAMMA = { beginner: 3.0, normal: 2.2, hard: 1.5, hell: 1.2, super: 0.8, supermax: 0.6 }

export const GEN_ENGINES = ['standard', 'experimental']
export const GEN_ENGINE_LABELS = { standard: '标准 v1', experimental: '实验 v2' }

export const ROOM_COUNT = { beginner: 0, normal: 3, hard: 6, hell: 3, super: 0, supermax: 0 }
export const GEM_COUNT = { beginner: 3, normal: 4, hard: 5, hell: 8, super: 12, supermax: 16 }

export const SKIN_PALETTES = {
  default: {
    name: '护眼黑·亮',
    dark:  { wall: '#d4d4d4', bg: '#1a1a1a', accent: '#C68E5A', start: '#66bb6a', end: '#ef5350', gem: '#ffeb3b' },
    light: { wall: '#1a1a1a', bg: '#ffffff', accent: '#8B4513', start: '#4caf50', end: '#e53935', gem: '#ff9800' }
  },
  forest: {
    name: '复古绿',
    dark:  { wall: '#a5d6a7', bg: '#1b2e1b', accent: '#66bb6a', start: '#81c784', end: '#ef5350', gem: '#ffeb3b' },
    light: { wall: '#2e3b2e', bg: '#e8f5e9', accent: '#2e7d32', start: '#4caf50', end: '#e53935', gem: '#ff9800' }
  },
  ocean: {
    name: '柔和蓝',
    dark:  { wall: '#90caf9', bg: '#0d2137', accent: '#64b5f6', start: '#4fc3f7', end: '#ef5350', gem: '#ffeb3b' },
    light: { wall: '#263238', bg: '#e3f2fd', accent: '#1565c0', start: '#4caf50', end: '#e53935', gem: '#ff9800' }
  },
  sunset: {
    name: '暖橙',
    dark:  { wall: '#ffcc80', bg: '#2d1b0e', accent: '#ff9800', start: '#aed581', end: '#ef5350', gem: '#ffeb3b' },
    light: { wall: '#3e2723', bg: '#fff3e0', accent: '#e65100', start: '#4caf50', end: '#e53935', gem: '#ff9800' }
  }
}
export const SKIN_KEYS = ['default', 'forest', 'ocean', 'sunset']

export const HISTORY_MAX = 200
export const HISTORY_STORAGE_KEY = 'mz-history'
