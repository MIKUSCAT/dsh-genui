/** Build offline, interactive previews using the actual shipped renderer. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGenuiArtifact } from '../src/client/artifact/create.ts'
import { createStandaloneHtmlDocument } from '../src/client/artifact/html.ts'
import { processGenuiSpec, isRenderableProcess } from '../src/client/guard.ts'
import type { GenuiSpec, GenuiStepper } from '../src/client/spec.ts'
import type { BlockInteractionState } from '../src/client/interaction-store.ts'
import { binarySearchExample, thresholdExample } from '../src/client/interactive-examples.ts'
import { setLocale } from '../src/client/i18n/runtime.ts'
import { stepperStateKey } from '../src/client/stepper-state.ts'
import { analyzeGenuiPortability } from '../src/client/artifact/portability.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, '.e2e-artifacts', 'preview')
const spec = JSON.parse(readFileSync(join(root, 'tests/fixtures/personal-budget.json'), 'utf8')) as GenuiSpec
setLocale('zh')
mkdirSync(out, { recursive: true })
function writePreview(name: string, source: GenuiSpec, theme: 'light' | 'dark', state?: BlockInteractionState): void {
  const validation = processGenuiSpec(source)
  if (!isRenderableProcess(validation) || validation.errors.length) throw new Error(JSON.stringify(validation.errors))
  const names = ['standalone-runtime.js', ...analyzeGenuiPortability(source).requiredAssets.map(asset => asset + '.js')]
  const bundles = new Map(names.map(name => [name, new Uint8Array(readFileSync(join(root, 'lib/assets', name)))]))
  const artifact = createGenuiArtifact(source, state, { locale: 'zh', theme })
  writeFileSync(join(out, name + '.html'), createStandaloneHtmlDocument(artifact, bundles, 'https://github.com/MIKUSCAT/dsh-genui/'))
}
for (const theme of ['light', 'dark'] as const) {
  writePreview('genui-' + theme, spec, theme)
  writePreview('stepper-' + theme, binarySearchExample(), theme)
  writePreview('threshold-' + theme, thresholdExample(), theme)
}
// Synthetic export/restore fixture; not included in public release attachments.
const resume = binarySearchExample()
const lesson = resume.items[0] as GenuiStepper
lesson.steps[0]!.items.push({ type: 'input', id: 'note', label: '推演笔记' })
writePreview('stepper-resume', resume, 'light', {
  stepperSteps: { [stepperStateKey(lesson, 'items[0]')]: 2 }, fields: { note: 'Saved offline note' },
})
console.log('Offline previews written to ' + out)
