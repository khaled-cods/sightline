---
name: sightline
description: Use after building or changing any web UI (HTML/CSS/React/Vue/etc.) to actually look at it. Renders the page in a real browser at phone and desktop sizes, finds visual and accessibility defects (contrast, overflow, cropped or stretched images, tiny tap targets, missing labels, Arabic/RTL bugs), and returns annotated screenshots plus a ranked fix list.
---

# Sightline: see the UI you just built

You write UI blind. Sightline gives you eyes. Run it **before** telling the user a UI task is done.

## Workflow

1. Make sure the page can be opened: a local file (`index.html`), or a dev server URL (`http://localhost:3000`).
2. Run the audit:
   ```bash
   npx sightline <file-or-url> --out .sightline
   ```
   Add `--viewports mobile,tablet,desktop` for more sizes, `--dark` for dark mode.
3. Read the Markdown fix list printed to stdout. Each item has `rule`, `where` (CSS selector), and a concrete `fix`.
4. Look at `.sightline/mobile.annotated.png` and `desktop.annotated.png` (use your image-reading tool). Numbered boxes match the fix list.
5. Fix every 🔴 error, then 🟠 warnings that are real. Re-run until the score is ≥ 90 and no 🔴 remain.
6. Tell the user the final score and what you fixed. Do not claim a UI is "polished" without a passing run.

## Rules it checks

Layout: horizontal overflow, clipped text, stretched/over-cropped images, tap targets under 44px (phone only), line length.
Accessibility: WCAG contrast (AA), missing alt / labels / button names, heading order, `lang`, viewport meta, removed focus outlines.
Typography: tiny text, too many font families.
**Arabic / RTL**: missing `dir="rtl"`, letter-spacing on Arabic (breaks joining), Latin-only fonts used for Arabic, physical left/right CSS, forced `text-align:left`, wrong-direction arrow glyphs.

## Notes

- Exit code is 1 when `--fail-under N` is set and the score is below N (use in CI).
- Findings are heuristics: verify against the screenshot before making large changes. Contrast on gradients or images is skipped rather than guessed.
- Needs Node 18+ and Playwright's Chromium (`npx playwright install chromium`).
