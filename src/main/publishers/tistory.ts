import axios from 'axios'
import http from 'http'
import { AddressInfo } from 'net'
import { BrowserWindow } from 'electron'
import { marked } from 'marked'
import { Post } from '../store'

export async function getTistoryAccessToken(appId: string, appSecret: string): Promise<string> {
  const { port, waitForCode } = await startCallbackServer()
  const redirectUri = `http://localhost:${port}/callback`

  const authUrl =
    `https://www.tistory.com/oauth/authorize` +
    `?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`

  const win = new BrowserWindow({
    width: 600,
    height: 700,
    webPreferences: { nodeIntegration: false }
  })
  win.loadURL(authUrl)

  const code = await waitForCode()
  win.destroy()

  const tokenUrl =
    `https://www.tistory.com/oauth/access_token` +
    `?client_id=${appId}&client_secret=${appSecret}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}&grant_type=authorization_code`

  const res = await axios.get(tokenUrl)
  const params = new URLSearchParams(res.data)
  const accessToken = params.get('access_token')
  if (!accessToken) throw new Error('Tistory 액세스 토큰을 받지 못했습니다.')
  return accessToken
}

export async function getTistoryBlogs(accessToken: string): Promise<{ name: string; title: string }[]> {
  const res = await axios.get('https://www.tistory.com/apis/blog/info', {
    params: { access_token: accessToken, output: 'json' }
  })
  return res.data.tistory.item.blogs
}

export async function publishToTistory(post: Post, accessToken: string, blogName: string): Promise<{ postId: string; url: string }> {
  const html = await marked(post.content)

  const params = new URLSearchParams({
    access_token: accessToken,
    output: 'json',
    blogName,
    title: post.title,
    content: html,
    visibility: '3',
    acceptComment: '1',
    category: '0'
  })

  const res = await axios.post('https://www.tistory.com/apis/post/write', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })

  const item = res.data.tistory.item
  return { postId: item.postId, url: item.url }
}

function startCallbackServer(): Promise<{ port: number; waitForCode: () => Promise<string> }> {
  return new Promise((resolve) => {
    let resolveCode: (code: string) => void
    const codePromise = new Promise<string>((res) => {
      resolveCode = res
    })

    const server = http.createServer((req, res) => {
      const url = new URL(req.url!, 'http://localhost')
      const code = url.searchParams.get('code')

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<h2>인증 완료!</h2><p>앱으로 돌아가세요. 이 창은 닫아도 됩니다.</p>')
        resolveCode(code)
        server.close()
      } else {
        res.writeHead(400)
        res.end('인증 코드를 받지 못했습니다.')
      }
    })

    server.listen(0, 'localhost', () => {
      const port = (server.address() as AddressInfo).port
      resolve({ port, waitForCode: () => codePromise })
    })
  })
}
