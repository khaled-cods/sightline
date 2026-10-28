/**
 * Runs INSIDE the page (serialised by Playwright). Must be fully self-contained.
 * Returns { issues: [...], meta: {...} }.
 */
module.exports = function inpage(opts) {
  const issues = [];
  const vw = (opts && opts.vw) || window.innerWidth;
  const isMobile = vw <= 820;
  const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
  const HEBREW = /[֐-׿]/;

  /* ---------- helpers ---------- */
  const cssPath = (el) => {
    if (!el || el.nodeType !== 1) return '';
    if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) return '#' + el.id;
    const parts = [];
    let cur = el;
    for (let depth = 0; cur && cur.nodeType === 1 && depth < 4; depth++) {
      let part = cur.tagName.toLowerCase();
      if (cur.id && /^[A-Za-z][\w-]*$/.test(cur.id)) { parts.unshift('#' + cur.id); break; }
      const cls = [...cur.classList].filter((c) => /^[A-Za-z_][\w-]*$/.test(c)).slice(0, 2);
      if (cls.length) part += '.' + cls.join('.');
      else if (cur.parentElement) {
        const sibs = [...cur.parentElement.children].filter((s) => s.tagName === cur.tagName);
        if (sibs.length > 1) part += ':nth-of-type(' + (sibs.indexOf(cur) + 1) + ')';
      }
      parts.unshift(part);
      if (cur === document.body) break;
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  };
  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + window.scrollX), y: Math.round(r.top + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
    if (parseFloat(s.opacity) === 0) return false;
    for (let a = el.parentElement; a; a = a.parentElement) { if (parseFloat(getComputedStyle(a).opacity) === 0) return false; }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const snippet = (el) => {
    const t = (el.innerText || el.getAttribute('alt') || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
    return t.length > 40 ? t.slice(0, 40) + '…' : t;
  };
  const add = (rule, severity, el, message, fix, extra) => {
    issues.push(Object.assign({
      rule, severity, message, fix,
      selector: el ? cssPath(el) : '',
      text: el ? snippet(el) : '',
      rect: el ? rectOf(el) : null,
    }, extra || {}));
  };

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const parseColor = (c) => {
    if (!c || c === 'transparent') return [0, 0, 0, 0];
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const blend = (top, bottom) => {
    const a = top[3] + bottom[3] * (1 - top[3]);
    if (a === 0) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a).concat(a);
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

  // effective background of an element; returns null when it can't be known (image/gradient)
  const bgOf = (el) => {
    let layers = [];
    let cur = el;
    while (cur && cur.nodeType === 1) {
      const s = getComputedStyle(cur);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null;
      const c = parseColor(s.backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] >= 0.999) break; }
      cur = cur.parentElement;
    }
    let out = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) out = blend(layers[i], out);
    return out;
  };
  const opacityOf = (el) => {
    let o = 1, cur = el;
    while (cur && cur.nodeType === 1) { o *= parseFloat(getComputedStyle(cur).opacity); cur = cur.parentElement; }
    return o;
  };

  const all = [...document.body.querySelectorAll('*')].filter((e) => !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'META', 'LINK', 'HEAD'].includes(e.tagName)).slice(0, 4000);
  const textEls = all.filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0) && visible(el));

  /* ---------- document level ---------- */
  const html = document.documentElement;
  if (!html.getAttribute('lang')) issues.push({ rule: 'doc-lang', severity: 'error', message: '<html> has no lang attribute (screen readers and translators guess the language).', fix: 'Add lang="en" (or lang="ar" dir="rtl") to <html>.', selector: 'html', text: '', rect: null });
  if (!document.title.trim()) issues.push({ rule: 'doc-title', severity: 'error', message: 'Page has no <title>.', fix: 'Add a short, descriptive <title>.', selector: 'head', text: '', rect: null });
  if (!document.querySelector('meta[name=viewport]')) issues.push({ rule: 'viewport-meta', severity: 'error', message: 'Missing <meta name="viewport">: the page will render as a zoomed-out desktop page on phones.', fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.', selector: 'head', text: '', rect: null });

  /* ---------- horizontal overflow ---------- */
  const docW = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
  if (docW > vw + 1) {
    const culprits = all.filter((el) => { if (!visible(el)) return false; const r = el.getBoundingClientRect(); return r.right > vw + 1 || r.left < -1; })
      .filter((el) => { const p = el.parentElement; if (!p) return true; const pr = p.getBoundingClientRect(); const pr2 = (pr.right > vw + 1 || pr.left < -1); return !pr2 || p === document.body; }).slice(0, 4);
    add('overflow-x', 'error', culprits[0] || document.body, 'Page scrolls sideways: content is ' + (docW - vw) + 'px wider than the ' + vw + 'px viewport.' + (culprits.length ? ' Widest offenders: ' + culprits.map(cssPath).join(', ') : ''), 'Constrain the offending elements (max-width:100%, min-width:0 on flex/grid children, overflow-wrap:anywhere) instead of hiding overflow on <body>.');
  }

  /* ---------- images ---------- */
  document.querySelectorAll('img').forEach((img) => {
    if (!visible(img)) return;
    if (!img.hasAttribute('alt')) add('img-alt', 'error', img, 'Image has no alt attribute.', 'Add a meaningful alt, or alt="" if it is purely decorative.');
    if (!img.naturalWidth || !img.naturalHeight || !img.complete) {
      if (img.complete) add('img-broken', 'error', img, 'Image failed to load.', 'Fix the src path or remove the element.');
      return;
    }
    const r = img.getBoundingClientRect(), s = getComputedStyle(img);
    const nat = img.naturalWidth / img.naturalHeight, ren = r.width / r.height;
    const fit = s.objectFit;
    if ((fit === 'fill' || fit === '') && Math.abs(ren / nat - 1) > 0.05 && r.width > 24 && r.height > 24) {
      add('image-distortion', 'error', img, 'Image is stretched: natural ratio ' + nat.toFixed(2) + ':1 but drawn at ' + ren.toFixed(2) + ':1 (' + Math.round(Math.abs(ren / nat - 1) * 100) + '% off).', 'Use object-fit:cover (or contain) with a fixed aspect-ratio, or set only width and let height be auto.');
    } else if (fit === 'cover' && r.width > 40 && r.height > 40) {
      const scale = Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight);
      const shown = (r.width * r.height) / (img.naturalWidth * scale * img.naturalHeight * scale);
      if (shown < 0.6) add('image-crop', 'warn', img, 'Image is heavily cropped by object-fit:cover: only ' + Math.round(shown * 100) + '% of the photo is visible.', 'Match the box aspect-ratio to the photos (e.g. aspect-ratio:4/3), use object-fit:contain with a blurred backdrop, or set object-position to keep the subject in frame.');
    }
    if (img.naturalWidth > r.width * 3 && img.naturalWidth > 1600) add('image-oversized', 'info', img, 'Image is ' + img.naturalWidth + 'px wide but displayed at ' + Math.round(r.width) + 'px (wasted bytes).', 'Serve a smaller file or use srcset.');
  });

  /* ---------- accessible names ---------- */
  const accName = (el) => {
    const t = (el.innerText || el.textContent || '').trim();
    if (t) return t;
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    if (el.getAttribute('aria-labelledby')) { const l = document.getElementById(el.getAttribute('aria-labelledby')); if (l && l.textContent.trim()) return l.textContent.trim(); }
    if (el.getAttribute('title')) return el.getAttribute('title');
    const im = el.querySelector('img[alt]:not([alt=""])'); if (im) return im.alt;
    const svgT = el.querySelector('svg title'); if (svgT) return svgT.textContent;
    if (el.value && (el.tagName === 'INPUT')) return el.value;
    return '';
  };
  document.querySelectorAll('button, a[href], [role=button]').forEach((el) => {
    if (!visible(el)) return;
    if (!accName(el)) add('button-name', 'error', el, (el.tagName === 'A' ? 'Link' : 'Button') + ' has no accessible name (icon-only with no label).', 'Add aria-label="…" (or visible text) describing what it does.');
  });
  document.querySelectorAll('input, select, textarea').forEach((el) => {
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(el.type) || !visible(el)) return;
    const id = el.id, has = (id && document.querySelector('label[for="' + CSS.escape(id) + '"]')) || el.closest('label') || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title');
    if (!has) add('input-label', 'error', el, 'Form field has no label (placeholder alone is not a label).', 'Add <label for="…"> or aria-label.');
  });

  /* ---------- headings ---------- */
  const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible);
  const h1s = hs.filter((h) => h.tagName === 'H1');
  if (h1s.length > 1) add('heading-order', 'warn', h1s[1], 'Page has ' + h1s.length + ' <h1> elements.', 'Use a single <h1> per page; demote the rest to <h2>.');
  if (hs.length && !h1s.length) add('heading-order', 'warn', hs[0], 'Page has headings but no <h1>.', 'Make the main page title an <h1>.');
  let prev = 0;
  for (const h of hs) { const l = +h.tagName[1]; if (prev && l > prev + 1) { add('heading-order', 'warn', h, 'Heading level jumps from h' + prev + ' to h' + l + '.', 'Do not skip heading levels.'); break; } prev = l; }

  /* ---------- tap targets (mobile only) ---------- */
  if (isMobile) {
    document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [tabindex]:not([tabindex="-1"])').forEach((el) => {
      if (!visible(el) || el.disabled) return;
      const s = getComputedStyle(el);
      const inline = el.tagName === 'A' && s.display === 'inline' && el.parentElement && /^(P|LI|SPAN|TD|DIV|LABEL|SMALL)$/.test(el.parentElement.tagName) && (el.parentElement.textContent.trim().length > el.textContent.trim().length + 12);
      if (inline) return;
      if (el.type === 'checkbox' || el.type === 'radio') { const lab = el.closest('label') || (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')); if (lab) return; }
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) add('tap-target', 'error', el, 'Touch target is only ' + Math.round(r.width) + '×' + Math.round(r.height) + 'px (WCAG 2.2 minimum is 24×24).', 'Give it at least 44×44px (min-height/min-width or padding).');
      else if (r.width < 44 || r.height < 40) add('tap-target', 'warn', el, 'Touch target is ' + Math.round(r.width) + '×' + Math.round(r.height) + 'px; 44×44 is the comfortable size on phones.', 'Add padding or min-height:44px.');
    });
  }

  /* ---------- contrast, font size, clipped text ---------- */
  const fams = new Map();
  let smallCount = 0, smallFirst = null;
  const seenContrast = new Set();
  for (const el of textEls) {
    const s = getComputedStyle(el);
    const size = parseFloat(s.fontSize), weight = parseInt(s.fontWeight, 10) || 400;
    const first = s.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    if (first && !/icon|awesome|symbol|material|emoji/i.test(first)) fams.set(first, (fams.get(first) || 0) + 1);
    if (size < 12 && el.textContent.trim().length > 3) { smallCount++; smallFirst = smallFirst || el; }

    // contrast
    if (!el.disabled && !el.closest('[disabled]')) {
      const bg = bgOf(el);
      if (bg) {
        const op = opacityOf(el);
        if (op < 0.6) continue; // mid-animation / not yet revealed: not a real reading
        let fg = parseColor(s.color); fg = [fg[0], fg[1], fg[2], fg[3] * op];
        const eff = blend(fg, bg);
        const r = ratio(eff, bg);
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        const need = large ? 3 : 4.5;
        if (r < need - 0.01) {
          const key = hex(eff) + hex(bg) + size;
          if (!seenContrast.has(key)) {
            seenContrast.add(key);
            add('contrast', r < 3 ? 'error' : 'warn', el, 'Low contrast ' + r.toFixed(2) + ':1 (needs ' + need + ':1): text ' + hex(eff) + ' on ' + hex(bg) + '.', 'Darken the text or lighten the background until the ratio is ≥ ' + need + ':1.', { ratio: +r.toFixed(2) });
          }
        }
      }
    }
    // clipped
    if ((s.overflow === 'hidden' || s.overflowX === 'hidden' || s.overflowX === 'clip') && s.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 3 && el.clientWidth > 0 && s.whiteSpace !== 'normal' && s.display !== 'inline') {
      add('text-clipped', 'warn', el, 'Text is cut off (content is ' + (el.scrollWidth - el.clientWidth) + 'px wider than its box) with no ellipsis.', 'Allow wrapping, widen the box, or add text-overflow:ellipsis.');
    }
  }
  if (smallCount) add('font-size-small', 'warn', smallFirst, smallCount + ' text element(s) are smaller than 12px (hard to read on phones).', 'Use at least 14px for body text and 12px for captions.');
  const famList = [...fams.entries()].sort((a, b) => b[1] - a[1]);
  if (famList.length > 3) add('font-families', 'warn', null, famList.length + ' different font families in use (' + famList.slice(0, 6).map((x) => x[0]).join(', ') + ').', 'Stick to 1–2 families; vary weight and size for hierarchy.');

  /* ---------- line length ---------- */
  for (const el of textEls) {
    if (!/^(P|LI|BLOCKQUOTE|DD)$/.test(el.tagName)) continue;
    const t = el.textContent.trim(); if (t.length < 220) continue;
    const s = getComputedStyle(el), size = parseFloat(s.fontSize), w = el.getBoundingClientRect().width;
    const cpl = w / (size * 0.5);
    if (cpl > 100 && !ARABIC.test(t)) { add('line-length', 'info', el, 'Line length is about ' + Math.round(cpl) + ' characters (comfortable is 45–80).', 'Cap paragraph width with max-width:65ch.'); break; }
  }

  /* ---------- RTL pack ---------- */
  const bodyText = textEls.map((e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ')).join(' ');
  const letters = bodyText.replace(/[^\p{L}]/gu, '');
  const rtlLetters = (bodyText.match(/[֐-ࣿיִ-﷿ﹰ-﻿]/g) || []).length;
  const rtlShare = letters.length ? Math.min(1, rtlLetters / letters.length) : 0;
  const dirRtl = getComputedStyle(html).direction === 'rtl' || getComputedStyle(document.body).direction === 'rtl';
  const meta = { viewport: vw, textElements: textEls.length, rtlShare: +rtlShare.toFixed(2), dirRtl, fonts: famList.slice(0, 6) };

  if (rtlShare > 0.3 && !dirRtl) issues.push({ rule: 'rtl-dir-missing', severity: 'error', message: Math.round(rtlShare * 100) + '% of the text is Arabic/Hebrew but the page direction is LTR (punctuation, lists and layout will be mirrored wrongly).', fix: 'Add dir="rtl" (and lang="ar") to <html>.', selector: 'html', text: '', rect: null });

  if (rtlShare > 0.1 || dirRtl) {
    const LATIN_ONLY = /^(inter|poppins|roboto|montserrat|open sans|lato|playfair display|raleway|nunito|dm sans|manrope|space grotesk|work sans|oswald|helvetica neue|sf pro|-apple-system|system-ui|ui-sans-serif|georgia)$/i;
    const AR_FONT = /(cairo|tajawal|almarai|noto (sans|kufi|naskh) arabic|ibm plex sans arabic|amiri|changa|el messiri|harmattan|readex|rubik|lalezar|mada|markazi|scheherazade|segoe ui|tahoma|arial|dubai|sakkal)/i;
    let ls = 0, lsEl = null, fa = 0, faEl = null, ta = 0, taEl = null, gl = 0, glEl = null;
    for (const el of textEls) {
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ');
      const isAr = ARABIC.test(own) || HEBREW.test(own);
      const s = getComputedStyle(el);
      if (isAr) {
        if (s.letterSpacing !== 'normal' && parseFloat(s.letterSpacing) !== 0 && !isNaN(parseFloat(s.letterSpacing))) { ls++; lsEl = lsEl || el; }
        const stack = s.fontFamily, first = stack.split(',')[0].replace(/["']/g, '').trim();
        if (LATIN_ONLY.test(first) && !AR_FONT.test(stack)) { fa++; faEl = faEl || el; }
      }
      if (s.direction === 'rtl' && s.textAlign === 'left' && own.trim().length > 12) { ta++; taEl = taEl || el; }
      if ((dirRtl || rtlShare > 0.3) && /[→»›▶➜➔⟶]/.test(own) && own.trim().length < 40) { gl++; glEl = glEl || el; }
    }
    if (ls) add('rtl-letter-spacing', 'error', lsEl, ls + ' Arabic text element(s) use letter-spacing, which breaks Arabic letter joining.', 'Set letter-spacing:0 (or normal) on Arabic text; tracking is for Latin uppercase only.');
    if (fa) add('rtl-arabic-font', 'warn', faEl, fa + ' Arabic text element(s) use a Latin-only font (browser silently falls back to a different system font, so headings and body look mismatched).', 'Pair your Latin font with an Arabic one: Cairo, Tajawal, Almarai, IBM Plex Sans Arabic or Noto Sans Arabic.');
    if (ta) add('rtl-text-align', 'warn', taEl, ta + ' RTL text block(s) are forced to text-align:left.', 'Use text-align:start (or end) so it follows the writing direction.');
    if (gl) add('rtl-direction-glyph', 'warn', glEl, gl + ' button/link label(s) contain a right-pointing glyph (→ » › ▶) on an RTL page, where "forward" should point left.', 'Use ← / ‹ for "next" in RTL, or an SVG icon with transform:scaleX(-1) under [dir=rtl].');
  }
  // physical CSS properties (parsed from rule text so shorthand expansion is not counted)
  if (rtlShare > 0.1 || dirRtl) {
    const RX = /(?:^|[;{\s])((?:margin|padding)-(?:left|right)|border-(?:left|right)(?:-(?:width|style|color))?|border-(?:top|bottom)-(?:left|right)-radius|left|right|float\s*:\s*(?:left|right)|text-align\s*:\s*(?:left|right))\s*(?::|(?=;|$))/g;
    let phys = 0; const ex = [];
    const walk = (rules) => { for (const r of rules) { if (r.cssRules && !r.style) { try { walk(r.cssRules); } catch (e) { } } if (r.style && r.cssText) { const body = r.cssText.slice(r.cssText.indexOf('{') + 1); let m; RX.lastIndex = 0; while ((m = RX.exec(body))) { phys++; if (ex.length < 3) ex.push(m[1].replace(/\s+/g, '')); } } } };
    for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch (e) { } }
    if (phys >= 4) issues.push({ rule: 'rtl-physical-css', severity: 'warn', message: phys + ' physical left/right CSS declarations found (e.g. ' + ex.join(', ') + '); they do not flip in RTL.', fix: 'Prefer logical properties: margin-inline-start, padding-inline-end, inset-inline-start, text-align:start, border-start-start-radius.', selector: 'stylesheet', text: '', rect: null });
  }

  /* ---------- focus outline removed ---------- */
  {
    let bad = 0, hasFocusVisible = false;
    const walk = (rules) => { for (const r of rules) { if (r.cssRules && !r.style) { try { walk(r.cssRules); } catch (e) { } } if (r.selectorText) { if (/:focus-visible/.test(r.selectorText) && r.style && (r.style.outline || r.style.boxShadow || r.style.outlineWidth)) hasFocusVisible = true; if (/:focus(?!-visible)/.test(r.selectorText) && r.style && /^(none|0)/.test((r.style.outline || '').trim()) && !r.style.boxShadow && !r.style.borderColor) bad++; if (/^(\*|button|a|input)$/.test(r.selectorText.trim()) && r.style && /^(none|0)/.test((r.style.outline || '').trim())) bad++; } } };
    for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch (e) { } }
    if (bad && !hasFocusVisible) issues.push({ rule: 'focus-outline-removed', severity: 'warn', message: 'Focus outlines are removed (' + bad + ' rule(s)) with no :focus-visible replacement; keyboard users cannot see where they are.', fix: 'Add :focus-visible { outline: 3px solid …; outline-offset: 2px } for buttons, links and inputs.', selector: 'stylesheet', text: '', rect: null });
  }

  return { issues, meta };
};
