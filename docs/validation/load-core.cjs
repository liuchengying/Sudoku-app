const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename })
  module._compile(result.outputText, filename)
}
module.exports = require(path.resolve(__dirname, '../../src/core/sudoku/index.ts'))
