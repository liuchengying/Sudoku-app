// Keep the existing command entry point; use the same Core as runtime generation.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
require(process.argv.includes('--campaign-v2') ? '../docs/validation/generate-campaign-bank.cjs' : '../docs/validation/generate-bank.cjs')
