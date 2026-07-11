export class Timer {
  constructor() { this.st = 0; this.el = 0; this.r = false }
  start()  { this.st = performance.now(); this.el = 0; this.r = true }
  pause()  { if (!this.r) return; this.el += performance.now() - this.st; this.r = false }
  resume() { if (this.r) return; this.st = performance.now(); this.r = true }
  reset()  { this.st = performance.now(); this.el = 0; this.r = false }
  getMs()  { return this.r ? this.el + (performance.now() - this.st) : this.el }
  getDisp() {
    const ts = Math.floor(this.getMs() / 1000)
    const h = Math.floor(ts / 3600), m = Math.floor((ts % 3600) / 60), s = ts % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  getSec() { return Math.floor(this.getMs() / 1000) }
}
