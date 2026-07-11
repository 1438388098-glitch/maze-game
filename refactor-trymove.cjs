const fs = require('fs');
let c = fs.readFileSync('D:/Claudeworkspace/maze-game/js/app.js', 'utf8');

// Find the _tryMove method and extract win logic into helper methods

// 1. Replace the ghost score bonus block
const ghostBonusStart = `        // Ghost mode bonus
	        if (this.engine.mode === 'ghost' && this.engine.ghostData && !this.engine.isDaily) {
	          const ghostSteps = this.engine.ghostData.steps || Infinity
	          const ghostTime = this.engine.ghostData.time || Infinity
	          const beatGhost = steps < ghostSteps || el < ghostTime
	          const beatPerfect = this.engine.ghostIsPerfect && beatGhost
	          if (beatPerfect) {
	            score = Math.round(score * 1.25)
	          } else if (beatGhost && !this.engine.ghostIsPerfect) {
	            score = Math.round(score * 1.1)
	          }
	        }`;

const ghostBonusRepl = `        score = this._applyGhostBonus(score, steps, el)`;

c = c.replace(ghostBonusStart, ghostBonusRepl);

// 2. Replace the save ghost block
const saveGhostStart = `	        // Save ghost path
	        if (this.engine.mode === 'ghost' && !this.engine.isDaily && score > 0 && this.engine.ph.length > 1) {
	          const ghostPath = this.engine.ph.map((p, i) => ({
	            r: p.r, c: p.c, t: i * this.moveCd
	          }))
	          Score.saveGhost(this.engine.seed, this.engine.diff, this.engine.mode, ghostPath, el, steps)
	        }`;

const saveGhostRepl = `	        this._saveGhostPath(el, steps, score)`;

c = c.replace(saveGhostStart, saveGhostRepl);

// 3. Replace the history recording block
const historyStart = `	        // Record to history (not for campaign — campaign records per-level)
	        if (!this.engine.isCampaign) {
	          Score.addHistory({
	            mode: this.engine.mode,
	            diff: this.engine.diff,
	            time: el,
	            steps: this.engine.steps,
	            score: score,
	            efficiency: solLen > 0 ? solLen / Math.max(1, steps) : 0,
	            wallBumps: this.engine.wallBumps,
	            backtracks: this.engine.btCount,
	            seed: this.engine.seed,
	            isCampaign: false
	          })
	        }`;

const historyRepl = `	        this._recordHistory(el, steps, score, solLen)`;

c = c.replace(historyStart, historyRepl);

// 4. Replace campaign stats collection
const campaignStatsStart = `	        // Collect campaign level stats
	        if (this.engine.isCampaign) {
	          this._campaignStats.push({
	            level: this.campaignIdx + 1,
	            diff: this.engine.diff,
	            time: el,
	            steps: this.engine.steps,
	            score: score,
	            efficiency: solLen > 0 ? (solLen / steps) : 0,
	            wallBumps: this.engine.wallBumps,
	            backtracks: this.engine.btCount
	          })
	        }`;

const campaignStatsRepl = `	        this._collectCampaignStats(el, steps, score, solLen)`;

c = c.replace(campaignStatsStart, campaignStatsRepl);

// 5. Add helper methods after _backtrack
const helperMethods = `
  /** Apply ghost mode score bonus */
  _applyGhostBonus(score, steps, el) {
    if (this.engine.mode === 'ghost' && this.engine.ghostData && !this.engine.isDaily) {
      const ghostSteps = this.engine.ghostData.steps || Infinity
      const ghostTime = this.engine.ghostData.time || Infinity
      const beatGhost = steps < ghostSteps || el < ghostTime
      const beatPerfect = this.engine.ghostIsPerfect && beatGhost
      if (beatPerfect) score = Math.round(score * 1.25)
      else if (beatGhost && !this.engine.ghostIsPerfect) score = Math.round(score * 1.1)
    }
    return score
  }

  /** Save ghost path on win */
  _saveGhostPath(el, steps, score) {
    if (this.engine.mode === 'ghost' && !this.engine.isDaily && score > 0 && this.engine.ph.length > 1) {
      const ghostPath = this.engine.ph.map((p, i) => ({ r: p.r, c: p.c, t: i * this.moveCd }))
      Score.saveGhost(this.engine.seed, this.engine.diff, this.engine.mode, ghostPath, el, steps)
    }
  }

  /** Record game to history */
  _recordHistory(el, steps, score, solLen) {
    if (!this.engine.isCampaign) {
      Score.addHistory({
        mode: this.engine.mode, diff: this.engine.diff, time: el,
        steps: this.engine.steps, score: score,
        efficiency: solLen > 0 ? solLen / Math.max(1, steps) : 0,
        wallBumps: this.engine.wallBumps, backtracks: this.engine.btCount,
        seed: this.engine.seed, isCampaign: false
      })
    }
  }

  /** Collect campaign level stats */
  _collectCampaignStats(el, steps, score, solLen) {
    if (this.engine.isCampaign) {
      this._campaignStats.push({
        level: this.campaignIdx + 1, diff: this.engine.diff,
        time: el, steps: this.engine.steps, score: score,
        efficiency: solLen > 0 ? (solLen / steps) : 0,
        wallBumps: this.engine.wallBumps, backtracks: this.engine.btCount
      })
    }
  }
`;

const insertPoint = c.indexOf('  _getCampaignDiffLabel(idx)');
if (insertPoint >= 0) {
  // Insert before _getCampaignDiffLabel
  const before = c.substring(0, insertPoint);
  const after = c.substring(insertPoint);
  c = before + helperMethods + '\n' + after;
}

fs.writeFileSync('D:/Claudeworkspace/maze-game/js/app.js', c, 'utf8');
console.log('OK');