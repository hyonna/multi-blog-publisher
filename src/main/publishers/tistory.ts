import { BrowserWindow, session, Cookie } from 'electron'
import { marked } from 'marked'
import { Post } from '../store'

const TISTORY_LOGIN_URL = 'https://www.tistory.com/auth/login'

export async function loginToTistory(): Promise<{ blogName: string; cookies: string }> {
  const ses = session.fromPartition('persist:tistory')

  const win = new BrowserWindow({
    width: 900,
    height: 700,
    title: '티스토리 로그인',
    webPreferences: { session: ses, nodeIntegration: false, contextIsolation: true }
  })

  win.loadURL(TISTORY_LOGIN_URL)

  return new Promise((resolve, reject) => {
    let resolved = false

    const tryCapture = async (url: string) => {
      if (resolved) return
      if (url.includes('/auth/login') || url.includes('/auth/kakao')) return
      if (!url.includes('tistory.com')) return

      resolved = true
      const cookies = await ses.cookies.get({ domain: '.tistory.com' })

      let blogName = ''
      try {
        blogName = await win.webContents.executeJavaScript(`
          (function() {
            const m = location.hostname.match(/^([^.]+)\\.tistory\\.com$/)
            if (m) return m[1]
            const el = document.querySelector('[href*=".tistory.com"]')
            const m2 = el?.href?.match(/https?:\\/\\/([^.]+)\\.tistory\\.com/)
            return m2 ? m2[1] : ''
          })()
        `)
      } catch { /* ignore */ }

      win.destroy()
      resolve({ blogName, cookies: JSON.stringify(cookies) })
    }

    win.webContents.on('did-navigate', (_, url) => tryCapture(url))
    win.webContents.on('did-navigate-in-page', (_, url) => tryCapture(url))
    win.on('closed', () => { if (!resolved) reject(new Error('로그인 창이 닫혔습니다.')) })
  })
}

export async function publishToTistory(
  post: Post,
  blogName: string,
  cookiesJson: string
): Promise<{ url: string }> {
  const cookies: Cookie[] = JSON.parse(cookiesJson)
  const ses = session.fromPartition('persist:tistory')

  for (const c of cookies) {
    await ses.cookies.set({
      url: `https://${(c.domain ?? 'tistory.com').replace(/^\./, '')}`,
      name: c.name,
      value: c.value,
      domain: c.domain ?? '.tistory.com',
      path: c.path ?? '/',
      secure: c.secure ?? false,
      httpOnly: c.httpOnly ?? false,
      expirationDate: c.expirationDate,
    }).catch(() => {})
  }

  const html = await marked(post.content)
  const writeUrl = `https://${blogName}.tistory.com/manage/newpost/`

  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    show: true,
    title: '티스토리 글쓰기 — 내용 확인 후 발행 버튼을 눌러주세요',
    webPreferences: { session: ses, nodeIntegration: false, contextIsolation: true }
  })

  win.loadURL(writeUrl)

  return new Promise((resolve, reject) => {
    let injected = false
    let lastNavigatedUrl = writeUrl

    // 발행 후 리다이렉트 URL 감지
    win.webContents.on('did-navigate', (_, url) => {
      lastNavigatedUrl = url

      if (url.includes('/auth/login') || url.includes('/auth/kakao')) {
        win.destroy()
        reject(new Error('로그인이 만료됐습니다. 설정에서 다시 로그인해 주세요.'))
        return
      }

      if (!url.includes(`${blogName}.tistory.com`)) return

      const isPublishedPost = !url.includes('/manage/') && !url.includes('/auth/')
      // 발행 후 게시글 목록으로 이동하는 경우도 성공으로 처리
      const isManagePostList = /\/manage\/posts?\b/.test(url)

      if (isPublishedPost) {
        win.destroy()
        resolve({ url })
      } else if (isManagePostList) {
        win.destroy()
        resolve({ url: `https://${blogName}.tistory.com` })
      }
    })

    // 유저가 직접 창을 닫은 경우 — 발행 완료 후 닫은 것으로 간주
    win.on('closed', () => {
      const wasOnWritePage =
        lastNavigatedUrl === writeUrl ||
        lastNavigatedUrl.includes('/manage/newpost')

      if (wasOnWritePage) {
        // 글쓰기 페이지에서 닫혔다면 발행 안 한 것
        reject(new Error('발행하지 않고 창을 닫았습니다.'))
      } else {
        // 다른 페이지로 이동한 후 닫혔다면 발행 완료로 처리
        resolve({ url: lastNavigatedUrl.includes('/manage/') ? `https://${blogName}.tistory.com` : lastNavigatedUrl })
      }
    })

    // 에디터 준비 후 콘텐츠 주입
    win.webContents.on('did-finish-load', async () => {
      const url = win.webContents.getURL()
      if (url.includes('/auth/') || injected) return
      injected = true

      await new Promise(r => setTimeout(r, 1500))

      await win.webContents.executeJavaScript(`
        (async function() {
          // 제목 입력
          const titleEl = document.querySelector('#title, input[name="title"], [placeholder*="제목"]')
          if (titleEl) {
            titleEl.focus()
            titleEl.value = ${JSON.stringify(post.title)}
            titleEl.dispatchEvent(new Event('input', { bubbles: true }))
            titleEl.dispatchEvent(new Event('change', { bubbles: true }))
          }

          await new Promise(r => setTimeout(r, 400))

          // 마크다운 모드 전환 시도
          const mdBtn = document.querySelector(
            '[data-mode="markdown"], .btn_markdown, [title="마크다운"], [aria-label="마크다운"], button[class*="markdown"]'
          )
          if (mdBtn) {
            mdBtn.click()
            await new Promise(r => setTimeout(r, 800))
            const cm = document.querySelector('.CodeMirror')
            if (cm && cm.CodeMirror) {
              cm.CodeMirror.setValue(${JSON.stringify(post.content)})
            } else {
              const ta = document.querySelector('.CodeMirror textarea')
              if (ta) {
                ta.focus()
                document.execCommand('selectAll')
                document.execCommand('insertText', false, ${JSON.stringify(post.content)})
              }
            }
            return 'markdown'
          }

          // HTML 모드 전환 시도
          const htmlBtn = document.querySelector(
            '[data-mode="html"], .btn_html, [title="HTML"], [aria-label="HTML"], button[class*="html"]'
          )
          if (htmlBtn) {
            htmlBtn.click()
            await new Promise(r => setTimeout(r, 800))
          }
          const htmlArea = document.querySelector('#area_html, textarea[name="content"]')
          if (htmlArea) {
            htmlArea.value = ${JSON.stringify(html)}
            htmlArea.dispatchEvent(new Event('input', { bubbles: true }))
          }

          // 태그 입력
          await new Promise(r => setTimeout(r, 400))
          const tags = ${JSON.stringify(post.tags)}
          if (tags.length > 0) {
            const tagInput = document.querySelector(
              '#tag, input[id*="tag"], input[placeholder*="태그"], .tag-input input, [name="tag"]'
            )
            if (tagInput) {
              for (const tag of tags) {
                tagInput.focus()
                tagInput.value = tag
                tagInput.dispatchEvent(new Event('input', { bubbles: true }))
                tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, keyCode: 13 }))
                tagInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true, keyCode: 13 }))
                await new Promise(r => setTimeout(r, 300))
              }
            }
          }

          return 'done'
        })()
      `).catch(console.error)
    })
  })
}
