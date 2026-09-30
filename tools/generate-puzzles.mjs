// Keep the existing command entry point; use the same Core as runtime generation.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
require('../docs/validation/generate-bank.cjs')
