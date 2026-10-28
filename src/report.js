'use strict';
const fs = require('fs');
const path = require('path');
const { SEV, UI } = require('./i18n');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICON = { error: '🔴', warn: '🟠', info: '🔵' };

function markdown(r, lang) {
  const L = [];
  if (lang === 'ar') {
    L.push(`# ${UI.title}: ${r.score.value}/100 (${r.score.grade})`);
    L.push('', `${UI.target}: \`${r.target}\``, `${UI.found}: **${r.counts.error} ${UI.errors}**، ${r.counts.warn} ${UI.warnings}، ${r.counts.info} ${UI.notes}`, '');
    if (!r.issues.length) { L.push(UI.none); return L.join('\n'); }
    L.push(`## ${UI.fixList}`, '');
    for (const i of r.issues) {
      const a = i.ar || { title: i.rule, what: i.message, fix: i.fix };
      L.push(`${i.id}. ${ICON[i.severity]} **${a.title}** (${SEV[i.severity]}) — ${a.what}`);
      if (i.selector) L.push(`   - ${UI.where}: \`${i.selector}\`${i.text ? ` ("${i.text}")` : ''} · ${i.viewports.join(', ')}`);
      L.push(`   - ${UI.detail}: ${i.message}`);
      L.push(`   - ${UI.fix}: ${a.fix}`);
    }
    return L.join('\n');
  }
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

function html(r, defLang) {
  const rows = r.issues.map((i) => {
    const a = i.ar || { title: i.rule, what: i.message, fix: i.fix };
    return `<li class="${i.severity}"><div class="en"><b>#${i.id} ${esc(i.rule)}</b> <small>${esc(i.viewports.join(' · '))}</small><p>${esc(i.message)}</p>${i.selector ? `<code>${esc(i.selector)}</code>` : ''}<p class="fix">Fix: ${esc(i.fix)}</p></div>` +
      `<div class="ar" lang="ar"><b>#${i.id} ${esc(a.title)}</b> <small>${esc(SEV[i.severity])} · ${esc(i.viewports.join(' · '))}</small><p>${esc(a.what)}</p>${i.selector ? `<code>${esc(i.selector)}</code>` : ''}<p class="det">${esc(UI.detail)}: ${esc(i.message)}</p><p class="fix">${esc(UI.fix)}: ${esc(a.fix)}</p></div></li>`;
  }).join('');
  const imgs = r.viewports.filter((v) => v.screenshots).map((v) => `<figure><figcaption>${v.viewport} ${v.size.join('×')}</figcaption><img src="${esc(path.basename((v.screenshots.annotated || v.screenshots.plain)))}" alt="${v.viewport} annotated screenshot"></figure>`).join('');
  return `<!doctype html><html lang="${defLang || 'en'}" dir="${defLang === 'ar' ? 'rtl' : 'ltr'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sightline report</title>
<style>:root{--bg:#0b1020;--card:#141b34;--line:#26305a;--tx:#e8ecf5;--mut:#a3adc9}
body{font:16px/1.6 system-ui,"Segoe UI",Tahoma,sans-serif;margin:0;background:var(--bg);color:var(--tx)}main{max-width:1100px;margin:auto;padding:24px 16px}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
h1{margin:0;font-size:28px}.score{direction:ltr;text-align:start;unicode-bidi:isolate;font-size:56px;font-weight:800;line-height:1.1}.score small{font-size:20px;color:var(--mut);font-weight:600}
.lang{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}.lang button{min-height:44px;min-width:44px;padding:0 14px;background:none;color:var(--mut);border:0;font:inherit;cursor:pointer}.lang button[aria-pressed=true]{background:#5ee0b0;color:#04261a;font-weight:700}
:focus-visible{outline:3px solid #5ee0b0;outline-offset:2px}
ul{padding:0}li{list-style:none;background:var(--card);border-inline-start:4px solid;margin:8px 0;padding:10px 14px;border-radius:6px}li.error{border-color:#ff5d7a}li.warn{border-color:#ffa94d}li.info{border-color:#4aa3ff}
li p{margin:4px 0}code{color:#9fd0ff;direction:ltr;unicode-bidi:isolate;font-size:14px;overflow-wrap:anywhere}.fix{color:#9be29b}.det{color:var(--mut);font-size:14px;direction:ltr;text-align:start}small{color:var(--mut)}
html[dir=rtl] .score{text-align:right}html[lang=ar] .en,html[lang=en] .ar{display:none}.shots{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}figure{margin:0}figcaption{color:var(--mut)}img{max-width:100%;max-height:900px;border:1px solid var(--line);border-radius:6px}
.sum{color:var(--mut)}</style>
<main><div class="top"><div><h1><span class="en">Sightline</span><span class="ar" lang="ar">${UI.title}</span></h1></div>
<div class="lang" role="group" aria-label="Language"><button type="button" data-l="en" aria-pressed="${defLang !== 'ar'}">English</button><button type="button" data-l="ar" aria-pressed="${defLang === 'ar'}" lang="ar">العربية</button></div></div>
<div class="score">${r.score.value}<small>/100 · ${r.score.grade}</small></div>
<p class="sum"><span class="en"><bdi dir="ltr">${esc(r.target)}</bdi>: ${r.counts.error} errors, ${r.counts.warn} warnings, ${r.counts.info} notes</span><span class="ar" lang="ar"><bdi dir="ltr">${esc(r.target)}</bdi>: ${r.counts.error} ${UI.errors}، ${r.counts.warn} ${UI.warnings}، ${r.counts.info} ${UI.notes}</span></p>
<ul>${rows || `<li class="info"><span class="en">No defects detected.</span><span class="ar" lang="ar">${UI.none}</span></li>`}</ul>
<div class="shots">${imgs}</div></main>
<script>(function(){var h=document.documentElement,K="sl-report-lang";function set(l){h.lang=l;h.dir=l==="ar"?"rtl":"ltr";document.querySelectorAll(".lang button").forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.l===l))});try{localStorage.setItem(K,l)}catch(e){}}
document.querySelectorAll(".lang button").forEach(function(b){b.addEventListener("click",function(){set(b.dataset.l)})});
var q=(location.search.match(/[?&]lang=(en|ar)/)||[])[1],s=null;try{s=localStorage.getItem(K)}catch(e){}
var l=q||s||"${defLang || ''}"||((navigator.language||"").slice(0,2)==="ar"?"ar":"en");set(l)})();</script></html>`;
}

function write(r, dir, lang) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(r, null, 2));
  fs.writeFileSync(path.join(dir, 'report.md'), markdown(r, lang === 'ar' ? 'ar' : 'en'));
  fs.writeFileSync(path.join(dir, 'report.ar.md'), markdown(r, 'ar'));
  fs.writeFileSync(path.join(dir, 'report.html'), html(r, lang === 'ar' ? 'ar' : ''));
}
module.exports = { markdown, html, write };
