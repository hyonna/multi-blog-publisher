import Store from 'electron-store'

export interface Post {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
  publishedTo: {
    tistory?: { postId: string; url: string; publishedAt: string }
    velog?: { id: string; url: string; publishedAt: string }
  }
}

export interface Settings {
  tistory: {
    appId: string
    appSecret: string
    accessToken: string
    blogName: string
  }
  velog: {
    accessToken: string
    username: string
  }
}

interface StoreSchema {
  posts: Post[]
  settings: Settings
}

const defaultSettings: Settings = {
  tistory: { appId: '', appSecret: '', accessToken: '', blogName: '' },
  velog: { accessToken: '', username: '' }
}

export const store = new Store<StoreSchema>({
  defaults: {
    posts: [],
    settings: defaultSettings
  }
})

export function getAllPosts(): Post[] {
  return store.get('posts', [])
}

export function savePost(post: Post): void {
  const posts = getAllPosts()
  const idx = posts.findIndex((p) => p.id === post.id)
  if (idx >= 0) {
    posts[idx] = post
  } else {
    posts.unshift(post)
  }
  store.set('posts', posts)
}

export function deletePost(id: string): void {
  const posts = getAllPosts().filter((p) => p.id !== id)
  store.set('posts', posts)
}

export function getSettings(): Settings {
  return store.get('settings', defaultSettings)
}

export function saveSettings(settings: Settings): void {
  store.set('settings', settings)
}
