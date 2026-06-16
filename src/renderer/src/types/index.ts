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
    blogName: string
    cookies: string
  }
  velog: {
    accessToken: string
    refreshToken: string
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
        login: () => Promise<{ blogName: string; cookies: string }>
      }
    }
  }
}
