/**
 * Rasterise the icon artwork (scripts/icon-art.mjs) into assets/ with headless
 * Chromium. Needs Playwright with a Chromium build available:
 *   npx playwright install chromium   (once)
 *   node scripts/render-icons.mjs
 * Also writes the SVG sources to assets/icon-src/ for design tools.
 */
import { createRequire } from 'node:module'
import { writeFileSync, mkdirSync } from 'node:fs'
import { iconSvg, adaptiveSvg, monochromeSvg, splashSvg, faviconSvg } from './icon-art.mjs'

const { chromium } = createRequire(import.meta.url)('playwright')

const OUT = new URL('../assets/', import.meta.url).pathname
const JOBS = [
  { file: 'icon.png',            svg: iconSvg(),       size: 1024, transparent: false },
  { file: 'adaptive-icon.png',   svg: adaptiveSvg(),   size: 1024, transparent: true  },
  { file: 'monochrome-icon.png', svg: monochromeSvg(), size: 1024, transparent: true  },
  { file: 'splash-icon.png',     svg: splashSvg(),     size: 1024, transparent: true  },
  { file: 'favicon.png',         svg: faviconSvg(),    size: 48,   transparent: false },
]

mkdirSync(OUT + 'icon-src', { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const j of JOBS) {
  writeFileSync(OUT + 'icon-src/' + j.file.replace('.png', '.svg'), j.svg)
  await page.setViewportSize({ width: j.size, height: j.size })
  await page.setContent(`<html><body style="margin:0;background:transparent">${j.svg}</body></html>`)
  await page.locator('svg').screenshot({ path: OUT + j.file, omitBackground: j.transparent })
  console.log('wrote', j.file)
}
await browser.close()
