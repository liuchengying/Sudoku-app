const fs = require('node:fs')
const path = require('node:path')
const { parse, compileScript, compileTemplate, compileStyle } = require('vue/compiler-sfc')
const root = path.resolve(__dirname, '../..')
function vueFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? vueFiles(path.join(dir, entry.name)) : entry.name.endsWith('.vue') ? [path.join(dir, entry.name)] : [])
}
const files = vueFiles(path.join(root, 'src'))
for (const filename of files) {
  const source = fs.readFileSync(filename, 'utf8')
  const { descriptor, errors } = parse(source, { filename })
  if (errors.length) throw new Error(`${filename}: ${errors}`)
  const script = descriptor.scriptSetup ? compileScript(descriptor, { id: filename }) : null
  if (descriptor.template) {
    const result = compileTemplate({ filename, id: filename, source: descriptor.template.content, compilerOptions: { bindingMetadata: script?.bindings, expressionPlugins: ['typescript'], isCustomElement: tag => ['view', 'text', 'button', 'switch', 'textarea', 'slider', 'scroll-view', 'swiper', 'swiper-item'].includes(tag) } })
    if (result.errors.length) throw new Error(`${filename}: ${result.errors}`)
  }
  for (const style of descriptor.styles) {
    const result = compileStyle({ filename, id: filename, source: style.content, scoped: style.scoped, preprocessLang: style.lang === 'scss' ? 'scss' : undefined })
    if (result.errors.length) throw new Error(`${filename}: ${result.errors}`)
  }
}
const pages = JSON.parse(fs.readFileSync(path.join(root, 'src/pages.json'), 'utf8')).pages
for (const page of pages) if (!fs.existsSync(path.join(root, 'src', `${page.path}.vue`))) throw new Error(`Missing page: ${page.path}`)
const sample = path.join(root, 'docs/generated/pipeline-smoke.json')
if (fs.existsSync(sample)) {
  const core = require('./load-core.cjs')
  const bank = JSON.parse(fs.readFileSync(sample, 'utf8'))
  for (const levels of Object.values(bank)) for (const level of levels) {
    const board = core.parseBoard(level.puzzle), rating = core.rateDifficulty(board)
    if (core.countSolutions(board, 2) !== 1 || core.serializeBoard(core.solve(board)) !== level.solution || rating.score !== level.difficultyScore || JSON.stringify(rating.techniques) !== JSON.stringify(level.techniques)) throw new Error('Generated sample validation failed')
  }
}
console.log(`OK: ${files.length} Vue SFCs compiled in memory; ${pages.length} page routes resolved`)
