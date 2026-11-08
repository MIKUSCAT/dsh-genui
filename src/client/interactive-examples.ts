import type { GenuiSpec, GenuiNode } from './spec.ts'
import { t } from './i18n/index.ts'

/** A complete precomputed walkthrough; navigation itself performs no search call. */
export function binarySearchExample(): GenuiSpec {
  const values = [2, 5, 8, 12, 16, 23, 38, 56, 72]
  const stages = [
    { low: 0, high: 8, mid: -1 },
    { low: 0, high: 8, mid: 4 },
    { low: 5, high: 8, mid: 6 },
    { low: 5, high: 5, mid: 5 },
    { low: 5, high: 5, mid: 5 },
  ]
  return {
    title: t('demo.search.title'),
    items: [{
      type: 'stepper', id: 'binary-search', steps: stages.map((stage, index) => ({
        title: t('demo.search.stage' + index),
        items: [
          { type: 'blocks', columns: values.length, rows: [{ variant: 'outline', cells: values.map((value, i) =>
            i === stage.mid ? { text: String(value), tone: 'accent' as const } : String(value)) }] },
          { type: 'keyvalue', pairs: [
            { key: t('demo.search.lower'), value: String(stage.low) },
            { key: t('demo.search.upper'), value: String(stage.high) },
            ...(stage.mid < 0 ? [] : [{ key: t('demo.search.middle'), value: String(stage.mid) }]),
          ] },
          { type: 'text', content: t('demo.search.body' + index) },
        ] satisfies GenuiNode[],
      })),
    }],
  }
}

/** Two inputs drive both a numeric result and a sampled piecewise response curve. */
export function thresholdExample(): GenuiSpec {
  return {
    title: t('demo.threshold.title'),
    computed: [
      { id: 'response', expr: 'x < threshold ? 2*x : 2*threshold', format: { maximumFractionDigits: 2 } },
      ...Array.from({ length: 11 }, (_, i) => ({ id: 'point' + i, expr: `${i} < threshold ? 2*${i} : 2*threshold` })),
    ],
    items: [
      { type: 'stat', label: t('demo.threshold.result'), value: '{{response}}' },
      { type: 'grid', cols: 2, items: [
        { type: 'slider', id: 'x', label: t('demo.threshold.input'), min: 0, max: 10, step: 0.5, value: 3 },
        { type: 'slider', id: 'threshold', label: t('demo.threshold.limit'), min: 1, max: 9, step: 1, value: 5 },
      ] },
      { type: 'chart', kind: 'line', data: Array.from({ length: 11 }, (_, i) => ({ label: String(i), value: { $computed: 'point' + i } })) },
    ],
  }
}
