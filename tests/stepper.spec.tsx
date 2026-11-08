import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GenuiBlock } from '../src/client/GenuiBlock.tsx'
import { GenuiActionContext } from '../src/client/action-context.ts'
import { setLocale } from '../src/client/i18n/runtime.ts'
import { countGenuiNodes, isRenderableProcess, processGenuiSpec } from '../src/client/guard.ts'
import { GENUI_LIMITS } from '../src/client/genui-runtime/limits.ts'
import { createGenuiArtifact } from '../src/client/artifact/create.ts'
import { parseGenuiArtifact } from '../src/client/artifact/parse.ts'
import { analyzeGenuiPortability } from '../src/client/artifact/portability.ts'
import { normalizeStepperState, stepperStateKey } from '../src/client/stepper-state.ts'
import { compileDshGo } from '../src/plugin/dsh-go-compiler.ts'
import { emptyNativeState } from '../src/plugin/dsh-go-types.ts'
import type { GenuiSpec, GenuiStepper } from '../src/client/spec.ts'

const stepper = (): GenuiStepper => ({
  type: 'stepper', id: 'lesson', steps: [
    { title: 'Start', items: [{ type: 'input', id: 'note', label: 'Note', value: '' }] },
    { title: 'Work', items: [{ type: 'text', content: 'Intermediate result' }] },
    { title: 'Finish', items: [{ type: 'text', content: 'Final result' }] },
  ],
})
function spec(node = stepper()): GenuiSpec { return { items: [node] } }
function selector(container: HTMLElement) { return within(container).getByRole('combobox', { name: 'Choose a step' }) as HTMLSelectElement }
const next = (container: HTMLElement) => fireEvent.click(within(container).getByRole('button', { name: 'Next' }))
const previous = (container: HTMLElement) => fireEvent.click(within(container).getByRole('button', { name: 'Previous' }))
beforeEach(() => { localStorage.clear(); setLocale('en') })
afterEach(() => { cleanup(); setLocale('zh') })

