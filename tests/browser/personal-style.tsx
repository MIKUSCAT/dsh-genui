import { createRoot } from 'react-dom/client'
import { GenuiBlock } from '../../src/client/GenuiBlock.tsx'
import { setLocale } from '../../src/client/i18n/runtime.ts'
import css from '../../src/client/GenuiBlock.module.css'
import budget from '../fixtures/personal-budget.json'
import type { GenuiSpec } from '../../src/client/spec.ts'

const params = new URLSearchParams(location.search)
const dark = params.get('theme') === 'dark'
document.body.toggleAttribute('data-ds-dark-theme', dark)
document.body.style.setProperty('--dsh-content-font-size', params.get('large') ? '20px' : '15px')
document.body.style.setProperty('--dsw-alias-label-primary', 'rgb(0, 0, 255)')
const app = document.getElementById('app')!
if (params.has('sidebar')) app.style.width = '380px'
// Windows Chromium enforces a minimum outer-window width. Constrain the test
// document independently so phone-sized screenshots measure a real narrow surface.
if (params.has('width')) {
  document.documentElement.style.width = params.get('width') + 'px'
  app.style.margin = '16px 0'
}
setLocale('zh')
const chart: GenuiSpec = { title: '每周支出', items: [
  { type: 'chart', kind: 'line', data: [
    { label: '周一', value: 180 }, { label: '周二', value: 260 },
    { label: '周三', value: 210 }, { label: '周四', value: 320 },
    { label: '周五', value: 280 }, { label: '周六', value: 390 },
    { label: '周日', value: 340 },
  ] },
] }
const comparison: GenuiSpec = { title: '方案对比', items: [
  { type: 'table', columns: ['方案', '月费', '席位'], types: ['text', 'num', 'num'], rows: [
    ['基础版', 120, 5], ['团队版', 180, 10], ['专业版', 260, 20],
  ] },
] }
const fixture = params.get('fixture')
const spec = fixture === 'chart' ? chart : fixture === 'table' ? comparison : budget as GenuiSpec
const root = createRoot(app)
root.render(<GenuiBlock spec={spec} />)
const settle = () => new Promise(resolve => setTimeout(resolve, 100))
const results: { name: string; pass: boolean; actual: unknown }[] = []
function check(name: string, pass: boolean, actual: unknown) { results.push({ name, pass, actual }) }
function luminance(rgb: string) {
  const channels = rgb.match(/[\d.]+/g)!.slice(0, 3).map(value => {
    const c = Number(value) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
}
function contrast(a: string, b: string) {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
async function verify() {
  await settle()
  const block = app.querySelector<HTMLElement>('[data-genui]')!
  const style = getComputedStyle(block)
  check('warm canvas', style.backgroundColor === (dark ? 'rgb(38, 38, 36)' : 'rgb(250, 249, 245)'), style.backgroundColor)
  check('host palette unchanged', getComputedStyle(document.body).getPropertyValue('--dsw-alias-label-primary').trim() === 'rgb(0, 0, 255)', getComputedStyle(document.body).getPropertyValue('--dsw-alias-label-primary'))
  check('no page overflow', document.documentElement.scrollWidth <= innerWidth, document.documentElement.scrollWidth)
  const frame = block.getBoundingClientRect()
  check('controls stay inside the surface', [...block.querySelectorAll('input')].every(input => input.getBoundingClientRect().right <= frame.right), frame.width)
  check('body remains readable', Number.parseFloat(style.fontSize) >= (params.has('large') ? 20 : 15), style.fontSize)
  check('text contrast', contrast(style.color, style.backgroundColor) >= 4.5, contrast(style.color, style.backgroundColor))
  const caption = block.querySelector<HTMLElement>('.' + css.statLabel)
  if (caption) {
    const cs = getComputedStyle(caption)
    check('label size', Number.parseFloat(cs.fontSize) >= 14, cs.fontSize)
    check('label contrast', contrast(cs.color, style.backgroundColor) >= 4.5, contrast(cs.color, style.backgroundColor))
  }
  const grid = block.querySelector<HTMLElement>('.' + css.grid)
  if (grid && (params.has('sidebar') || innerWidth < 560)) {
    check('narrow grid stacks', getComputedStyle(grid).gridTemplateColumns.split(' ').length === 1, getComputedStyle(grid).gridTemplateColumns)
  }
  if (!fixture) {
    const inputs = block.querySelectorAll<HTMLInputElement>('input:not([type="range"])')
    const seat = inputs[1]!
    const values = () => [...block.querySelectorAll('.' + css.statValue)].map(node => node.textContent)
    check('initial calculation', values().join(' ').includes('1,024') && values().join(' ').includes('976'), values())
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    seat.focus()
    set.call(seat, '12')
    seat.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    check('input recalculates', values().join(' ').includes('1,536') && values().join(' ').includes('464'), values())
    check('focus survives calculation', document.activeElement === seat, document.activeElement?.getAttribute('type'))
    set.call(seat, '8')
    seat.dispatchEvent(new Event('input', { bubbles: true }))
    seat.blur()
    await settle()
  }
  if (fixture === 'chart') {
    const axes = [...block.querySelectorAll<SVGTextElement>('svg text')]
    check('chart renders', axes.length > 0, axes.length)
    check('chart labels readable', axes.every(node => Number.parseFloat(getComputedStyle(node).fontSize) >= 14), axes.map(node => getComputedStyle(node).fontSize))
  }
  document.getElementById('results')!.textContent = JSON.stringify(results)
}
void verify().catch(error => { document.getElementById('browser-errors')!.textContent = String(error) })
