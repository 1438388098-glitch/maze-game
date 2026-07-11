/* ── Utilities ── */

export function cellKey(r, c) { return `${r},${c}` }
export function gridSize(cells) { return cells * 2 + 1 }

export function isInputFocused() {
  const t = document.activeElement
  if (!t) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
}

export function shuffle(arr, rng) {
  const a = arr.slice()
  const r = rng || Math.random
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ── RNG: splitmix32 seeded generator ── */
export function createRNG(seed) {
  let s = seed | 0
  return function () {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0 }
  return Math.abs(h)
}

export function getDailySeed() {
  const d = new Date()
  return hashStr(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
}

/* ── Weighted random for dead-end depths ── */
export function weightedDeadLen(rng, min, max, profile) {
  const rand = rng || Math.random
  const total = profile[0] + profile[1] + profile[2]
  const r = rand() * total
  if (r < profile[0]) return min + Math.floor(rand() * Math.min(3, max - min + 1))
  if (r < profile[0] + profile[1]) return Math.max(4, min) + Math.floor(rand() * Math.min(5, max - min + 1))
  return Math.max(9, min) + Math.floor(rand() * (max - Math.max(9, min) + 1))
}
