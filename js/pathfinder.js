/* ── PathFinder: BFS with index-based queue ── */

import { DIRS } from './config.js'
import { cellKey } from './util.js'

export const PathFinder = {

  /* Find shortest path between two cells */
  findPath(grid, startCell, endCell, cells) {
    const queue = [{ r: startCell.r, c: startCell.c }]
    let head = 0
    const visited = new Set()
    const parent = new Map()
    visited.add(cellKey(startCell.r, startCell.c))

    while (head < queue.length) {
      const cur = queue[head++]
      if (cur.r === endCell.r && cur.c === endCell.c) {
        const path = []
        for (let p = cur; p; p = parent.get(cellKey(p.r, p.c))) {
          path.unshift({ r: p.r, c: p.c })
        }
        return path
      }
      for (const d of DIRS) {
        const nr = cur.r + d.dr, nc = cur.c + d.dc
        if (nr >= 0 && nr < cells && nc >= 0 && nc < cells) {
          const wr = cur.r * 2 + 1 + d.dr, wc = cur.c * 2 + 1 + d.dc
          const ck = cellKey(nr, nc)
          if (grid[wr][wc] === 0 && !visited.has(ck)) {
            visited.add(ck)
            parent.set(ck, { r: cur.r, c: cur.c })
            queue.push({ r: nr, c: nc })
          }
        }
      }
    }
    return null
  },

  /* Find all reachable cell keys (for ghost trail init) */
  findAllReachable(grid, startCell, cells) {
    const queue = [{ r: startCell.r, c: startCell.c }]
    let head = 0
    const visited = new Set()
    visited.add(cellKey(startCell.r, startCell.c))
    while (head < queue.length) {
      const cur = queue[head++]
      for (const d of DIRS) {
        const nr = cur.r + d.dr, nc = cur.c + d.dc
        if (nr >= 0 && nr < cells && nc >= 0 && nc < cells) {
          const wr = cur.r * 2 + 1 + d.dr, wc = cur.c * 2 + 1 + d.dc
          const ck = cellKey(nr, nc)
          if (grid[wr][wc] === 0 && !visited.has(ck)) {
            visited.add(ck)
            queue.push({ r: nr, c: nc })
          }
        }
      }
    }
    return visited
  }
}
