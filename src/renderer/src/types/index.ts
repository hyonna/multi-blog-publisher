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

export interface PublishResult {
  post: Post
  results: Record<string, { success: boolean; url?: string; error?: string }>
}

declare global {
  interface Window {
    electron: {
      post: {
        getAll: () => Promise<Post[]>
        save: (post: Partial<Post> & { content: string }) => Promise<Post>
        delete: (id: string) => Promise<void>
        publish: (id: string, platforms: string[]) => Promise<PublishResult>
      }
      settings: {
        get: () => Promise<Settings>
        save: (settings: Settings) => Promise<void>
      }
      tistory: {
        auth: (appId: string, appSecret: string) => Promise<string>
        getBlogs: (accessToken: string) => Promise<{ name: string; title: string }[]>
      }
    }
  }
}
