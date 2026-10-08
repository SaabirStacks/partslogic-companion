// Renders the app icon, Android adaptive icon layers, splash mark and favicon from HTML, in the
// safety-sign look: a white "PL" in Barlow Condensed ExtraBold with the yellow scan line, on the
// mandatory blue (#154889). Every raster in assets/images comes from here, so they can be remade.
//
// Needs Playwright with Chromium (not a project dependency). Run:
//   NODE_PATH=<folder holding playwright> node scripts/render-brand-art.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = fileURLToPath(new URL('..', import.meta.url));
const font = readFileSync(`${root}node_modules/@expo-google-fonts/barlow-condensed/800ExtraBold/BarlowCondensed_800ExtraBold.ttf`).toString('base64');

const BLUE = '#154889';
const EDGE = '#0C2F5C';
const YELLOW = '#F9A800';

// The mark at a given scale (1 = drawn for a 1024 canvas): PL with the scan line under it.
const mark = (scale, colour = '#fff', line = YELLOW) => `
  <div style="display:flex;flex-direction:column;align-items:center;gap:${36 * scale}px">
    <div style="font:800 ${470 * scale}px/0.8 Barlow;color:${colour};letter-spacing:${-6 * scale}px;padding-top:${40 * scale}px">PL</div>
    <div style="width:${430 * scale}px;height:${40 * scale}px;border-radius:${20 * scale}px;background:${line}"></div>
  </div>`;

const page = (size, background, body) => `<!doctype html><html><head><style>
  @font-face { font-family: Barlow; src: url(data:font/ttf;base64,${font}); font-weight: 800; }
  html, body { margin: 0; width: ${size}px; height: ${size}px; background: ${background}; }
  body { display: flex; align-items: center; justify-content: center; }
</style></head><body>${body}</body></html>`;

const ART = [
  // iOS and the store: full bleed, no transparency.
  { file: 'icon.png', size: 1024, html: page(1024, BLUE, mark(1)), transparent: false },
  { file: 'favicon.png', size: 48, html: page(48, BLUE, mark(48 / 1024)), transparent: false },
  // Android adaptive icon: the mark sits inside the 66% safe zone so any mask shape keeps it whole.
  { file: 'android-icon-background.png', size: 1024, html: page(1024, BLUE, ''), transparent: false },
  { file: 'android-icon-foreground.png', size: 1024, html: page(1024, 'transparent', mark(0.62)), transparent: true },
  { file: 'android-icon-monochrome.png', size: 1024, html: page(1024, 'transparent', mark(0.62, '#fff', '#fff')), transparent: true },
  // The splash: the mark on a blue sign plate with its darker edge, shown on the app's ground colour.
  {
    file: 'splash-icon.png',
    size: 1024,
    transparent: true,
    html: page(
      1024,
      'transparent',
      `<div style="width:880px;height:880px;box-sizing:border-box;border:28px solid ${EDGE};border-radius:60px;background:${BLUE};display:flex;align-items:center;justify-content:center">${mark(0.82)}</div>`,
    ),
  },
];

const browser = await chromium.launch();
for (const art of ART) {
  const tab = await browser.newPage({ viewport: { width: art.size, height: art.size } });
  await tab.setContent(art.html);
  await tab.evaluate(() => document.fonts.ready);
  await tab.screenshot({ path: `${root}assets/images/${art.file}`, omitBackground: art.transparent });
  await tab.close();
  console.log(art.file);
}
await browser.close();
