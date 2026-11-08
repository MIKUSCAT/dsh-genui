import { describe, expect, it } from 'vitest'
import { compileMathExpr, compileMathExprProgram } from '../src/client/safe-math.ts'
import { evaluateComputed } from '../src/client/computed.ts'
import type { GenuiSpec } from '../src/client/spec.ts'

const run = (expr: string, vars: Record<string, number> = {}) =>
  compileMathExpr(expr, { vars, allowImplicitVariables: false })?.(0)

describe('conditional expressions', () => {
  it.each([
    ['2 + 3 * 4 > 10 ? 7 : 9', 7],
    ['2 ^ 3 == 8 && 3 <= 3 ? 1 : 0', 1],
    ['1 || 0 && 0', 1],
    ['!0 + !2', 1],
    ['2 != 3 && 4 >= 4 && 5 < 6', 1],
    ['0 ? 1 : 0 ? 2 : 3', 3],
    ['1 ? 0 ? 2 : 3 : 4', 3],
    ['min(1 > 0 ? 8 : 2, 5)', 5],
    ['(2 < 3 ? 4 : 5) * 2', 8],
    ['-2 ^ 2 == -4 ? 1 : 0', 1],
    ['-1 ? 12 : 0', 12],
  ])('evaluates %s', (expression, expected) => {
    expect(run(expression)).toBe(expected)
  })

  it('uses exact threshold boundaries and the same language in plots', () => {
    const plot = compileMathExpr('x < 5 ? 2*x : 10')!
    expect([plot(4.5), plot(5), plot(8)]).toEqual([9, 10, 10])
    const domain = compileMathExpr('x >= 0 ? sqrt(x) : 0')!
    expect([domain(-4), domain(0), domain(9)]).toEqual([0, 0, 3])
  })

  it('never reads a variable in an unselected branch', () => {
    const read: string[] = []
    const program = compileMathExprProgram('on ? left : right', {
      vars: { on: 0, left: 0, right: 0 }, allowImplicitVariables: false,
      resolveVariable: name => { read.push(name); if (name === 'right') throw new Error('unselected'); return name === 'on' ? 1 : 8 },
    })!
    expect(program.variables).toEqual(['on', 'left', 'right'])
    expect(program.evaluate(0)).toBe(8)
    expect(read).toEqual(['on', 'left'])
  })

  it.each(['1 ? 3 : 1/0', '0 ? sqrt(-1) : 3', '1 || 1/0', '0 && sqrt(-1)'])('short-circuits %s', expression => {
    expect(Number.isFinite(run(expression))).toBe(true)
  })

  it.each(['0/0 ? 1 : 2', 'sqrt(-1) > 0 ? 1 : 2', '!(1/0)', '1/0 || 1', '1 && 1/0', '0 || sqrt(-1)'])('propagates invalid conditions: %s', expression => {
    expect(Number.isNaN(run(expression))).toBe(true)
  })

  it.each(['1 ? 2', '1 ?: 2', '1 ? 2 :', 'x = 1', '1 === 1', '1 & 2', '1 ||| 2', '1 ? window.x : 0', '0 ? missing : 1', '1 ? 3 : fetch(1)', '1 ? "yes" : 0'])('rejects malformed or unsupported syntax: %s', expression => {
    expect(compileMathExprProgram(expression, { vars: { x: 1 }, allowImplicitVariables: false })).toBeNull()
  })

  it('bounds nested conditional depth', () => {
    expect(compileMathExpr('1?1:'.repeat(34) + '0')).toBeNull()
  })
})

describe('conditional computed fields', () => {
  const spec: GenuiSpec = {
    computed: [
      { id: 'result', expr: 'enabled != 0 ? amount * 2 : 0' },
      { id: 'inverse', expr: 'amount == 0 ? 0 : 1/amount' },
    ],
    items: [
      { type: 'input', id: 'enabled', inputType: 'number', value: '0' },
      { type: 'input', id: 'amount', inputType: 'number', value: '' },
    ],
  }

  it('ignores empty inactive inputs and reports them when selected', () => {
    const inactive = evaluateComputed(spec, {})
    expect(inactive.values.result).toBe(0)
    expect(inactive.errors.result).toBeUndefined()
    expect(inactive.errors.inverse).toContain('amount')
    expect(evaluateComputed(spec, { enabled: '1' }).errors.result).toContain('amount')
    expect(evaluateComputed(spec, { enabled: '1', amount: '3' }).values.result).toBe(6)
    expect(evaluateComputed(spec, { amount: '0' }).values.inverse).toBe(0)
  })

  it('can bypass a failed computed dependency at runtime', () => {
    const result = evaluateComputed({
      computed: [{ id: 'bad', expr: '1/0' }, { id: 'good', expr: '0 ? bad : 7' }],
      items: [],
    }, {})
    expect(result.errors.bad).toBeDefined()
    expect(result.errors.good).toBeUndefined()
    expect(result.values.good).toBe(7)
  })

  it('keeps undeclared names and cycles invalid even in inactive branches', () => {
    const result = evaluateComputed({
      computed: [{ id: 'missing', expr: '0 ? undeclared : 1' }, { id: 'cycle', expr: '0 ? cycle : 1' }],
      items: [],
    }, {})
    expect(result.errors.missing).toBeDefined()
    expect(result.errors.cycle).toContain('循环')
  })
})