describe('local stepper navigation', () => {
  it('moves, jumps and bounds navigation without a model action', () => {
    const action = vi.fn()
    const view = render(<GenuiActionContext.Provider value={action}><GenuiBlock spec={spec()} /></GenuiActionContext.Provider>)
    expect((view.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true)
    expect(view.queryByText('Intermediate result')).toBeNull()
    next(view.container)
    expect(selector(view.container).value).toBe('1')
    expect(view.getByRole('region', { name: 'Work' })).toBeTruthy()
    previous(view.container)
    expect(selector(view.container).value).toBe('0')
    fireEvent.change(selector(view.container), { target: { value: '2' } })
    expect(view.getByRole('region', { name: 'Finish' })).toBeTruthy()
    expect((view.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)
    expect(action).not.toHaveBeenCalled()
  })

  it('retains visited widget instances, including inputs without IDs', () => {
    const lesson = stepper()
    lesson.steps[0]!.items = [{ type: 'input', label: 'Local note' }]
    const view = render(<GenuiBlock spec={spec(lesson)} />)
    const input = view.getByRole('textbox', { name: 'Local note' }) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Kept while browsing' } })
    next(view.container)
    expect(input.isConnected).toBe(true)
    expect(input.closest('[hidden]')).not.toBeNull()
    expect(view.queryByRole('textbox', { name: 'Local note' })).toBeNull()
    previous(view.container)
    expect(view.getByRole('textbox', { name: 'Local note' })).toBe(input)
    expect(input.value).toBe('Kept while browsing')
  })

  it('restores the selected stage and named input after unmount', () => {
    const view = render(<GenuiBlock spec={spec()} stateKey="lesson-restore" />)
    fireEvent.change(view.getByRole('textbox', { name: 'Note' }), { target: { value: 'Saved draft' } })
    next(view.container)
    view.unmount()
    const restored = render(<GenuiBlock spec={spec()} stateKey="lesson-restore" />)
    expect(selector(restored.container).value).toBe('1')
    previous(restored.container)
    expect((restored.getByRole('textbox', { name: 'Note' }) as HTMLInputElement).value).toBe('Saved draft')
    restored.rerender(<GenuiBlock spec={spec()} stateKey="another-lesson" />)
    expect(selector(restored.container).value).toBe('0')
    expect((restored.getByRole('textbox', { name: 'Note' }) as HTMLInputElement).value).toBe('')
  })

  it('keeps two same-ID steppers independent by occurrence', () => {
    const view = render(<GenuiBlock spec={{ items: [stepper(), stepper()] }} />)
    const containers = view.container.querySelectorAll<HTMLElement>('[data-genui-stepper]')
    next(containers[0]!)
    expect(selector(containers[0]!).value).toBe('1')
    expect(selector(containers[1]!).value).toBe('0')
  })

  it('supports keyboard navigation without taking input arrow keys', () => {
    const view = render(<GenuiBlock spec={spec()} />)
    fireEvent.keyDown(view.getByRole('textbox', { name: 'Note' }), { key: 'ArrowRight' })
    expect(selector(view.container).value).toBe('0')
    const group = view.getByRole('group', { name: 'Step-by-step walkthrough' })
    fireEvent.keyDown(group, { key: 'End' })
    expect(selector(view.container).value).toBe('2')
    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    expect(selector(view.container).value).toBe('1')
    fireEvent.keyDown(group, { key: 'Home' })
    expect(selector(view.container).value).toBe('0')
  })

  it('keeps nested navigation within its own stepper', () => {
    const parent = stepper()
    parent.steps[0]!.items = [stepper()]
    const view = render(<GenuiBlock spec={spec(parent)} />)
    const groups = view.container.querySelectorAll<HTMLElement>('[data-genui-stepper]')
    fireEvent.keyDown(groups[1]!, { key: 'ArrowRight' })
    const selects = view.container.querySelectorAll('select')
    expect(selects[0]!.value).toBe('0')
    expect(selects[1]!.value).toBe('1')
  })

  it('clamps a saved position after shrinking stages and handles an empty typed node', () => {
    const view = render(<GenuiBlock spec={spec()} />)
    fireEvent.change(selector(view.container), { target: { value: '2' } })
    const smaller = stepper()
    smaller.steps = smaller.steps.slice(0, 2)
    view.rerender(<GenuiBlock spec={spec(smaller)} />)
    expect(selector(view.container).value).toBe('1')
    view.rerender(<GenuiBlock spec={spec({ ...smaller, steps: [] })} />)
    expect(view.getByText('No steps available.')).toBeTruthy()
  })

  it('evaluates computed fields across stages and preserves the input', () => {
    const lesson = stepper()
    lesson.steps = [
      { title: 'Input', items: [{ type: 'input', id: 'amount', label: 'Amount', inputType: 'number', value: '4' }] },
      { title: 'Result', items: [{ type: 'text', content: 'Result: {{result}}' }] },
    ]
    const source: GenuiSpec = { ...spec(lesson), computed: [{ id: 'result', expr: 'amount > 5 ? 10 : amount*2' }] }
    const processed = processGenuiSpec(source)
    expect(processed.errors).toEqual([])
    const view = render(<GenuiBlock spec={processed.repaired!} />)
    fireEvent.change(view.getByRole('textbox', { name: 'Amount' }), { target: { value: '6' } })
    next(view.container)
    expect(view.getByText('Result: 10')).toBeTruthy()
    previous(view.container)
    expect((view.getByRole('textbox', { name: 'Amount' }) as HTMLInputElement).value).toBe('6')
  })
})

describe('stepper contract and export', () => {
  it('normalizes nested aliases and counts every stage against the node budget', () => {
    const processed = processGenuiSpec({ items: [{ type: 'stepper', steps: [
      { title: 'One', items: [{ type: 'text', text: 'Aliased text' }] },
      { title: 'Two', items: [{ type: 'json', value: { type: 'text', content: 'Opaque data' } }] },
    ] }] })
    expect(processed.errors).toEqual([])
    expect(countGenuiNodes(processed.repaired)).toBe(3)
    expect((processed.repaired!.items[0] as GenuiStepper).steps[0]!.items[0]).toMatchObject({ content: 'Aliased text' })
  })

  it('bounds stage count and rejects malformed children', () => {
    const many = { type: 'stepper', steps: Array.from({ length: 30 }, (_, i) => ({ title: String(i), items: [{ type: 'text', content: 'Body' }] })) }
    const processed = processGenuiSpec({ items: [many] })
    expect(isRenderableProcess(processed)).toBe(true)
    expect((processed.repaired!.items[0] as GenuiStepper).steps).toHaveLength(GENUI_LIMITS.maxStepperSteps)
    expect(countGenuiNodes(processed.repaired)).toBe(1 + GENUI_LIMITS.maxStepperSteps)
    expect(processGenuiSpec({ items: [{ type: 'stepper', steps: [] }] }).errors.length).toBeGreaterThan(0)
    expect(processGenuiSpec({ items: [{ type: 'stepper', steps: [{ title: 'Broken', items: [{ type: 'input', inputType: 'unrecognized' }] }] }] }).errors.length).toBeGreaterThan(0)
  })

  it('includes future-stage assets and sanitizes future-stage secrets', () => {
    const lesson = stepper()
    lesson.steps[2]!.items = [
      { type: 'mermaid', code: 'graph TD; A-->B' },
      { type: 'input', id: 'secret', inputType: 'password', value: 'DO_NOT_EXPORT' },
    ]
    expect(analyzeGenuiPortability(spec(lesson)).requiredAssets).toContain('mermaid')
    expect(analyzeGenuiPortability(spec(lesson)).hasModelActions).toBe(false)
    const key = stepperStateKey(lesson, 'items[0]')
    const artifact = createGenuiArtifact(spec(lesson), { stepperSteps: { [key]: 2, stale: 0 }, fields: { note: 'saved', secret: 'DO_NOT_EXPORT' } })
    expect(JSON.stringify(artifact)).not.toContain('DO_NOT_EXPORT')
    expect(artifact.state?.stepperSteps).toEqual({ [key]: 2 })
    expect(parseGenuiArtifact(JSON.parse(JSON.stringify(artifact)))).toEqual(artifact)
    expect(parseGenuiArtifact({ ...artifact, state: { stepperSteps: { [key]: 0.5 } } })).toBeNull()
    expect(normalizeStepperState(spec(lesson), { [key]: '2' })).toEqual({})
  })

  it('projects stage selection to the existing native-panel local action', () => {
    const state = emptyNativeState()
    const first = compileDshGo(spec(), 'panel', state, 'en', 'test')
    const navigation = [...first.actions.values()].find(action => action.node.type === 'stepper')!
    expect(navigation.kind).toBe('tab')
    state.tabs[navigation.key] = 1
    const second = compileDshGo(spec(), 'panel', state, 'en', 'test')
    expect(JSON.stringify(second.view)).toContain('Intermediate result')
    expect((navigation.node as GenuiStepper).type).toBe('stepper')
  })
})
