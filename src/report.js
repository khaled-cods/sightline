'use strict';
const fs = require('fs');
const path = require('path');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICON = { error: '🔴', warn: '🟠', info: '🔵' };

function markdown(r) {
  const L = [];
  L.push(`# Sightline report — score ${r.score.value}/100 (${r.score.grade})`);
  L.push('', `Target: \`${r.target}\`  `, `Found: **${r.counts.error} errors**, ${r.counts.warn} warnings, ${r.counts.info} notes`, '');
  if (!r.issues.length) { L.push('No visual or accessibility defects detected. ✅'); return L.join('\n'); }
  L.push('## Fix list (most severe first)', '');
  for (const i of r.issues) {
    L.push(`${i.id}. ${ICON[i.severity]} **${i.rule}** — ${i.message}`);
    if (i.selector) L.push(`   - where: \`${i.selector}\`${i.text ? ` ("${i.text}")` : ''} · ${i.viewports.join(', ')}`);
    L.push(`   - fix: ${i.fix}`);
  }
  const shots = r.viewports.filter((v) => v.screenshots && v.screenshots.annotated);
  if (shots.length) { L.push('', '## Screenshots', ''); shots.forEach((v) => L.push(`- ${v.viewport}: ${path.basename(v.screenshots.annotated)} (numbers match the fix list)`)); }
  return L.join('\n');
}

function html(r) {
  const rows = r.issues.map((i) => `<li class="${i.severity}"><b>#${i.id} ${esc(i.rule)}</b> <small>${esc(i.viewports.join(' · '))}</small><p>${esc(i.message)}</p>${i.selector ? `<code>${esc(i.selector)}</code>` : ''}<p class="fix">Fix: ${esc(i.fix)}</p></li>`).join('');
  const imgs = r.viewports.filter((v) => v.screenshots).map((v) => `<figure><figcaption>${v.viewport} ${v.size.join('×')}</figcaption><img src="${esc(path.basename((v.screenshots.annotated || v.screenshots.plain)))}" alt="${v.viewport} annotated screenshot"></figure>`).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sightline report</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#0b1020;color:#e8ecf5}main{max-width:1100px;margin:auto;padding:24px 16px}h1{margin:0 0 4px}.score{font-size:56px;font-weight:800}
li{list-style:none;background:#141b34;border-left:4px solid;margin:8px 0;padding:10px 14px;border-radius:6px}li.error{border-color:#ff2d55}li.warn{border-color:#ff9500}li.info{border-color:#0a84ff}
code{color:#9fd0ff}.fix{color:#9be29b}small{opacity:.7}ul{padding:0}.shots{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}figure{margin:0}img{max-width:100%;max-height:900px;border:1px solid #2a3560;border-radius:6px}</style>
<main><h1>Sightline</h1><div class="score">${r.score.value}<small>/100 · ${r.score.grade}</small></div><p>${esc(r.target)} — ${r.counts.error} errors, ${r.counts.warn} warnings, ${r.counts.info} notes</p><ul>${rows || '<li class="info">No defects detected.</li>'}</ul><div class="shots">${imgs}</div></main></html>`;
}

function write(r, dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(r, null, 2));
  fs.writeFileSync(path.join(dir, 'report.md'), markdown(r));
  fs.writeFileSync(path.join(dir, 'report.html'), html(r));
}
module.exports = { markdown, html, write };
