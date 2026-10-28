#!/usr/bin/env node
'use strict';
const path = require('path');
const { audit } = require('../src/audit');
const report = require('../src/report');

const HELP = `sightline — let your AI agent see the UI it built

Usage: sightline <url | file.html> [options]

  --out <dir>          where to write report + annotated screenshots (default ./sightline-out)
  --viewports a,b      mobile,tablet,desktop (default mobile,desktop)
  --dark               audit with prefers-color-scheme: dark
  --lang <en|ar>       language of the printed report (report.html always has both; default en)
  --json               print JSON to stdout instead of Markdown
  --fail-under <n>     exit 1 when the score is below n (for CI)
  -h, --help
`;

(async () => {
  const a = process.argv.slice(2);
  if (!a.length || a.includes('-h') || a.includes('--help')) { console.log(HELP); process.exit(a.length ? 0 : 2); }
  const o = { target: null, out: 'sightline-out', viewports: null, dark: false, json: false, lang: 'en', failUnder: null };
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '--out') o.out = a[++i];
    else if (x === '--viewports') o.viewports = a[++i].split(',');
    else if (x === '--dark') o.dark = true;
    else if (x === '--lang') o.lang = a[++i] === 'ar' ? 'ar' : 'en';
    else if (x === '--json') o.json = true;
    else if (x === '--fail-under') o.failUnder = +a[++i];
    else if (!x.startsWith('--') && !o.target) o.target = x;
  }
  if (!o.target) { console.error('Missing target.\n' + HELP); process.exit(2); }
  try {
    const r = await audit(o.target, { outDir: path.resolve(o.out), viewports: o.viewports, dark: o.dark });
    report.write(r, path.resolve(o.out), o.lang);
    console.log(o.json ? JSON.stringify(r, null, 2) : report.markdown(r, o.lang));
    if (!o.json) console.error(`\nFull report: ${path.join(o.out, 'report.html')}`);
    process.exit(o.failUnder != null && r.score.value < o.failUnder ? 1 : 0);
  } catch (e) { console.error('sightline: ' + e.message); process.exit(2); }
})();
