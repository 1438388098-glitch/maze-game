/* ── Maze Generator ── 4 algorithms + MCMC tuning + advanced metrics ── */

import { DIRS, METRICS_RANGES, DEAD_END_PROFILE, ROOM_COUNT, GEM_COUNT } from './config.js'
import { cellKey, shuffle, weightedDeadLen, createRNG } from './util.js'
import { PathFinder } from './pathfinder.js'

export const MazeGen = {

  generate(cells, difficulty, seed, mode) {
    const rng = seed != null ? createRNG(seed) : null
    const rand = rng || Math.random
    const { sr, sc, er, ec } = this._endpoints(cells, difficulty, rand)
    let bestGrid = null, bestPath = null, bestScore = Infinity, bestMetrics = null, bestGems = null

    for (let a = 0; a < 8; a++) {
      const grid = this._genBase(cells, difficulty, rng)
      const sp = this._postProcess(grid, cells, difficulty, rng, { r: sr, c: sc }, { r: er, c: ec })
      if (!sp) continue
      const fp = this._mcmcTune(grid, cells, difficulty, sp, rng, { r: sr, c: sc }, { r: er, c: ec })
      if (!fp) continue
      let gems = null
      if (mode === 'treasure') gems = this._placeGems(grid, cells, GEM_COUNT[difficulty] || 4, fp, rng)
      const de = this._findDeadEnds(grid, cells)
      const metrics = this._calcMetrics(grid, cells, fp, de, { r: sr, c: sc }, { r: er, c: ec })
      const score = this._validateScore(metrics, difficulty)
      if (score <= 0.3) {
        this._removeIsolatedWalls(grid, cells)
        return { grid, solutionPath: fp, start: { r: sr, c: sc }, end: { r: er, c: ec }, gems, metrics }
      }
      if (score < bestScore) {
        bestScore = score; bestGrid = grid; bestPath = fp; bestMetrics = metrics; bestGems = gems
      }
    }
    if (bestGrid) this._removeIsolatedWalls(bestGrid, cells)
    return {
      grid: bestGrid, solutionPath: bestPath,
      start: { r: sr, c: sc }, end: { r: er, c: ec },
      gems: bestGems, metrics: bestMetrics
    }
  },

  _endpoints(cells, diff, rand) {
    if (diff === 'beginner') return { sr: 0, sc: 0, er: cells - 1, ec: cells - 1 }
    if (diff === 'normal') {
      const cs = shuffle([{ r: 0, c: 0 }, { r: 0, c: cells - 1 }, { r: cells - 1, c: 0 }, { r: cells - 1, c: cells - 1 }], rand)
      return { sr: cs[0].r, sc: cs[0].c, er: cs[1].r, ec: cs[1].c }
    }
    if (diff === 'hard') {
      const edge = (len) => {
        const p = Math.floor(rand() * len)
        return [{ r: 0, c: p }, { r: len - 1, c: p }, { r: p, c: 0 }, { r: p, c: len - 1 }][Math.floor(rand() * 4)]
      }
      const s = edge(cells)
      let e
      do e = edge(cells)
      while (Math.abs(s.r - e.r) + Math.abs(s.c - e.c) < cells * 0.6)
      return { sr: s.r, sc: s.c, er: e.r, ec: e.c }
    }
    // hell, super, supermax: random endpoints with increasing distance
    const minDist = diff === 'supermax' ? 0.7 : diff === 'super' ? 0.6 : 0.5
    const s = { r: Math.floor(rand() * cells), c: Math.floor(rand() * cells) }
    let e
    do e = { r: Math.floor(rand() * cells), c: Math.floor(rand() * cells) }
    while (Math.abs(s.r - e.r) + Math.abs(s.c - e.c) < cells * minDist)
    return { sr: s.r, sc: s.c, er: e.r, ec: e.c }
  },

  _genBase(cells, diff, rng) {
    const sz = cells * 2 + 1
    const g = Array.from({ length: sz }, () => new Array(sz).fill(1))
    switch (diff) {
      case 'beginner': this._dfsRelaxed(g, cells, rng); break
      case 'normal':   this._huntKill(g, cells, rng);   break
      case 'hard':     this._prim(g, cells, rng);        break
      case 'hell':     this._wilson(g, cells, rng);      break
      case 'super':    this._wilson(g, cells, rng);      break
      case 'supermax': this._wilson(g, cells, rng);      break
    }
    return g
  },

  /* ── DFS relaxed (beginner) — long corridors, occasional loops ── */
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

  /* ── Hunt-and-Kill (normal) ── */
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

  /* ── Prim's (hard) — swap-and-pop frontier ── */
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

  /* ── Wilson's (hell) — loop-erased random walk ── */
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

  /* ── MCMC: light optimization pass ── */
  _mcmcTune(g, cells, diff, initialPath, rng, sc, ec) {
    const rd = rng || Math.random
    let bestGrid = g.map(row => [...row]), bestPath = initialPath
    let curGrid = bestGrid, curPath = bestPath
    let bestLoss = this._validateScore(this._calcMetrics(g, cells, initialPath, this._findDeadEnds(g, cells), sc, ec), diff)
    let curLoss = bestLoss
    let fp, newMetrics, newLoss, stuck = 0
    const nCells = cells * cells
    const iterations = Math.max(5, Math.floor(nCells * 0.015))
    const tempStart = 0.3, tempEnd = 0.01

    for (let t = 0; t < iterations; t++) {
      const temp = tempStart * Math.pow(tempEnd / tempStart, t / iterations)
      const { wr, wc, oldVal } = this._proposeMove(curGrid, cells, rd)
      if (wr == null) continue
      curGrid[wr][wc] = 1 - oldVal
      fp = PathFinder.findPath(curGrid, sc, ec, cells)
      if (!fp) { curGrid[wr][wc] = oldVal; continue }
      newMetrics = this._calcMetrics(curGrid, cells, fp, this._findDeadEnds(curGrid, cells), sc, ec)
      newLoss = this._validateScore(newMetrics, diff)
      const delta = newLoss - curLoss
      if (delta < 0 || rd() < Math.exp(-delta / Math.max(temp, 0.001))) {
        curPath = fp; curLoss = newLoss; stuck = 0
        if (newLoss < bestLoss) {
          bestGrid = curGrid.map(row => [...row]); bestPath = fp; bestLoss = newLoss
        }
      } else { curGrid[wr][wc] = oldVal; stuck++ }
      if (stuck > 15 && bestLoss < 3) break
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

    switch (diff) {
      case 'beginner': this._addShortcuts(g, cells, 0.15, rng); this._extendDeadEnds(g, cells, 0.15, 2, 4, rng, diff); break
      case 'normal':   this._addShortcuts(g, cells, 0.05, rng); this._extendDeadEnds(g, cells, 0.15, 2, 4, rng, diff); break
      case 'hard':     this._extendDeadEnds(g, cells, 0.35, 4, 10, rng, diff); break
      case 'hell':     if (prePath) { this._extendDeadEnds(g, cells, 0.45, 5, 15, rng, diff); this._addFalseLeads(g, cells, prePath, 5 + Math.floor(rd() * 4), rng) } break
      case 'super':    if (prePath) { this._extendDeadEnds(g, cells, 0.60, 6, 20, rng, diff); this._addFalseLeads(g, cells, prePath, 8 + Math.floor(rd() * 4), rng) } break
      case 'supermax': if (prePath) { this._extendDeadEnds(g, cells, 0.70, 8, 30, rng, diff); this._addFalseLeads(g, cells, prePath, 12 + Math.floor(rd() * 4), rng) } break
    }
    this._addRooms(g, cells, ROOM_COUNT[diff] || 0, rng)
    if (diff === 'hell' || diff === 'super' || diff === 'supermax') this._extendDeadEnds(g, cells, 0.3, 3, 12, rng, diff)
    // super/supermax second dead end pass with higher pct
    if (diff === 'super') this._extendDeadEnds(g, cells, 0.4, 6, 18, rng, diff)
    if (diff === 'supermax') this._extendDeadEnds(g, cells, 0.5, 8, 25, rng, diff)
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

  _extendDeadEnds(g, cells, pct, minL, maxL, rng, diff) {
    const rd = rng || Math.random, pr = DEAD_END_PROFILE[diff] || [30, 50, 20]
    const des = this._findDeadEnds(g, cells)
    for (const de of shuffle(des, rng).slice(0, Math.floor(des.length * pct))) {
      const len = weightedDeadLen(rng, minL, maxL, pr)
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
        if (rd() < 0.2) {
          const ad = DIRS.filter(x => !(x.dr === -dr && x.dc === -dc))
          const d2 = ad[Math.floor(rd() * ad.length)]; dr = d2.dr; dc = d2.dc
        }
      }
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
    const fractalDim = this._fractalDim(g, cells)
    return {
      tortuosity: tort,
      deadEndLen: adl,
      deadEndPct: nds > 0 ? (des.length / nds * 100) : 0,
      solutionPct: nds > 0 ? (path.length / nds * 100) : 0,
      loops: eg - (nds - 1),
      branchFactor: joins > 0 ? (joinSum / joins) : 0,
      entropy: meanEntropy,
      fractalDim,
      totalCells: nds
    }
  },

  _fractalDim(g, cells) {
    const scales = [2, 3, 4, 6, 8].filter(s => s <= cells)
    if (scales.length < 2) return 1.4
    let xs = [], ys = []
    for (const s of scales) {
      let count = 0
      for (let r = 0; r < cells; r += s) for (let c = 0; c < cells; c += s) {
        let has = false
        for (let dr = 0; dr < s && !has; dr++) for (let dc = 0; dc < s && !has; dc++)
          if (r + dr < cells && c + dc < cells && g[(r+dr)*2+1][(c+dc)*2+1] === 0) has = true
        if (has) count++
      }
      xs.push(Math.log(cells / Math.max(s, 1)))
      ys.push(Math.log(Math.max(1, count)))
    }
    const n = xs.length
    let sx = 0, sy = 0, sxx = 0, sxy = 0
    for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i] }
    const D = (n * sxy - sx * sy) / (n * sxx - sx * sx)
    return Math.max(1.0, Math.min(1.9, D))
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
    add(m.deadEndPct, r.deadEndPct, 1)
    add(m.solutionPct, r.solutionPct, 0.3)
    add(m.entropy, r.entropy, 4)
    if (m.fractalDim < r.fractal[0]) s += (r.fractal[0] - m.fractalDim) * 1
    if (m.fractalDim > r.fractal[1]) s += (m.fractalDim - r.fractal[1]) * 1
    return s
  }
}
