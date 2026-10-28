'use strict';
const path = require('path');
const { audit } = require('../src/audit');
const F = (n) => path.join(__dirname, 'fixtures', n);
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const rules = (r) => new Set(r.issues.map((i) => i.rule));

(async () => {
  const bad = await audit(F('bad.html'));
  const rb = rules(bad);
  for (const x of ['doc-lang', 'viewport-meta', 'img-alt', 'image-distortion', 'button-name', 'input-label', 'contrast', 'heading-order', 'font-size-small', 'focus-outline-removed', 'overflow-x'])
    ok(rb.has(x), `bad.html flags ${x}`);
  ok(bad.score.value < 40, 'bad.html scores low (' + bad.score.value + ')');

  const bm = await audit(F('bad-mobile.html'));
  for (const x of ['overflow-x', 'tap-target', 'image-crop', 'text-clipped']) ok(rules(bm).has(x), `bad-mobile.html flags ${x}`);

  const good = await audit(F('good.html'));
  ok(good.issues.length === 0, 'good.html has zero issues (got ' + good.issues.map((i) => i.rule) + ')');

  const ar = await audit(F('bad-ar.html'));
  for (const x of ['rtl-dir-missing', 'rtl-letter-spacing', 'rtl-arabic-font', 'rtl-physical-css', 'rtl-direction-glyph']) ok(rules(ar).has(x), `bad-ar.html flags ${x}`);

  const gar = await audit(F('good-ar.html'));
  ok(gar.issues.length === 0, 'good-ar.html has zero issues (got ' + gar.issues.map((i) => i.rule) + ')');
  ok(good.score.value === 100 && bad.score.value < good.score.value, 'score ordering sane');
  console.log(fail ? `\n${fail} FAILED` : '\nall passed');
  process.exit(fail ? 1 : 0);
})();
