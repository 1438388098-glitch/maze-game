/* ── Maze Generator v2 ── 4 algorithms + biased MCMC + power-law dead ends + λ₂ ── */

import { DIRS, METRICS_RANGES, ROOM_COUNT, GEM_COUNT, POWER_LAW_GAMMA } from './config.js'
import { cellKey, shuffle, createRNG } from './util.js'
import { PathFinder } from './pathfinder.js'

export const MazeGenV2 = {

  generate(cells, difficulty, seed, mode) {
    const rng = seed != null ? createRNG(seed) : null
    const rd = rng || Math.random
    const { sr, sc, er, ec } = this._endpoints(cells, difficulty, rd)
    const scell = { r: sr, c: sc }, ecell = { r: er, c: ec }
    let bestGrid = null, bestPath = null, bestScore = Infinity, bestMetrics = null, bestGems = null

    // Phase 1: Fast scan (2 attempts, no MCMC)
    const candidates = []
    for (let a = 0; a < 2; a++) {
      const grid = this._genBase(cells, difficulty, rng)
      const sp = this._postProcess(grid, cells, difficulty, rng, scell, ecell)
      if (!sp) continue
      const de = this._findDeadEnds(grid, cells)
      const metrics = this._calcMetrics(grid, cells, sp, de, scell, ecell)
      const score = this._validateScore(metrics, difficulty)
      candidates.push({ grid, path: sp, metrics, score })
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.score - b.score)
      const best = candidates[0]
      bestGrid = best.grid; bestPath = best.path; bestScore = best.score; bestMetrics = best.metrics

      // Phase 2: Concentrated MCMC on best candidate
      const tunedPath = this._mcmcTune(bestGrid, cells, difficulty, bestPath, rng, scell, ecell)
      if (tunedPath) {
        const de = this._findDeadEnds(bestGrid, cells)
        const m2 = this._calcMetrics(bestGrid, cells, tunedPath, de, scell, ecell)
        const s2 = this._validateScore(m2, difficulty)
        if (s2 <= 0.3 && s2 <= bestScore) {
          let gems = null
          if (mode === 'treasure') gems = this._placeGems(bestGrid, cells, GEM_COUNT[difficulty] || 4, tunedPath, rng)
          m2.lambda2 = this._computeLambda2(bestGrid, cells)
          this._removeIsolatedWalls(bestGrid, cells)
          return { grid: bestGrid, solutionPath: tunedPath, start: scell, end: ecell, gems, metrics: m2 }
        }
        if (s2 < bestScore) { bestScore = s2; bestPath = tunedPath; bestMetrics = m2 }
      }
    }

    // Phase 3: Fallback full attempts (up to 2, with light MCMC)
    for (let a = 0; a < 2; a++) {
      const grid = this._genBase(cells, difficulty, rng)
      const sp = this._postProcess(grid, cells, difficulty, rng, scell, ecell)
      if (!sp) continue
      const fp = this._mcmcTune(grid, cells, difficulty, sp, rng, scell, ecell, 0.5)
      if (!fp) continue
      let gems = null
      if (mode === 'treasure') gems = this._placeGems(grid, cells, GEM_COUNT[difficulty] || 4, fp, rng)
      const de = this._findDeadEnds(grid, cells)
      const metrics = this._calcMetrics(grid, cells, fp, de, scell, ecell)
      const score = this._validateScore(metrics, difficulty)
      if (score <= 0.3) { metrics.lambda2 = this._computeLambda2(grid, cells); this._removeIsolatedWalls(grid, cells); return { grid, solutionPath: fp, start: scell, end: ecell, gems, metrics } }
      if (score < bestScore) { bestScore = score; bestGrid = grid; bestPath = fp; bestMetrics = metrics; bestGems = gems }
    }
    if (bestGrid) { this._removeIsolatedWalls(bestGrid, cells); if (bestMetrics) bestMetrics.lambda2 = this._computeLambda2(bestGrid, cells) }
    return { grid: bestGrid, solutionPath: bestPath, start: scell, end: ecell, gems: bestGems, metrics: bestMetrics }
  },

  _endpoints(cells, diff, rd) {
    if (diff === 'beginner') return { sr: 0, sc: 0, er: cells - 1, ec: cells - 1 }
    if (diff === 'normal') {
      const cs = shuffle([{ r: 0, c: 0 }, { r: 0, c: cells - 1 }, { r: cells - 1, c: 0 }, { r: cells - 1, c: cells - 1 }], rd)
      return { sr: cs[0].r, sc: cs[0].c, er: cs[1].r, ec: cs[1].c }
    }
    if (diff === 'hard') {
      const edge = (len) => {
        const p = Math.floor(rd() * len)
        return [{ r: 0, c: p }, { r: len - 1, c: p }, { r: p, c: 0 }, { r: p, c: len - 1 }][Math.floor(rd() * 4)]
      }
      const s = edge(cells)
      let e
      do e = edge(cells)
      while (Math.abs(s.r - e.r) + Math.abs(s.c - e.c) < cells * 0.6)
      return { sr: s.r, sc: s.c, er: e.r, ec: e.c }
    }
    // hell, super, supermax: random endpoints with increasing distance
    const minDist = diff === 'supermax' ? 0.7 : diff === 'super' ? 0.6 : 0.5
    const s = { r: Math.floor(rd() * cells), c: Math.floor(rd() * cells) }
    let e
    do e = { r: Math.floor(rd() * cells), c: Math.floor(rd() * cells) }
    while (Math.abs(s.r - e.r) + Math.abs(s.c - e.c) < cells * minDist)
    return { sr: s.r, sc: s.c, er: e.r, ec: e.c }
  },

  _genBase(cells, diff, rng) {
    const sz = cells * 2 + 1
    const g = Array.from({ length: sz }, () => new Array(sz).fill(1))
    const alphas = { beginner: 0.65, normal: 0.45, hard: 0.30, hell: 0.22, super: 0.12, supermax: 0.06 }
    this._growingTree(g, cells, alphas[diff] ?? 0.5, rng)
    return g
  },

  _dfsRelaxed(g, cells, rng) {
    const vis = new Set(), stack = [{ r: 0, c: 0 }]
    vis.add(cellKey(0, 0)); g[1][1] = 0
    const rd = rng || Math.random
    while (stack.length > 0) {
      const cur = stack[stack.length - 1]
      const nb = []
      for (const d of shuffle(DIRS, rng)) {
        const nr = cur.r + d.dr, nc = cur.c + d.dc
        if (nr >= 0 && nr < cells && nc >= 0 && nc < cells && !vis.has(cellKey(nr, nc)))
          nb.push({ r: nr, c: nc, dr: d.dr, dc: d.dc })
      }
      if (nb.length === 0) {
        if (rd() < 0.2) {
          const an = []
          for (const d of DIRS) {
            const nr = cur.r + d.dr, nc = cur.c + d.dc
            if (nr >= 0 && nr < cells && nc >= 0 && nc < cells && vis.has(cellKey(nr, nc)))
              an.push({ r: nr, c: nc, dr: d.dr, dc: d.dc })
          }
          if (an.length > 0) {
            const n = an[Math.floor(rd() * an.length)]
            g[cur.r * 2 + 1 + n.dr][cur.c * 2 + 1 + n.dc] = 0
          }
        }
        stack.pop()
      } else {
        const n = nb[Math.floor(rd() * nb.length)]
        g[cur.r * 2 + 1 + n.dr][cur.c * 2 + 1 + n.dc] = 0
        g[n.r * 2 + 1][n.c * 2 + 1] = 0
        vis.add(cellKey(n.r, n.c))
        stack.push({ r: n.r, c: n.c })
      }
    }
  },

  _huntKill(g, cells, rng) {
    const vis = new Set(), rd = rng || Math.random
    let cur = { r: Math.floor(rd() * cells), c: Math.floor(rd() * cells) }
    vis.add(cellKey(cur.r, cur.c)); g[cur.r * 2 + 1][cur.c * 2 + 1] = 0
    const sds = shuffle(['lr', 'rl', 'tb', 'bt'], rng)
    while (true) {
      let walking = true
      while (walking) {
        walking = false
        const uv = []
        for (const d of shuffle(DIRS, rng)) {
          const nr = cur.r + d.dr, nc = cur.c + d.dc
          if (nr >= 0 && nr < cells && nc >= 0 && nc < cells && !vis.has(cellKey(nr, nc)))
            uv.push({ r: nr, c: nc, dr: d.dr, dc: d.dc })
        }
        if (uv.length > 0) {
          const n = uv[Math.floor(rd() * uv.length)]
          g[cur.r * 2 + 1 + n.dr][cur.c * 2 + 1 + n.dc] = 0
          g[n.r * 2 + 1][n.c * 2 + 1] = 0
          vis.add(cellKey(n.r, n.c))
          cur = { r: n.r, c: n.c }
          walking = true
        }
      }
      const sc = sds[Math.floor(rd() * sds.length)]
      let rs = 0, re = cells, ri = 1, cs2 = 0, ce = cells, ci = 1
      if (sc === 'rl') { ci = -1; cs2 = cells - 1; ce = -1 }
      if (sc === 'bt') { ri = -1; rs = cells - 1; re = -1 }
      let found = false
      for (let r = rs; r !== re && !found; r += ri)
        for (let c = cs2; c !== ce && !found; c += ci) {
          if (vis.has(cellKey(r, c))) {
            const uv = []
            for (const d of DIRS) {
              const nr = r + d.dr, nc = c + d.dc
              if (nr >= 0 && nr < cells && nc >= 0 && nc < cells && !vis.has(cellKey(nr, nc)))
                uv.push({ r: nr, c: nc, dr: d.dr, dc: d.dc })
            }
            if (uv.length > 0) {
              const n = uv[Math.floor(rd() * uv.length)]
              g[r * 2 + 1 + n.dr][c * 2 + 1 + n.dc] = 0
              g[n.r * 2 + 1][n.c * 2 + 1] = 0
              vis.add(cellKey(n.r, n.c))
              cur = { r: n.r, c: n.c }
              found = true
            }
          }
        }
      if (!found) break
    }
  },

  _prim(g, cells, rng) {
    const rd = rng || Math.random, is = new Set()
    const s = { r: Math.floor(rd() * cells), c: Math.floor(rd() * cells) }
    is.add(cellKey(s.r, s.c)); g[s.r * 2 + 1][s.c * 2 + 1] = 0
    const fr = []
    for (const d of DIRS) {
      const nr = s.r + d.dr, nc = s.c + d.dc
      if (nr >= 0 && nr < cells && nc >= 0 && nc < cells)
        fr.push({ inR: s.r, inC: s.c, outR: nr, outC: nc, dr: d.dr, dc: d.dc })
    }
    while (fr.length > 0) {
      const i = Math.floor(rd() * fr.length)
      const w = fr[i]; fr[i] = fr[fr.length - 1]; fr.pop()
      if (is.has(cellKey(w.outR, w.outC))) continue
      g[w.inR * 2 + 1 + w.dr][w.inC * 2 + 1 + w.dc] = 0
      g[w.outR * 2 + 1][w.outC * 2 + 1] = 0
      is.add(cellKey(w.outR, w.outC))
      for (const d of DIRS) {
        const nr = w.outR + d.dr, nc = w.outC + d.dc
        if (nr >= 0 && nr < cells && nc >= 0 && nc < cells && !is.has(cellKey(nr, nc)))
          fr.push({ inR: w.outR, inC: w.outC, outR: nr, outC: nc, dr: d.dr, dc: d.dc })
      }
    }
  },

  _wilson(g, cells, rng) {
    const rd = rng || Math.random, is = new Set(), uv = new Set()
    for (let r = 0; r < cells; r++) for (let t = 0; t < cells; t++) uv.add(cellKey(r, t))
    const s = { r: Math.floor(rd() * cells), c: Math.floor(rd() * cells) }
    is.add(cellKey(s.r, s.c)); uv.delete(cellKey(s.r, s.c)); g[s.r * 2 + 1][s.c * 2 + 1] = 0
    const mw = cells * cells * 10
    const arr = []
    for (let r = 0; r < cells; r++) for (let t = 0; t < cells; t++) if (uv.has(cellKey(r, t))) arr.push({ r, c: t })
    while (arr.length > 0) {
      const si = Math.floor(rd() * arr.length)
      let cr = arr[si]
      const ph = [{ r: cr.r, c: cr.c }]
      let steps = 0
      while (uv.has(cellKey(cr.r, cr.c))) {
        steps++; if (steps > mw) break
        const ds = shuffle(DIRS, rng)
        let nx = null
        for (const d of ds) { const nr = cr.r + d.dr, nc = cr.c + d.dc; if (nr >= 0 && nr < cells && nc >= 0 && nc < cells) { nx = { r: nr, c: nc }; break } }
        if (!nx) break
        const ei = ph.findIndex(p => p.r === nx.r && p.c === nx.c)
        if (ei !== -1) ph.splice(ei + 1); else ph.push(nx)
        cr = nx
      }
      if (steps > mw) continue
      for (let i = 0; i < ph.length - 1; i++) {
        const a = ph[i], b = ph[i + 1], dr = b.r - a.r, dc = b.c - a.c
        g[a.r * 2 + 1 + dr][a.c * 2 + 1 + dc] = 0; g[a.r * 2 + 1][a.c * 2 + 1] = 0; g[b.r * 2 + 1][b.c * 2 + 1] = 0
        is.add(cellKey(a.r, a.c)); uv.delete(cellKey(a.r, a.c))
      }
      let w = 0
      for (let i = 0; i < arr.length; i++) { if (uv.has(cellKey(arr[i].r, arr[i].c))) arr[w++] = arr[i] }
      arr.length = w
    }
  },

  /* ── Growing Tree (parametrized: α→1 = DFS, α→0 = Prim) ── */
  _growingTree(g, cells, alpha, rng) {
    const rd = rng || Math.random
    const inSet = new Set()
    const frontier = []
    const start = { r: Math.floor(rd() * cells), c: Math.floor(rd() * cells) }
    inSet.add(cellKey(start.r, start.c))
    g[start.r * 2 + 1][start.c * 2 + 1] = 0
    frontier.push(start)
    while (frontier.length > 0) {
      const idx = rd() < alpha ? frontier.length - 1 : Math.floor(rd() * frontier.length)
      const cur = frontier[idx]
      const nb = []
      for (const d of shuffle(DIRS, rng)) {
        const nr = cur.r + d.dr, nc = cur.c + d.dc
        if (nr >= 0 && nr < cells && nc >= 0 && nc < cells && !inSet.has(cellKey(nr, nc)))
          nb.push({ r: nr, c: nc, dr: d.dr, dc: d.dc })
      }
      if (nb.length === 0) { frontier.splice(idx, 1); continue }
      const n = nb[Math.floor(rd() * nb.length)]
      g[cur.r * 2 + 1 + n.dr][cur.c * 2 + 1 + n.dc] = 0
      g[n.r * 2 + 1][n.c * 2 + 1] = 0
      inSet.add(cellKey(n.r, n.c))
      frontier.push({ r: n.r, c: n.c })
    }
  },

  /* ── MCMC v2: biased proposals + improved cooling ── */
  _mcmcTune(g, cells, diff, initialPath, rng, sc, ec, iterMult) {
    if (iterMult == null) iterMult = 1
    const rd = rng || Math.random
    let curGrid = g.map(row => [...row]), curPath = initialPath
    let curLoss = this._validateScore(this._calcMetrics(g, cells, initialPath, this._findDeadEnds(g, cells), sc, ec), diff)
    let bestGrid = curGrid, bestPath = curPath, bestLoss = curLoss
    let fp, newMetrics, newLoss, stuck = 0

    // Build candidate wall list: walls adjacent to a passage cell (fast Set dedup)
    const cwKeys = new Set()
    const cw = []
    const sz = cells * 2 + 1
    for (let r = 0; r < cells; r++) for (let c = 0; c < cells; c++) {
      if (curGrid[r * 2 + 1][c * 2 + 1] !== 0) continue
      for (const d of DIRS) {
        const nr = r + d.dr, nc = c + d.dc
        if (nr < 0 || nr >= cells || nc < 0 || nc >= cells) continue
        const wr = r * 2 + 1 + d.dr, wc = c * 2 + 1 + d.dc
        if (curGrid[wr][wc] === 1) {
          const key = wr * sz + wc
          if (!cwKeys.has(key)) { cwKeys.add(key); cw.push({ wr, wc }) }
        }
      }
    }

    const nCells = cells * cells
    const iterations = Math.max(8, Math.min(60, Math.floor(nCells * 0.03 * iterMult)))
    const tempStart = 0.3, iterA = Math.floor(iterations * 0.4), iterB = Math.floor(iterations * 0.8)

    const acceptMove = (wr, wc, newVal) => {
      const key = wr * sz + wc
      if (newVal === 0) {
        const idx = cw.findIndex(x => x.wr === wr && x.wc === wc)
        if (idx !== -1) { cw.splice(idx, 1); cwKeys.delete(key) }
      } else if (!cwKeys.has(key)) {
        cwKeys.add(key); cw.push({ wr, wc })
      }
    }

    for (let t = 0; t < iterations; t++) {
      // Phase cooling
      let temp
      if (t < iterA) temp = tempStart
      else if (t < iterB) temp = tempStart * (1 - (t - iterA) / (iterB - iterA) * 0.9)
      else temp = tempStart * 0.1

      // Biased proposal: pick from candidate list
      let wr, wc, oldVal
      if (cw.length > 0) {
        const idx = Math.floor(rd() * cw.length)
        wr = cw[idx].wr; wc = cw[idx].wc; oldVal = curGrid[wr][wc]
      } else {
        // Fallback to random proposal
        const fallback = this._proposeMove(curGrid, cells, rd)
        if (fallback.wr == null) continue
        wr = fallback.wr; wc = fallback.wc; oldVal = fallback.oldVal
      }

      curGrid[wr][wc] = 1 - oldVal
      acceptMove(wr, wc, 1 - oldVal)
      fp = PathFinder.findPath(curGrid, sc, ec, cells)
      if (!fp) {
        curGrid[wr][wc] = oldVal
        acceptMove(wr, wc, oldVal)
        continue
      }
      newMetrics = this._calcMetrics(curGrid, cells, fp, this._findDeadEnds(curGrid, cells), sc, ec)
      newLoss = this._validateScore(newMetrics, diff)
      const delta = newLoss - curLoss
      if (delta < 0 || rd() < Math.exp(-delta / Math.max(temp, 0.001))) {
        curPath = fp; curLoss = newLoss; stuck = 0
        if (newLoss < bestLoss) {
          bestGrid = curGrid.map(row => [...row]); bestPath = fp; bestLoss = newLoss
        }
      } else {
        curGrid[wr][wc] = oldVal
        acceptMove(wr, wc, oldVal)
        stuck++
      }
      if (stuck > 20 && bestLoss < 2) break
    }
    for (let i = 0; i < g.length; i++) for (let j = 0; j < g[i].length; j++) g[i][j] = bestGrid[i][j]
    return bestPath
  },

  _proposeMove(g, cells, rd) {
    const r = Math.floor(rd() * cells), c = Math.floor(rd() * cells)
    const d = DIRS[Math.floor(rd() * DIRS.length)]
    const nr = r + d.dr, nc = c + d.dc
    if (nr < 0 || nr >= cells || nc < 0 || nc >= cells) return {}
    const wr = r * 2 + 1 + d.dr, wc = c * 2 + 1 + d.dc
    return { wr, wc, oldVal: g[wr][wc] }
  },

  /* ── Post-processing ── */
  _postProcess(g, cells, diff, rng, sc, ec) {
    const rd = rng || Math.random
    let prePath = null
    if (diff === 'hell' || diff === 'super' || diff === 'supermax') prePath = PathFinder.findPath(g, sc, ec, cells)

    // Power-law dead end extension (v2)
    const dePcts = { beginner: 0.55, normal: 0.50, hard: 0.60, hell: 0.75, super: 0.85, supermax: 0.92 }
    this._extendDeadEndsV2(g, cells, dePcts[diff] || 0.4, 2, 6, rng, diff)

    switch (diff) {
      case 'beginner': this._addShortcuts(g, cells, 0.15, rng); break
      case 'normal':   this._addShortcuts(g, cells, 0.05, rng); break
      case 'hard':     break
      case 'hell':     if (prePath) { this._addFalseLeads(g, cells, prePath, 5 + Math.floor(rd() * 4), rng) } break
      case 'super':    if (prePath) { this._addFalseLeads(g, cells, prePath, 8 + Math.floor(rd() * 4), rng) } break
      case 'supermax': if (prePath) { this._addFalseLeads(g, cells, prePath, 12 + Math.floor(rd() * 4), rng) } break
    }
    this._addRooms(g, cells, ROOM_COUNT[diff] || 0, rng)
    if (diff === 'hell' || diff === 'super' || diff === 'supermax') this._extendDeadEndsV2(g, cells, 0.4, 3, 6, rng, diff)
    this._removeIsolatedWalls(g, cells)
    let fp = PathFinder.findPath(g, sc, ec, cells)
    if ((diff === 'hard' || diff === 'hell' || diff === 'super' || diff === 'supermax') && fp) {
      const stretchCount = diff === 'supermax' ? 15 : diff === 'super' ? 10 : 5
      fp = this._stretchPath(g, cells, fp, rng, sc, ec, stretchCount)
    }
    return fp
  },

  _removeIsolatedWalls(g, cells) {
    const sz = cells * 2 + 1
    const todo = []
    for (let r = 0; r < sz; r++) for (let c = 0; c < sz; c++) {
      if (g[r][c] !== 1 || (r & 1) || (c & 1)) continue
      let adj = 0
      for (const d of DIRS) {
        const nr = r + d.dr, nc = c + d.dc
        if (nr >= 0 && nr < sz && nc >= 0 && nc < sz && g[nr][nc] === 0) adj++
      }
      if (adj === 4) todo.push([r, c])
    }
    for (const [r, c] of todo) g[r][c] = 0
  },

  _extendDeadEndsV2(g, cells, pct, minL, maxL, rng, diff) {
    const rd = rng || Math.random
    const gamma = POWER_LAW_GAMMA[diff] || 2.0
    const des = this._findDeadEnds(g, cells)
    for (const de of shuffle(des, rng).slice(0, Math.floor(des.length * pct))) {
      const len = this._powerLawDepth(minL, maxL, gamma, rd)
      const di = this._getOnlyOpenDir(g, cells, de.r, de.c)
      if (!di) continue
      let cr = de.r, cc = de.c, dr = di.dr, dc = di.dc
      for (let i = 0; i < len; i++) {
        const nr = cr + dr, nc = cc + dc
        if (nr < 0 || nr >= cells || nc < 0 || nc >= cells) break
        const wr = cr * 2 + 1 + dr, wc = cc * 2 + 1 + dc
        if (g[wr][wc] === 0) break
        g[wr][wc] = 0; g[nr * 2 + 1][nc * 2 + 1] = 0
        cr = nr; cc = nc
        if (rd() < 0.35) {
          const ad = DIRS.filter(x => !(x.dr === -dr && x.dc === -dc))
          const d2 = ad[Math.floor(rd() * ad.length)]; dr = d2.dr; dc = d2.dc
        }
      }
    }
  },

  _powerLawDepth(min, max, gamma, rd) {
    const weights = []
    for (let k = min; k <= max; k++) weights.push(Math.pow(k, -gamma))
    const total = weights.reduce((a, b) => a + b, 0)
    let r = rd() * total
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i]
      if (r <= 0) return min + i
    }
    return max
  },

  _stretchPath(g, cells, path, rng, sc, ec, maxIter) {
    const rd = rng || Math.random
    const iters = maxIter || 5
    for (let t = 0; t < iters; t++) {
      const i = 1 + Math.floor(rd() * Math.max(1, path.length - 3))
      const a = path[i], b = path[i + 1], dr = b.r - a.r, dc = b.c - a.c
      if (!dr && !dc) continue
      const wr = a.r * 2 + 1 + dr, wc = a.c * 2 + 1 + dc
      const sv = g[wr][wc]; g[wr][wc] = 1
      const np = PathFinder.findPath(g, sc, ec, cells)
      if (np && np.length > path.length * 1.15) return np
      g[wr][wc] = sv
    }
    return path
  },

  _addRooms(g, cells, cnt, rng) {
    if (cnt <= 0) return
    const ca = []
    for (let r = 1; r < cells - 2; r++) for (let t = 1; t < cells - 2; t++) {
      if (g[r * 2 + 1][t * 2 + 1] === 0 && this._countOpenDirs(g, cells, r, t) >= 3) ca.push({ r, c: t })
    }
    for (const s of shuffle(ca, rng).slice(0, Math.min(cnt, ca.length)))
      for (let dr = 0; dr <= 2; dr++) for (let dc = 0; dc <= 2; dc++) g[(s.r - 1) * 2 + 1 + dr][(s.c - 1) * 2 + 1 + dc] = 0
  },

  _addShortcuts(g, cells, pct, rng) {
    const ca = []
    for (let r = 0; r < cells; r++) for (let t = 0; t < cells; t++) for (const d of [{ dr: 1, dc: 0 }, { dr: 0, dc: 1 }]) {
      const nr = r + d.dr, nc = t + d.dc
      if (nr >= 0 && nr < cells && nc >= 0 && nc < cells) {
        const wr = r * 2 + 1 + d.dr, wc = t * 2 + 1 + d.dc
        if (g[wr][wc] === 1) ca.push({ wr, wc })
      }
    }
    for (const s of shuffle(ca, rng).slice(0, Math.floor(ca.length * pct))) g[s.wr][s.wc] = 0
  },

  _branchCorridors(g, cells, cnt, rng) {
    const rd = rng || Math.random
    const corridors = []
    for (let r = 0; r < cells; r++) for (let c = 0; c < cells; c++) {
      if (g[r * 2 + 1][c * 2 + 1] !== 0) continue
      if (this._countOpenDirs(g, cells, r, c) !== 2) continue
      corridors.push({ r, c })
    }
    for (const cell of shuffle(corridors, rng).slice(0, cnt)) {
      const closed = []
      for (const d of DIRS) {
        const nr = cell.r + d.dr, nc = cell.c + d.dc
        if (nr < 0 || nr >= cells || nc < 0 || nc >= cells) continue
        const wr = cell.r * 2 + 1 + d.dr, wc = cell.c * 2 + 1 + d.dc
        if (g[wr][wc] === 1) {
          const oppR = nr + d.dr, oppC = nc + d.dc
          if (oppR >= 0 && oppR < cells && oppC >= 0 && oppC < cells && g[oppR * 2 + 1][oppC * 2 + 1] !== 0)
            closed.push({ wr, wc, nr, nc })
        }
      }
      if (closed.length === 0) continue
      const pick = closed[Math.floor(rd() * closed.length)]
      g[pick.wr][pick.wc] = 0
      g[pick.nr * 2 + 1][pick.nc * 2 + 1] = 0
    }
  },

  _addFalseLeads(g, cells, path, cnt, rng) {
    const rd = rng || Math.random, ss = new Set(path.map(p => cellKey(p.r, p.c)))
    const on = path.filter(p => this._countOpenDirs(g, cells, p.r, p.c) >= 2)
    if (on.length === 0) return
    const sel = shuffle(on, rng).slice(0, Math.min(cnt, on.length))
    const ex = this._allFalseLeadCells(g, cells, path)
    for (const or of sel) {
      const len = 8 + Math.floor(rd() * 8)
      const sd = shuffle(DIRS, rng).filter(d => {
        const nr = or.r + d.dr, nc = or.c + d.dc
        if (nr < 0 || nr >= cells || nc < 0 || nc >= cells) return false
        const wr = or.r * 2 + 1 + d.dr, wc = or.c * 2 + 1 + d.dc
        return g[wr][wc] === 1 && !ss.has(cellKey(nr, nc)) && !ex.has(cellKey(nr, nc))
      })
      if (sd.length === 0) continue
      let dr = sd[0].dr, dc = sd[0].dc, cr = or.r, cc = or.c
      for (let i = 0; i < len; i++) {
        const nr = cr + dr, nc = cc + dc
        if (nr < 0 || nr >= cells || nc < 0 || nc >= cells) break
        const wr = cr * 2 + 1 + dr, wc = cc * 2 + 1 + dc
        if (g[wr][wc] === 0) break
        if (ss.has(cellKey(nr, nc)) || ex.has(cellKey(nr, nc))) break
        g[wr][wc] = 0; g[nr * 2 + 1][nc * 2 + 1] = 0
        ex.add(cellKey(nr, nc))
        cr = nr; cc = nc
        if (rd() < 0.15) {
          const ad = DIRS.filter(x => !(x.dr === -dr && x.dc === -dc))
          const d2 = ad[Math.floor(rd() * ad.length)]; dr = d2.dr; dc = d2.dc
        }
      }
    }
  },

  _allFalseLeadCells(g, cells, path) {
    const ss = new Set(path.map(p => cellKey(p.r, p.c))), res = new Set()
    for (let r = 0; r < cells; r++) for (let t = 0; t < cells; t++)
      if (g[r * 2 + 1][t * 2 + 1] === 0 && !ss.has(cellKey(r, t))) res.add(cellKey(r, t))
    return res
  },

  _placeGems(g, cells, cnt, path, rng) {
    const ss = new Set(path.map(p => cellKey(p.r, p.c)))
    const des = this._findDeadEnds(g, cells).filter(d => !ss.has(cellKey(d.r, d.c)))
    if (des.length === 0) return null
    const dedup = des.filter((d, i, self) => i === self.findIndex(x => x.r === d.r && x.c === d.c))
    const sel = shuffle(dedup, rng).slice(0, Math.min(cnt, dedup.length))
    const gems = new Set()
    for (const s of sel) gems.add(cellKey(s.r, s.c))
    return gems
  },

  _findDeadEnds(g, cells) {
    const res = []
    for (let r = 0; r < cells; r++) for (let c = 0; c < cells; c++) {
      if (g[r * 2 + 1][c * 2 + 1] === 0) {
        let oc = 0
        for (const d of DIRS) {
          const nr = r + d.dr, nc = c + d.dc
          if (nr >= 0 && nr < cells && nc >= 0 && nc < cells && g[r * 2 + 1 + d.dr][c * 2 + 1 + d.dc] === 0) oc++
        }
        if (oc === 1) res.push({ r, c })
      }
    }
    return res
  },

  _getOnlyOpenDir(g, cells, r, t) {
    for (const d of DIRS) {
      const nr = r + d.dr, nc = t + d.dc
      if (nr >= 0 && nr < cells && nc >= 0 && nc < cells && g[r * 2 + 1 + d.dr][t * 2 + 1 + d.dc] === 0) return d
    }
    return null
  },

  _countOpenDirs(g, cells, r, t) {
    let cnt = 0
    for (const d of DIRS) {
      const nr = r + d.dr, nc = t + d.dc
      if (nr >= 0 && nr < cells && nc >= 0 && nc < cells && g[r * 2 + 1 + d.dr][t * 2 + 1 + d.dc] === 0) cnt++
    }
    return cnt
  },

  /* ── Metrics ── */
  _calcMetrics(g, cells, path, des, sc, ec) {
    const manhattan = Math.abs(sc.r - ec.r) + Math.abs(sc.c - ec.c)
    const tort = manhattan > 0 ? path.length / manhattan : 0
    let dl = 0, dc = 0, visDE = new Set()
    for (const de of des) {
      if (visDE.has(cellKey(de.r, de.c))) continue
      let cr = de.r, cc = de.c, len = 1
      visDE.add(cellKey(cr, cc))
      const di = this._getOnlyOpenDir(g, cells, cr, cc)
      if (!di) continue
      cr += di.dr; cc += di.dc
      while (cr >= 0 && cr < cells && cc >= 0 && cc < cells) {
        visDE.add(cellKey(cr, cc)); len++
        if (this._countOpenDirs(g, cells, cr, cc) !== 2) break
        let nd = null
        for (const d of DIRS) {
          const nr = cr + d.dr, nc = cc + d.dc
          if (nr >= 0 && nr < cells && nc >= 0 && nc < cells && !visDE.has(cellKey(nr, nc)) && g[cr * 2 + 1 + d.dr][cc * 2 + 1 + d.dc] === 0) { nd = d; break }
        }
        if (!nd) break
        cr += nd.dr; cc += nd.dc
      }
      dl += len; dc++
    }
    const adl = dc > 0 ? dl / dc : 0
    let nds = 0, eg = 0, joins = 0, joinSum = 0, entropySum = 0
    for (let r = 0; r < cells; r++) for (let s = 0; s < cells; s++) {
      if (g[r * 2 + 1][s * 2 + 1] === 0) {
        nds++
        if (r + 1 < cells && g[r * 2 + 2][s * 2 + 1] === 0) eg++
        if (s + 1 < cells && g[r * 2 + 1][s * 2 + 2] === 0) eg++
        const oc = this._countOpenDirs(g, cells, r, s)
        if (oc >= 3) { joins++; joinSum += oc; entropySum += Math.log2(oc) }
        else if (oc === 2) entropySum += 1
      }
    }
    const meanEntropy = nds > 0 ? entropySum / nds : 0
    return {
      tortuosity: tort,
      deadEndLen: adl,
      deadEndPct: nds > 0 ? (des.length / nds * 100) : 0,
      solutionPct: nds > 0 ? (path.length / nds * 100) : 0,
      loops: eg - (nds - 1),
      branchFactor: joins > 0 ? (joinSum / joins) : 0,
      entropy: meanEntropy,
      totalCells: nds
    }
  },

  /* ── Spectral analysis: λ₂ via shifted power iteration ── */
  _computeLambda2(g, cells) {
    const n = cells * cells
    const idx = (r, c) => r * cells + c
    const DIRS_XY = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }]
    let passageCount = 0
    const deg = new Int8Array(n)
    for (let r = 0; r < cells; r++) for (let c = 0; c < cells; c++) {
      if (g[r * 2 + 1][c * 2 + 1] !== 0) continue
      passageCount++
      const i = idx(r, c)
      for (const d of DIRS_XY) {
        const nr = r + d.dr, nc = c + d.dc
        if (nr >= 0 && nr < cells && nc >= 0 && nc < cells && g[r * 2 + 1 + d.dr][c * 2 + 1 + d.dc] === 0) deg[i]++
      }
    }
    if (passageCount < 4) return 0

    // Sparse mat-vec: L·v
    const matVec = (v, out) => {
      for (let i = 0; i < n; i++) out[i] = 0
      for (let r = 0; r < cells; r++) for (let c = 0; c < cells; c++) {
        if (g[r * 2 + 1][c * 2 + 1] !== 0) continue
        const i = idx(r, c)
        let sum = deg[i] * v[i]
        for (const d of DIRS_XY) {
          const nr = r + d.dr, nc = c + d.dc
          if (nr < 0 || nr >= cells || nc < 0 || nc >= cells) continue
          if (g[r * 2 + 1 + d.dr][c * 2 + 1 + d.dc] !== 0) continue
          sum -= v[idx(nr, nc)]
        }
        out[i] = sum
      }
    }

    const dot = (a, b) => { let s = 0; for (let i = 0; i < n; i++) s += a[i] * b[i]; return s }

    // Power iteration for λ_max
    let v = new Float64Array(n)
    for (let i = 0; i < n; i++) v[i] = Math.random() - 0.5
    let w = new Float64Array(n)
    for (let iter = 0; iter < 30; iter++) {
      matVec(v, w)
      const norm = Math.sqrt(dot(w, w))
      if (norm < 1e-10) break
      for (let i = 0; i < n; i++) v[i] = w[i] / norm
    }
    matVec(v, w)
    const λ_max = dot(v, w)

    // Orthogonalize against all-ones vector
    const vMean = v.reduce((a, b) => a + b, 0) / n
    for (let i = 0; i < n; i++) v[i] -= vMean
    const nrm = Math.sqrt(dot(v, v))
    if (nrm > 1e-10) for (let i = 0; i < n; i++) v[i] /= nrm

    // Shifted power iteration for λ₂
    for (let iter = 0; iter < 30; iter++) {
      matVec(v, w)
      for (let i = 0; i < n; i++) w[i] = λ_max * v[i] - w[i]
      const norm = Math.sqrt(dot(w, w))
      if (norm < 1e-10) break
      for (let i = 0; i < n; i++) v[i] = w[i] / norm
    }
    matVec(v, w)
    const μ = dot(v, w)
    const λ2 = Math.max(0, Math.min(4, μ))
    return λ2
  },

  _validateScore(m, diff) {
    const r = METRICS_RANGES[diff]
    let s = 0
    const add = (val, target, w) => {
      if (val < target[0]) s += (target[0] - val) * w
      if (val > target[1]) s += (val - target[1]) * w
    }
    add(m.tortuosity, r.tortuosity, 3)
    add(m.deadEndLen, r.deadEndLen, 2)
    add(m.loops, r.loops, 3)
    add(m.deadEndPct, r.deadEndPct, 2)
    add(m.solutionPct, r.solutionPct, 0.3)
    add(m.entropy, r.entropy, 6)
    return s
  }
}
