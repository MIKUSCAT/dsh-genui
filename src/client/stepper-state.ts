import type { GenuiSpec, GenuiStepper } from './spec.ts'
import { walkGenuiNodes } from './walk-spec.ts'
import { GENUI_LIMITS } from './genui-runtime/limits.ts'

/** Occurrences remain independent even when authors reuse a component ID. */
export function stepperStateKey(node: GenuiStepper, path: string): string {
  return JSON.stringify([path, node.id ?? ''])
}

/** Retain current steppers and clamp a saved selection after stages are removed. */
export function normalizeStepperState(spec: GenuiSpec, value: unknown): Record<string, number> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const stored = value as Record<string, unknown>
  const entries: Array<[string, number]> = []
  walkGenuiNodes(spec, (node, path) => {
    if (node.type !== 'stepper' || node.steps.length === 0) return
    const key = stepperStateKey(node, path)
    const selected = Object.hasOwn(stored, key) ? stored[key] : undefined
    if (typeof selected !== 'number' || !Number.isSafeInteger(selected) || selected < 0 || selected >= GENUI_LIMITS.maxStepperSteps) return
    entries.push([key, Math.min(selected, node.steps.length - 1)])
  })
  return Object.fromEntries(entries)
}
