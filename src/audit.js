'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const inpage = require('./inpage');
const { score } = require('./score');
const { arFor } = require('./i18n');

const VIEWPORTS = {
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  tablet: { width: 820, height: 1180, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
};
const COLORS = { error: '#ff2d55', warn: '#ff9500', info: '#0a84ff' };

function toUrl(target) {
  if (/^https?:\/\//i.test(target) || target.startsWith('file://')) return target;
  const p = path.resolve(target);
  if (!fs.existsSync(p)) throw new Error('File not found: ' + target);
  return pathToFileURL(p).href;
}

async function annotate(page, issues) {
  await page.evaluate(({ issues, COLORS }) => {
    const layer = document.createElement('div');
    layer.id = '__sightline';
    layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none';
    issues.forEach((it, n) => {
      if (!it.rect || it.rect.w < 2 || it.rect.h < 2) return;
      const c = COLORS[it.severity];
      const b = document.createElement('div');
      b.style.cssText = `position:absolute;left:${it.rect.x}px;top:${it.rect.y}px;width:${it.rect.w}px;height:${it.rect.h}px;outline:2px solid ${c};background:${c}22;box-sizing:border-box`;
      const t = document.createElement('div');
      t.textContent = n + 1;
      t.style.cssText = `position:absolute;left:0;top:-18px;min-width:18px;height:18px;padding:0 4px;background:${c};color:#fff;font:700 11px/18px system-ui,sans-serif;text-align:center;border-radius:3px;direction:ltr`;
      b.appendChild(t); layer.appendChild(b);
    });
    document.body.appendChild(layer);
  }, { issues, COLORS });
}

async function auditViewport(browser, url, name, opts) {
  const vp = VIEWPORTS[name];
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1, colorScheme: opts.dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: opts.dark ? 'dark' : 'light' });
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e.message || e)));
  await page.goto(url, { waitUntil: 'load', timeout: opts.timeout || 30000 });
  try { await page.waitForLoadState('networkidle', { timeout: 4000 }); } catch (e) { }
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => { });
  // trigger lazy content
  await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(250);

  const res = await page.evaluate(inpage, { vw: vp.width });
  if (consoleErrors.length) res.issues.push({ rule: 'js-error', severity: 'warn', message: consoleErrors.length + ' uncaught JavaScript error(s): ' + consoleErrors[0].slice(0, 120), fix: 'Open the console and fix the exception; broken scripts often leave the UI half-rendered.', selector: 'window', text: '', rect: null });
  for (const i of res.issues) i.viewport = name;

  let shot = null;
  if (opts.outDir) {
    fs.mkdirSync(opts.outDir, { recursive: true });
    const plain = path.join(opts.outDir, `${name}.png`);
    const ann = path.join(opts.outDir, `${name}.annotated.png`);
    const full = await page.evaluate(() => document.documentElement.scrollHeight);
    const clip = full > 9000; // protect against giant pages
    await page.screenshot({ path: plain, fullPage: !clip });
    if (res.issues.some((i) => i.rect)) { await annotate(page, res.issues); await page.screenshot({ path: ann, fullPage: !clip }); }
    shot = { plain, annotated: res.issues.some((i) => i.rect) ? ann : null };
  }
  await ctx.close();
  return { viewport: name, size: [vp.width, vp.height], issues: res.issues, meta: res.meta, screenshots: shot };
}

async function audit(target, opts = {}) {
  const { chromium } = require('playwright');
  const url = toUrl(target);
  const names = (opts.viewports && opts.viewports.length ? opts.viewports : ['mobile', 'desktop']).filter((n) => VIEWPORTS[n]);
  const browser = await chromium.launch();
  const results = [];
  try { for (const n of names) results.push(await auditViewport(browser, url, n, opts)); }
  finally { await browser.close(); }

  // merge identical issues across viewports
  const merged = new Map();
  for (const r of results) for (const i of r.issues) {
    const k = [i.rule, i.selector, i.message.replace(/\d+/g, '#')].join('|');
    if (merged.has(k)) merged.get(k).viewports.push(r.viewport);
    else merged.set(k, Object.assign({}, i, { viewports: [r.viewport] }));
  }
  const order = { error: 0, warn: 1, info: 2 };
  const issues = [...merged.values()].sort((a, b) => order[a.severity] - order[b.severity]);
  issues.forEach((i, n) => { i.id = n + 1; i.ar = arFor(i.rule); });
  const sc = score(issues);
  const counts = { error: 0, warn: 0, info: 0 };
  issues.forEach((i) => counts[i.severity]++);
  return { target, url, auditedAt: new Date().toISOString(), score: sc, counts, issues, viewports: results.map((r) => ({ viewport: r.viewport, size: r.size, meta: r.meta, screenshots: r.screenshots })) };
}

module.exports = { audit, VIEWPORTS };
