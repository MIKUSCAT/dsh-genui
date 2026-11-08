import { createRoot } from 'react-dom/client'
import { GenuiBlock } from '../../src/client/GenuiBlock.tsx'
import { GenuiActionContext } from '../../src/client/action-context.ts'
import { binarySearchExample, thresholdExample } from '../../src/client/interactive-examples.ts'
import { setLocale } from '../../src/client/i18n/runtime.ts'
import { createGenuiArtifact } from '../../src/client/artifact/create.ts'
import { parseGenuiArtifact } from '../../src/client/artifact/parse.ts'
import type { GenuiSpec, GenuiStepper } from '../../src/client/spec.ts'
import type { BlockInteractionState } from '../../src/client/interaction-store.ts'
import css from '../../src/client/GenuiBlock.module.css'

const params = new URLSearchParams(location.search)
const mode = params.get('mode') ?? 'stepper'
const app = document.getElementById('app')!
const dark = params.get('theme') === 'dark'
document.body.toggleAttribute('data-ds-dark-theme', dark)
if (params.has('width')) { document.documentElement.style.width = params.get('width') + 'px'; app.style.margin = '16px 0' }
setLocale('zh')
const settle = () => new Promise(resolve => setTimeout(resolve, 100))
const checks: Array<{ name: string; pass: boolean; actual: unknown }> = []
const check = (name: string, pass: boolean, actual: unknown) => checks.push({ name, pass, actual })
const buttons = (doc: ParentNode) => [...doc.querySelectorAll<HTMLButtonElement>('button')]
const click = (doc: ParentNode, label: string) => {
  const button = buttons(doc).find(item => item.textContent === label)
  if (!button) throw new Error('Missing button: ' + label)
  button.click()
}
function setInput(input: HTMLInputElement, value: string, view: Window & typeof globalThis = window) {
  Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, 'value')!.set!.call(input, value)
  input.dispatchEvent(new view.Event('input', { bubbles: true }))
}
async function ready(get: () => boolean) {
  for (let i = 0; i < 40; i++) { if (get()) return; await settle() }
  throw new Error('Fixture did not become ready')
}
let modelActions = 0
let state: BlockInteractionState | undefined
let root = createRoot(app)
const show = (spec: GenuiSpec, key?: string, initialState?: BlockInteractionState) => root.render(
  <GenuiActionContext.Provider value={() => { modelActions++ }}>
    <GenuiBlock spec={spec} stateKey={key} initialState={initialState} onStateSnapshot={value => { state = value }} />
  </GenuiActionContext.Provider>,
)
async function verifyStepper() {
  const source = binarySearchExample()
  const node = source.items[0] as GenuiStepper
  node.steps[0]!.items.push({ type: 'input', id: 'note', label: '推演笔记' })
  show(source, 'browser-lesson')
  await ready(() => !!app.querySelector('select'))
  const input = app.querySelector<HTMLInputElement>('input')!
  setInput(input, 'Retained note')
  await settle()
  click(app, '下一步')
  await settle()
  check('local next', app.querySelector('select')?.value === '1', app.querySelector('select')?.value)
  check('old stage hidden', !!input.closest('[hidden]'), !!input.closest('[hidden]'))
  click(app, '上一步')
  await settle()
  check('retained widget instance', app.querySelector('input') === input && input.value === 'Retained note', input.value)
  input.focus()
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  check('input arrow stays local', app.querySelector('select')?.value === '0', app.querySelector('select')?.value)
  const group = app.querySelector<HTMLElement>('[data-genui-stepper]')!
  group.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
  await settle()
  check('keyboard last stage', app.querySelector('select')?.value === '4', app.querySelector('select')?.value)
  check('end is bounded', buttons(app).find(button => button.textContent === '下一步')?.disabled === true, true)
  const artifact = parseGenuiArtifact(JSON.parse(JSON.stringify(createGenuiArtifact(source, state, { theme: dark ? 'dark' : 'light' }))))!
  root.unmount()
  root = createRoot(app)
  show(artifact.spec, undefined, artifact.state)
  await ready(() => !!app.querySelector('select'))
  check('export restores position', app.querySelector('select')?.value === '4', app.querySelector('select')?.value)
  const choice = app.querySelector('select')!
  choice.value = '0'
  choice.dispatchEvent(new Event('change', { bubbles: true }))
  await settle()
  check('export restores inputs', app.querySelector<HTMLInputElement>('input')?.value === 'Retained note', app.querySelector<HTMLInputElement>('input')?.value)
  check('navigation uses no model action', modelActions === 0, modelActions)
  show(binarySearchExample(), 'clean-preview')
  await settle()
}
async function verifyThreshold() {
  show(thresholdExample())
  await ready(() => !!app.querySelector('svg'))
  const inputs = app.querySelectorAll<HTMLInputElement>('input[type="range"]')
  const value = () => app.querySelector('.' + css.statValue)?.textContent
  const shape = () => [...app.querySelectorAll('svg path')].map(path => path.getAttribute('d')).join('|')
  check('initial conditional result', value() === '6', value())
  setInput(inputs[0]!, '8')
  await settle()
  check('saturation branch', value() === '10', value())
  const initialCurve = shape()
  setInput(inputs[1]!, '2')
  await settle()
  check('threshold recomputes', value() === '4', value())
  check('curve recomputes', shape() !== initialCurve, shape() !== initialCurve)
  setInput(inputs[0]!, '0')
  await settle()
  check('zero remains valid', value() === '0', value())
  check('calculation uses no model action', modelActions === 0, modelActions)
  setInput(inputs[0]!, '3')
  setInput(inputs[1]!, '5')
  await settle()
}
async function verifyOffline() {
  root.unmount()
  const frame = document.createElement('iframe')
  frame.title = '离线分步推演'
  frame.src = '/.e2e-artifacts/preview/stepper-resume.html'
  app.appendChild(frame)
  await ready(() => !!frame.contentDocument?.querySelector('[data-genui-stepper]'))
  const doc = frame.contentDocument!
  check('shipped bundle restores position', doc.querySelector('select')?.value === '2', doc.querySelector('select')?.value)
  click(doc, '下一步')
  await settle()
  check('shipped bundle navigates', doc.querySelector('select')?.value === '3', doc.querySelector('select')?.value)
  const choice = doc.querySelector('select')!
  choice.value = '0'
  choice.dispatchEvent(new frame.contentWindow!.Event('change', { bubbles: true }))
  await settle()
  check('shipped bundle restores inputs', doc.querySelector<HTMLInputElement>('input')?.value === 'Saved offline note', doc.querySelector<HTMLInputElement>('input')?.value)
}
async function verify() {
  if (mode === 'threshold') await verifyThreshold()
  else if (mode === 'offline') await verifyOffline()
  else await verifyStepper()
  check('page has no overflow', document.documentElement.scrollWidth <= innerWidth, document.documentElement.scrollWidth)
  const bounds = app.getBoundingClientRect()
  check('controls fit surface', [...app.querySelectorAll('input, select, button')].every(item => item.getBoundingClientRect().right <= bounds.right + 1), bounds.width)
  document.getElementById('results')!.textContent = JSON.stringify(checks)
}
void verify().catch(error => { document.getElementById('browser-errors')!.textContent = String(error) })
