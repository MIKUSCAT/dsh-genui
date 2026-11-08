import { useId, useRef, useState, type KeyboardEvent } from 'react'
import type { GenuiStepper } from '../spec.ts'
import type { AnswersState, GenuiBlockProps } from './state.ts'
import { renderNode } from './render-node.tsx'
import { GENUI_LIMITS } from '../genui-runtime/limits.ts'
import { stepperStateKey } from '../stepper-state.ts'
import { useT } from '../i18n/index.ts'
import css from '../GenuiBlock.module.css'

/** Visit stages locally; keep visited content mounted so local widget state survives. */
export function StepperNode({ node, path, depth, answers, onAction }: {
  node: GenuiStepper
  path: string
  depth: number
  answers: AnswersState | undefined
  onAction: GenuiBlockProps['onAction']
}) {
  const t = useT()
  const uid = useId()
  const steps = node.steps.slice(0, GENUI_LIMITS.maxStepperSteps)
  const bound = (value: number) => Math.max(0, Math.min(Number.isSafeInteger(value) ? value : 0, steps.length - 1))
  const key = stepperStateKey(node, path)
  const [local, setLocal] = useState(() => bound(node.initialStep ?? 0))
  const active = bound(answers?.stepperSteps?.[key] ?? local)
  const [visited, setVisited] = useState(() => new Set([active]))
  const navigation = useRef<HTMLDivElement>(null)
  const select = (value: number) => {
    if (!Number.isSafeInteger(value)) return
    const next = bound(value)
    setVisited(previous => new Set([...previous, active, next]))
    setLocal(next)
    answers?.setStepperStep?.(key, next)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Arrow keys inside inputs, charts and nested steppers retain their own meaning.
    if (event.target !== event.currentTarget && !navigation.current?.contains(event.target as Node)) return
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const next = event.key === 'ArrowRight' ? active + 1 : event.key === 'ArrowLeft' ? active - 1
      : event.key === 'Home' ? 0 : event.key === 'End' ? steps.length - 1 : undefined
    if (next === undefined) return
    event.preventDefault()
    event.stopPropagation()
    select(next)
  }
  if (!steps.length) return <div role="status">{t('stepper.empty')}</div>
  return (
    <div className={css.stepper} data-genui-stepper role="group" aria-label={t('stepper.label')} tabIndex={0} onKeyDown={onKeyDown}>
      <div className={css.stepperHeader}>
        <select className={css.stepperSelect} aria-label={t('stepper.choose')} value={active} onChange={event => select(Number(event.target.value))}>
          {steps.map((step, index) => <option key={index} value={index}>{step.title}</option>)}
        </select>
        <span className={css.stepperPosition} role="status" aria-live="polite" aria-atomic="true">{active + 1} / {steps.length}</span>
      </div>
      {steps.map((step, index) => (visited.has(index) || index === active) && (
        <div className={css.stepperPanel} id={`${uid}-stage-${index}`} key={index}
          data-genui-stepper-stage={index} hidden={index !== active} role="region" aria-label={step.title}>
          {step.items.map((child, childIndex) => renderNode(child, childIndex, onAction, depth + 1, answers, `${path}.steps[${index}].items[${childIndex}]`))}
        </div>
      ))}
      <div className={css.stepperNavigation} ref={navigation}>
        <button type="button" className={css.button} disabled={active === 0} aria-controls={`${uid}-stage-${active}`} onClick={() => select(active - 1)}>{t('stepper.previous')}</button>
        <button type="button" className={`${css.button} ${css.primary}`} disabled={active === steps.length - 1} aria-controls={`${uid}-stage-${active}`} onClick={() => select(active + 1)}>{t('stepper.next')}</button>
      </div>
    </div>
  )
}
