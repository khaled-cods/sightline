'use strict';
const W = { error: 8, warn: 3, info: 1 };
const CAP = { error: 24, warn: 12, info: 4 }; // per rule, so one repeated bug can't zero the score

function score(issues) {
  const byRule = {};
  for (const i of issues) {
    const r = (byRule[i.rule] = byRule[i.rule] || { sev: i.severity, pts: 0 });
    r.pts = Math.min(CAP[i.severity] || 4, r.pts + (W[i.severity] || 1));
  }
  const lost = Object.values(byRule).reduce((a, r) => a + r.pts, 0);
  const value = Math.max(0, 100 - lost);
  const grade = value >= 95 ? 'A+' : value >= 90 ? 'A' : value >= 80 ? 'B' : value >= 70 ? 'C' : value >= 55 ? 'D' : 'F';
  return { value, grade };
}
module.exports = { score };
