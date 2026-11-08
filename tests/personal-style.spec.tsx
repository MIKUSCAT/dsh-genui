import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GenuiBlock } from '../src/client/GenuiBlock.tsx'
import { processGenuiSpec, isRenderableProcess } from '../src/client/guard.ts'
import type { GenuiSpec } from '../src/client/spec.ts'

afterEach(cleanup)

describe('personal GenUI presentation', () => {
  it('honours row spacing while keeping an edited field across a layout revision', () => {
    const spec = (gap: number): GenuiSpec => ({ items: [{
      type: 'row', gap, items: [{ type: 'input', id: 'name', label: 'Name', value: '' }],
    }] })
    const first = processGenuiSpec(spec(16))
    expect(isRenderableProcess(first)).toBe(true)
    const view = render(<GenuiBlock spec={first.repaired!} stateKey="personal-layout" />)
    const input = view.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Edited' } })
    expect(view.container.querySelector('[style*="gap: 16px"]')).not.toBeNull()
    view.rerender(<GenuiBlock spec={processGenuiSpec(spec(32)).repaired!} stateKey="personal-layout" />)
    expect(view.getByRole('textbox')).toBe(input)
    expect(input.value).toBe('Edited')
    expect(view.container.querySelector('[style*="gap: 32px"]')).not.toBeNull()
  })

  it('omits legacy decorative emoji fields and renders named functional icons', () => {
    const view = render(<GenuiBlock spec={{ items: [
      { type: 'badge', label: 'Ready', icon: '✅' },
      { type: 'badge', label: 'Nodes', icon: 'Nodes' },
      { type: 'text', content: 'User content: 🚲' },
    ] }} />)
    expect(view.container.textContent).not.toContain('✅')
    expect(view.getByText('Ready')).toBeTruthy()
    expect(view.container.querySelector('svg')).not.toBeNull()
    expect(view.getByText('User content: 🚲')).toBeTruthy()
  })

  it('uses legacy eyebrows only as a fallback title, never a second annotation', () => {
    const view = render(<GenuiBlock spec={{ items: [
      { type: 'card', title: 'Actual title', eyebrow: 'Decorative note', items: [] },
      { type: 'card', eyebrow: 'Legacy title', items: [] },
    ] }} />)
    expect(view.getByText('Actual title')).toBeTruthy()
    expect(view.getByText('Legacy title')).toBeTruthy()
    expect(view.queryByText('Decorative note')).toBeNull()
  })
})
