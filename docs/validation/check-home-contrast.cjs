const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '../..')
const home = fs.readFileSync(path.join(root, 'src/pages/home/index.vue'), 'utf8')
const globalStyles = fs.readFileSync(path.join(root, 'src/styles.scss'), 'utf8')

function variables(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const body = source.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1]
  if (!body) throw new Error(`Missing style: ${selector}`)
  return Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*(#[\da-f]{6})\s*;/gi)].map(match => [match[1], match[2]]))
}
function luminance(hex) {
  const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}
function contrast(foreground, background) {
  const a = luminance(foreground), b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
const light = { ...variables(globalStyles, 'page'), ...variables(home, '.home-page') }
const dark = { ...light, ...variables(globalStyles, '.theme-dark'), ...variables(home, '.home-page.theme-dark') }
const checks = []
for (const [theme, colors] of Object.entries({ light, dark })) {
  // Both ends of the menu gradient, using actual source colors in normal state.
  for (const foreground of ['--menu-ink', '--menu-muted', '--menu-nav-icon', '--menu-daily-tag', '--menu-completed']) {
    for (const background of ['--page-bg', '--primary-soft']) {
      checks.push({ theme, foreground, background, textColor: colors[foreground], backgroundColor: colors[background], ratio: contrast(colors[foreground], colors[background]) })
    }
  }
  for (const background of ['--menu-daily-icon', '--menu-practice-icon']) {
    checks.push({ theme, foreground: '--menu-icon-text', background, textColor: colors['--menu-icon-text'], backgroundColor: colors[background], ratio: contrast(colors['--menu-icon-text'], colors[background]) })
  }
}
const failed = checks.filter(check => check.ratio < 4.5)
const report = { scope: 'Home lower-menu source colors, normal state; gradient endpoints and filled mode icons', threshold: 4.5, minimumRatio: Math.min(...checks.map(check => check.ratio)), passed: failed.length === 0, checks: checks.map(check => ({ ...check, ratio: Number(check.ratio.toFixed(2)) })) }
const resultPath = path.join(__dirname, 'results/home-contrast.json')
fs.mkdirSync(path.dirname(resultPath), { recursive: true })
fs.writeFileSync(resultPath, JSON.stringify(report, null, 2) + '\n')
if (failed.length) throw new Error(`Low contrast: ${failed.map(check => `${check.theme} ${check.foreground}/${check.background}=${check.ratio.toFixed(2)}`).join(', ')}`)
console.log(`OK: ${checks.length} home-menu color combinations; minimum contrast ${report.minimumRatio.toFixed(2)}:1`)
