import { create } from 'zustand'
import { Post, Settings } from '../types'

interface AppState {
  posts: Post[]
  currentPostId: string | null
  settings: Settings | null
  isSaving: boolean
  isPublishing: boolean

  setPosts: (posts: Post[]) => void
  setCurrentPostId: (id: string | null) => void
  setSettings: (settings: Settings) => void
  updatePost: (post: Post) => void
  removePost: (id: string) => void
  setIsSaving: (v: boolean) => void
  setIsPublishing: (v: boolean) => void
}

const defaultSettings: Settings = {
  tistory: { appId: '', appSecret: '', accessToken: '', blogName: '' },
  velog: { accessToken: '', username: '' }
}

export const useStore = create<AppState>((set) => ({
  posts: [],
  currentPostId: null,
  settings: defaultSettings,
  isSaving: false,
  isPublishing: false,

  setPosts: (posts) => set({ posts }),
  setCurrentPostId: (id) => set({ currentPostId: id }),
  setSettings: (settings) => set({ settings }),
  updatePost: (post) =>
    set((s) => ({
      posts: s.posts.some((p) => p.id === post.id)
        ? s.posts.map((p) => (p.id === post.id ? post : p))
        : [post, ...s.posts]
    })),
  removePost: (id) =>
    set((s) => ({
      posts: s.posts.filter((p) => p.id !== id),
      currentPostId: s.currentPostId === id ? null : s.currentPostId
    })),
  setIsSaving: (v) => set({ isSaving: v }),
  setIsPublishing: (v) => set({ isPublishing: v })
}))
