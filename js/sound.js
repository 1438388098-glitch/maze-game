export class Sound {
  constructor() { this.ctx = null; this.on = true; this.tried = false }
  _init() {
    if (this.tried) return
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)()
      if (this.ctx.state === 'suspended') this.ctx.resume()
    } catch (e) { this.on = false }
    this.tried = true
  }
  ensure() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); this._init() }
  _play(f, dur, tp, vol) {
    if (!this.on) return; this._init(); if (!this.ctx) return
    try {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain()
      o.type = tp || 'sine'; o.frequency.value = f
      g.gain.setValueAtTime(vol || 0.08, this.ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur)
      o.connect(g); g.connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime + dur)
    } catch (e) { /* ignore */ }
  }
  move()       { this._play(600, 0.04, 'square', 0.04) }
  wallBump()   { this._play(120, 0.08, 'triangle', 0.06) }
  win()        { this._play(523, 0.12, 'sine', 0.08); setTimeout(() => this._play(659, 0.12, 'sine', 0.08), 80); setTimeout(() => this._play(784, 0.18, 'sine', 0.08), 160) }
  fail()       { this._play(180, 0.3, 'sawtooth', 0.06) }
  click()      { this._play(1000, 0.03, 'sine', 0.03) }
  tick()       { this._play(900, 0.05, 'square', 0.05) }
  gem()        { this._play(1200, 0.08, 'sine', 0.06) }
  proximity(f) { this._play(f, 0.08, 'sine', 0.02) }
}
