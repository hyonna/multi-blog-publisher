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

      if (url.includes('tistory.com')) {
        resolved = true

        const cookies = await ses.cookies.get({ domain: '.tistory.com' })

        // 블로그 이름 추출 시도
        let blogName = ''
        try {
          blogName = await win.webContents.executeJavaScript(`
            (function() {
              const el = document.querySelector('.link_blog, [data-blog], .user_blog')
              if (el) {
                const href = el.href || el.dataset.blog || ''
                const m = href.match(/https?:\\/\\/([^.]+)\\.tistory\\.com/)
                return m ? m[1] : ''
              }
              const m = location.hostname.match(/^([^.]+)\\.tistory\\.com$/)
              return m ? m[1] : ''
            })()
          `)
        } catch {
          blogName = ''
        }

        win.destroy()
        resolve({ blogName, cookies: JSON.stringify(cookies) })
      }
    }

    win.webContents.on('did-navigate', (_, url) => tryCapture(url))
    win.webContents.on('did-navigate-in-page', (_, url) => tryCapture(url))

    win.on('closed', () => {
      if (!resolved) reject(new Error('로그인 창이 닫혔습니다.'))
    })
  })
}

export async function publishToTistory(
  post: Post,
  blogName: string,
  cookiesJson: string
): Promise<{ url: string }> {
  const cookies: Cookie[] = JSON.parse(cookiesJson)
  const ses = session.fromPartition('persist:tistory')

  // 저장된 쿠키 복원
  for (const c of cookies) {
    await ses.cookies.set({
      url: `https://${c.domain?.replace(/^\./, '') ?? 'tistory.com'}`,
      name: c.name,
      value: c.value,
      domain: c.domain ?? '.tistory.com',
      path: c.path ?? '/',
      secure: c.secure ?? false,
      httpOnly: c.httpOnly ?? false,
      expirationDate: c.expirationDate
    }).catch(() => {})
  }

  const html = await marked(post.content)
  const writeUrl = `https://${blogName}.tistory.com/manage/newpost/`

  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    show: true,
    title: '티스토리 글쓰기',
    webPreferences: { session: ses, nodeIntegration: false, contextIsolation: true }
  })

  win.loadURL(writeUrl)

  return new Promise((resolve, reject) => {
    let injected = false

    win.webContents.on('did-finish-load', async () => {
      const url = win.webContents.getURL()

      if (url.includes('/auth/login') || url.includes('/auth/kakao')) {
        win.destroy()
        reject(new Error('로그인이 만료됐습니다. 설정에서 다시 로그인해 주세요.'))
        return
      }

      if (injected) return
      injected = true

      // 에디터 준비 대기
      await new Promise(r => setTimeout(r, 1500))

      await win.webContents.executeJavaScript(`
        (async function() {
          // 제목 입력
          const titleEl = document.querySelector('#title, input[name="title"], [placeholder*="제목"]')
          if (titleEl) {
            titleEl.focus()
            titleEl.value = ${JSON.stringify(post.title)}
            titleEl.dispatchEvent(new Event('input', { bubbles: true }))
          }

          await new Promise(r => setTimeout(r, 300))

          // 마크다운 모드 전환 시도
          const mdBtn = document.querySelector(
            '[data-mode="markdown"], .btn_markdown, [title="마크다운"], [aria-label="마크다운"]'
          )
          if (mdBtn) {
            mdBtn.click()
            await new Promise(r => setTimeout(r, 800))

            // CodeMirror 또는 textarea에 내용 입력
            const cm = document.querySelector('.CodeMirror')
            if (cm && cm.CodeMirror) {
              cm.CodeMirror.setValue(${JSON.stringify(post.content)})
            } else {
              const ta = document.querySelector('.CodeMirror textarea, textarea[name="content"]')
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
            '[data-mode="html"], .btn_html, [title="HTML"], [aria-label="HTML"]'
          )
          if (htmlBtn) {
            htmlBtn.click()
            await new Promise(r => setTimeout(r, 800))
          }

          const htmlArea = document.querySelector(
            '#area_html, textarea[name="content"], .html-editor textarea'
          )
          if (htmlArea) {
            htmlArea.value = ${JSON.stringify(html)}
            htmlArea.dispatchEvent(new Event('input', { bubbles: true }))
            return 'html'
          }

          return 'unknown'
        })()
      `).catch(console.error)
    })

    // 발행 후 URL 변경 감지
    win.webContents.on('did-navigate', (_, url) => {
      if (
        url.includes(`${blogName}.tistory.com`) &&
        !url.includes('/manage/') &&
        !url.includes('/auth/')
      ) {
        win.destroy()
        resolve({ url })
      }
    })

    win.on('closed', () => {
      reject(new Error('창이 닫혔습니다. 발행 여부를 확인해 주세요.'))
    })
  })
}
