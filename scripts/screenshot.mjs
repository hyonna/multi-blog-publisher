import { _electron as electron } from 'playwright-core'
import * as path from 'node:path'
import * as fs from 'node:fs'

const APP_DIR = path.resolve(import.meta.dirname, '..')
const SHOT_DIR = '/tmp/shots'
fs.mkdirSync(SHOT_DIR, { recursive: true })

const electronBin = path.join(APP_DIR, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')

console.log('Launching app...')
const app = await electron.launch({
  executablePath: electronBin,
  args: [APP_DIR],
  env: { ...process.env, NODE_ENV: 'production' },
  timeout: 30_000,
})

console.log('Waiting for window...')
await new Promise(r => setTimeout(r, 5_000))

const page = app.windows().find(w => !w.url().startsWith('devtools://'))
  ?? await app.firstWindow()

console.log('Windows:', app.windows().map(w => w.url()))

await page.screenshot({ path: path.join(SHOT_DIR, '01-main.png') })
console.log('Screenshot: /tmp/shots/01-main.png')

// 새 글 작성 버튼 클릭
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const btn = btns.find(b => b.textContent?.includes('새 글'))
  btn?.click()
})
await new Promise(r => setTimeout(r, 1_000))
await page.screenshot({ path: path.join(SHOT_DIR, '02-new-post.png') })
console.log('Screenshot: /tmp/shots/02-new-post.png')

// 마크다운 입력 테스트
await page.evaluate(() => {
  const textarea = document.querySelector('textarea')
  if (textarea) {
    const nativeInputSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    nativeInputSetter?.call(textarea, '# 테스트 글\n\n안녕하세요! **Multi Blog Publisher** 테스트입니다.\n\n## 기능\n\n- 마크다운 편집\n- 티스토리 발행\n- 벨로그 발행')
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.dispatchEvent(new Event('change', { bubbles: true }))
  }
})
await new Promise(r => setTimeout(r, 1_500))
await page.screenshot({ path: path.join(SHOT_DIR, '03-editor.png') })
console.log('Screenshot: /tmp/shots/03-editor.png')

await app.close()
console.log('Done.')
