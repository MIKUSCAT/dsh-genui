/** Build offline, interactive previews using the actual shipped renderer. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGenuiArtifact } from '../src/client/artifact/create.ts'
import { createStandaloneHtmlDocument } from '../src/client/artifact/html.ts'
import { processGenuiSpec, isRenderableProcess } from '../src/client/guard.ts'
import type { GenuiSpec } from '../src/client/spec.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, '.e2e-artifacts', 'preview')
const spec = JSON.parse(readFileSync(join(root, 'tests/fixtures/personal-budget.json'), 'utf8')) as GenuiSpec
const validation = processGenuiSpec(spec)
if (!isRenderableProcess(validation) || validation.errors.length) throw new Error(JSON.stringify(validation.errors))
const bundles = new Map([['standalone-runtime.js', new Uint8Array(readFileSync(join(root, 'lib/assets/standalone-runtime.js')))]])
mkdirSync(out, { recursive: true })
for (const theme of ['light', 'dark'] as const) {
  const artifact = createGenuiArtifact(spec, undefined, { locale: 'zh', theme })
  writeFileSync(join(out, 'genui-' + theme + '.html'), createStandaloneHtmlDocument(artifact, bundles, 'https://github.com/MIKUSCAT/dsh-genui/'))
}
console.log('Offline previews written to ' + out)
