import { BrowserWindow, session } from 'electron'
import { Post } from '../store'

const PARTITION = 'persist:velog'

async function setupSession(accessToken: string, refreshToken: string): Promise<Electron.Session> {
  const ses = session.fromPartition(PARTITION)
  const base = { domain: '.velog.io', path: '/', secure: true }

  await ses.cookies.set({ url: 'https://velog.io', name: 'access_token', value: accessToken, ...base })
  if (refreshToken) {
    await ses.cookies.set({ url: 'https://velog.io', name: 'refresh_token', value: refreshToken, ...base })
  }
  return ses
}

export async function publishToVelog(
  post: Post,
  accessToken: string,
  refreshToken: string
): Promise<{ id: string; url: string }> {
  const ses = await setupSession(accessToken, refreshToken)

  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    show: true,
    title: '벨로그 글쓰기 — 내용 확인 후 출간하기를 눌러주세요',
    webPreferences: { session: ses, nodeIntegration: false, contextIsolation: true },
  })

  win.loadURL('https://velog.io/write')

  return new Promise((resolve, reject) => {
    let injected = false

    win.webContents.on('did-finish-load', async () => {
      const url = win.webContents.getURL()

      if (url.includes('/login')) {
        win.destroy()
        reject(new Error('벨로그 로그인이 필요합니다. access_token을 다시 확인해 주세요.'))
        return
      }

      if (!url.includes('/write') || injected) return
      injected = true

      // 에디터 초기화 대기
      await new Promise(r => setTimeout(r, 2500))

      await win.webContents.executeJavaScript(`
        (async () => {
          // 제목 입력
          const titleEl =
            document.querySelector('textarea[placeholder*="제목"]') ||
            document.querySelector('.title-textarea') ||
            document.querySelector('input[placeholder*="제목"]')
          if (titleEl) {
            titleEl.focus()
            document.execCommand('selectAll')
            document.execCommand('insertText', false, ${JSON.stringify(post.title)})
          }

          await new Promise(r => setTimeout(r, 400))

          // 본문 입력 (CodeMirror)
          const cmEl = document.querySelector('.CodeMirror')
          if (cmEl && cmEl.CodeMirror) {
            cmEl.CodeMirror.focus()
            cmEl.CodeMirror.setValue(${JSON.stringify(post.content)})
          } else {
            const ta = document.querySelector('.CodeMirror textarea')
            if (ta) {
              ta.focus()
              document.execCommand('selectAll')
              document.execCommand('insertText', false, ${JSON.stringify(post.content)})
            }
          }

          // 태그 입력
          const tagInput = document.querySelector('.tag-input input, input[placeholder*="태그"]')
          if (tagInput && ${JSON.stringify(post.tags)}.length > 0) {
            for (const tag of ${JSON.stringify(post.tags)}) {
              tagInput.focus()
              document.execCommand('insertText', false, tag)
              tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
              await new Promise(r => setTimeout(r, 200))
            }
          }

          return 'injected'
        })()
      `).catch(console.error)
    })

    // 발행 완료 후 포스트 URL로 이동 감지
    win.webContents.on('did-navigate', (_, url) => {
      const isPost = /velog\.io\/@[^/]+\/[^/?#]+/.test(url) && !url.endsWith('/write')
      if (isPost) {
        win.destroy()
        resolve({ id: '', url })
      }
    })

    win.on('closed', () => {
      reject(new Error('창이 닫혔습니다. 발행 여부를 직접 velog.io에서 확인해 주세요.'))
    })
  })
}
