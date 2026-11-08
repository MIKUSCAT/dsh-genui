#!/usr/bin/env node
/** Real Chromium layout, contrast and interaction checks on synthetic fixtures. */
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { createServer } from 'vite'

const exec = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, '.e2e-artifacts', 'design')
const candidates = process.env.BROWSER_BIN ? [process.env.BROWSER_BIN]
  : process.platform === 'win32'
    ? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
    : ['google-chrome', 'chromium', 'chromium-browser']
let browser
for (const candidate of candidates) {
  try { await exec(candidate, ['--version'], { timeout: 10000, windowsHide: true }); browser = candidate; break } catch {}
}
if (!browser) throw new Error('Set BROWSER_BIN to an installed Chrome or Chromium executable.')
await mkdir(out, { recursive: true })
const server = await createServer({
  root, configFile: false,
  server: { host: '127.0.0.1', port: 0, strictPort: true, watch: null },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [{ find: /^(?:.*\/)?primitive-adapter\.ts$/, replacement: join(root, 'src/client/standalone/primitive-adapter.tsx') }],
  },
  optimizeDeps: { entries: ['tests/browser/personal-style.html'], include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client', 'katex'] },
})
const cases = [
  { name: 'budget-light', width: 1000, height: 860, query: '' },
  { name: 'budget-dark', width: 1000, height: 860, query: '?theme=dark' },
  { name: 'budget-mobile', width: 430, height: 1000, query: '?width=430' },
  { name: 'budget-sidebar', width: 1200, height: 1000, query: '?sidebar=1' },
  { name: 'budget-large-text', width: 1000, height: 1000, query: '?large=1' },
  { name: 'chart-light', width: 1000, height: 700, query: '?fixture=chart' },
  { name: 'chart-dark', width: 1000, height: 700, query: '?fixture=chart&theme=dark' },
  { name: 'table-mobile', width: 430, height: 700, query: '?fixture=table&width=430' },
]
const summary = []
const decode = value => value.replaceAll('&quot;', '"').replaceAll('&#39;', "'")
  .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&')
try {
  await server.listen()
  const address = server.httpServer.address()
  if (!address || typeof address === 'string') throw new Error('No preview port')
  for (const item of cases) {
    const profile = await mkdtemp(join(out, 'chrome-profile-'))
    try {
      const { stdout, stderr } = await exec(browser, [
        '--headless=new', '--no-first-run', '--no-default-browser-check',
        '--disable-background-networking', '--disable-extensions', '--disable-sync',
        '--user-data-dir=' + profile, '--virtual-time-budget=7000',
        '--window-size=' + item.width + ',' + item.height,
        '--screenshot=' + join(out, item.name + '.png'), '--dump-dom',
        'http://127.0.0.1:' + address.port + '/tests/browser/personal-style.html' + item.query,
      ], { timeout: 30000, maxBuffer: 8 * 1024 * 1024, windowsHide: true })
      await writeFile(join(out, item.name + '.html'), stdout)
      await writeFile(join(out, item.name + '.log'), stderr)
      const result = /<pre id="results">([^<]*)<\/pre>/.exec(stdout)?.[1]
      const errors = /<pre id="browser-errors">([^<]*)<\/pre>/.exec(stdout)?.[1]
      if (!result || result === 'pending' || errors) throw new Error(item.name + ': ' + (errors || 'fixture did not finish'))
      const checks = JSON.parse(decode(result))
      summary.push({ name: item.name, checks })
      console.log(item.name + ': ' + checks.filter(check => check.pass).length + '/' + checks.length)
      await readFile(join(out, item.name + '.png'))
    } finally {
      const actual = await realpath(profile)
      if (dirname(actual) !== await realpath(out)) throw new Error('Unexpected browser profile path')
      await rm(actual, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }
  }
  await writeFile(join(out, 'results.json'), JSON.stringify(summary, null, 2) + '\n')
  const failures = summary.flatMap(item => item.checks.filter(check => !check.pass).map(check => ({ fixture: item.name, ...check })))
  if (failures.length) throw new Error(JSON.stringify(failures, null, 2))
  console.log('Design browser checks passed.')
} finally {
  await server.close()
}
