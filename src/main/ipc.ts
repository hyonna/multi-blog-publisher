import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import {
  getAllPosts,
  savePost,
  deletePost,
  getSettings,
  saveSettings,
  Post
} from './store'
import { loginToTistory, publishToTistory } from './publishers/tistory'
import { publishToVelog } from './publishers/velog'

export function setupIPC(): void {
  ipcMain.handle('post:getAll', () => getAllPosts())

  ipcMain.handle('post:save', (_e, postData: Partial<Post> & { content: string }) => {
    const now = new Date().toISOString()

    const titleMatch = postData.content.match(/^#\s+(.+)$/m)
    const title = titleMatch ? titleMatch[1].trim() : '제목 없음'

    const post: Post = {
      id: postData.id ?? uuidv4(),
      title,
      content: postData.content,
      tags: postData.tags ?? [],
      createdAt: postData.createdAt ?? now,
      updatedAt: now,
      publishedTo: postData.publishedTo ?? {}
    }

    savePost(post)
    return post
  })

  ipcMain.handle('post:delete', (_e, id: string) => {
    deletePost(id)
  })

  ipcMain.handle(
    'post:publish',
    async (_e, id: string, platforms: string[]) => {
      const posts = getAllPosts()
      const post = posts.find((p) => p.id === id)
      if (!post) throw new Error('포스트를 찾을 수 없습니다.')

      const settings = getSettings()
      const results: Record<string, { success: boolean; url?: string; error?: string }> = {}

      if (platforms.includes('tistory')) {
        try {
          const { url } = await publishToTistory(
            post,
            settings.tistory.blogName,
            settings.tistory.cookies
          )
          post.publishedTo.tistory = { postId: '', url, publishedAt: new Date().toISOString() }
          results.tistory = { success: true, url }
        } catch (err: unknown) {
          results.tistory = { success: false, error: err instanceof Error ? err.message : String(err) }
        }
      }

      if (platforms.includes('velog')) {
        try {
          const { id: velogId, url } = await publishToVelog(post, settings.velog.accessToken, settings.velog.refreshToken)
          post.publishedTo.velog = { id: velogId, url, publishedAt: new Date().toISOString() }
          results.velog = { success: true, url }
        } catch (err: unknown) {
          results.velog = { success: false, error: err instanceof Error ? err.message : String(err) }
        }
      }

      savePost(post)
      return { post, results }
    }
  )

  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:save', (_e, settings) => {
    saveSettings(settings)
  })

  ipcMain.handle('tistory:login', async () => {
    return await loginToTistory()
  })
}
