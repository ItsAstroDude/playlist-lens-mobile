/**
 * Rasterise the icon artwork (scripts/icon-art.mjs) into assets/ with headless
 * Chromium. Needs Playwright with a Chromium build available:
 *   npx playwright install chromium   (once)
 *   node scripts/render-icons.mjs
 * Also writes the SVG sources to assets/icon-src/ for design tools.
 */
import { createRequire } from 'node:module'
import { writeFileSync, mkdirSync } from 'node:fs'
import { iconSvg, adaptiveSvg, monochromeSvg, splashSvg, faviconSvg, previewSvg, ICON_VARIANTS } from './icon-art.mjs'

const { chromium } = createRequire(import.meta.url)('playwright')

const OUT = new URL('../assets/', import.meta.url).pathname
const JOBS = [
  { file: 'icon.png',            svg: iconSvg(),       size: 1024, transparent: false },
  { file: 'adaptive-icon.png',   svg: adaptiveSvg(),   size: 1024, transparent: true  },
  { file: 'monochrome-icon.png', svg: monochromeSvg(), size: 1024, transparent: true  },
  { file: 'splash-icon.png',     svg: splashSvg(),     size: 1024, transparent: true  },
  { file: 'favicon.png',         svg: faviconSvg(),    size: 48,   transparent: false },
  // 2.0 icon picker: an adaptive foreground per alternate colourway + a small preview
  // of every colourway for the in-app picker.
  ...ICON_VARIANTS.filter(v => v.name !== 'Default').map(v => (
    { file: `icons/${v.name.toLowerCase()}-foreground.png`, svg: adaptiveSvg(v.hex), size: 1024, transparent: true })),
  ...ICON_VARIANTS.map(v => (
    { file: `icons/${v.name.toLowerCase()}-preview.png`, svg: previewSvg(v.hex), size: 1024, out: 192, transparent: false })),
]

mkdirSync(OUT + 'icon-src/icons', { recursive: true })
mkdirSync(OUT + 'icons', { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const j of JOBS) {
  writeFileSync(OUT + 'icon-src/' + j.file.replace('.png', '.svg'), j.svg)
  // `out` renders smaller than the artwork's own size (the SVG scales; viewBox kept).
  const px = j.out ?? j.size
  const svg = j.out ? j.svg.replace(`width="${j.size}" height="${j.size}"`, `width="${px}" height="${px}"`) : j.svg
  await page.setViewportSize({ width: px, height: px })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`)
  await page.locator('svg').screenshot({ path: OUT + j.file, omitBackground: j.transparent })
  console.log('wrote', j.file)
}
await browser.close()
