import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from './stores/useStore'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { PublishBar } from './components/PublishBar'
import { SettingsModal } from './components/SettingsModal'
import { Post } from './types'

const AUTOSAVE_DELAY = 1500

export default function App(): React.ReactElement {
  const {
    posts,
    currentPostId,
    setPosts,
    setCurrentPostId,
    setSettings,
    updatePost,
    removePost,
    setIsSaving,
    setIsPublishing
  } = useStore()

  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [publishStatus, setPublishStatus] = useState<Record<string, { success: boolean; url?: string; error?: string }> | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentPostRef = useRef<Post | null>(null)

  const currentPost = posts.find((p) => p.id === currentPostId) ?? null

  useEffect(() => {
    async function init(): Promise<void> {
      const [allPosts, settings] = await Promise.all([
        window.electron.post.getAll(),
        window.electron.settings.get()
      ])
      setPosts(allPosts)
      setSettings(settings)
      if (allPosts.length > 0) {
        const first = allPosts[0]
        setCurrentPostId(first.id)
        setContent(first.content)
        setTags(first.tags)
        currentPostRef.current = first
      }
    }
    init().catch(console.error)
  }, [])

  useEffect(() => {
    if (currentPost) {
      setContent(currentPost.content)
      setTags(currentPost.tags)
      currentPostRef.current = currentPost
    }
  }, [currentPostId])

  const autoSave = useCallback(
    (newContent: string, newTags: string[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setIsSaving(false)

      saveTimer.current = setTimeout(async () => {
        setIsSaving(true)
        try {
          const existing = currentPostRef.current
          const saved = await window.electron.post.save({
            id: existing?.id,
            content: newContent,
            tags: newTags,
            createdAt: existing?.createdAt,
            publishedTo: existing?.publishedTo ?? {}
          })
          updatePost(saved)
          currentPostRef.current = saved
          if (!currentPostId) setCurrentPostId(saved.id)
        } finally {
          setIsSaving(false)
        }
      }, AUTOSAVE_DELAY)
    },
    [currentPostId]
  )

  function handleContentChange(value: string): void {
    setContent(value)
    autoSave(value, tags)
  }

  function handleTagsChange(newTags: string[]): void {
    setTags(newTags)
    autoSave(content, newTags)
  }

  function handleNewPost(): void {
    setCurrentPostId(null)
    setContent('')
    setTags([])
    setPublishStatus(null)
    currentPostRef.current = null
  }

  function handleSelectPost(id: string): void {
    setCurrentPostId(id)
    setPublishStatus(null)
    const post = posts.find((p) => p.id === id)
    if (post) {
      setContent(post.content)
      setTags(post.tags)
      currentPostRef.current = post
    }
  }

  async function handleDeletePost(id: string): Promise<void> {
    await window.electron.post.delete(id)
    removePost(id)
    if (currentPostId === id) {
      const remaining = posts.filter((p) => p.id !== id)
      if (remaining.length > 0) {
        handleSelectPost(remaining[0].id)
      } else {
        handleNewPost()
      }
    }
  }

  async function handlePublish(platforms: string[]): Promise<void> {
    if (!currentPostRef.current) return
    setIsPublishing(true)
    setPublishStatus(null)
    try {
      const { post, results } = await window.electron.post.publish(
        currentPostRef.current.id,
        platforms
      )
      updatePost(post)
      currentPostRef.current = post
      setPublishStatus(results)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setPublishStatus({ error: { success: false, error: msg } })
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          onNewPost={handleNewPost}
          onSelectPost={handleSelectPost}
          onDeletePost={handleDeletePost}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* macOS 타이틀바 공간 */}
          <div className="h-8 flex-shrink-0 flex items-center justify-center" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            {currentPost && (
              <span className="text-xs text-gray-400 select-none">{currentPost.title}</span>
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            <Editor content={content} onChange={handleContentChange} />
          </div>

          {publishStatus && (
            <div className="px-4 py-2 flex gap-3 flex-wrap border-t border-gray-100 bg-white">
              {Object.entries(publishStatus).map(([platform, result]) => (
                <span
                  key={platform}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                    result.success
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {platform === 'tistory' ? '티스토리' : platform === 'velog' ? '벨로그' : platform}:{' '}
                  {result.success ? (
                    <a href={result.url} target="_blank" rel="noreferrer" className="underline">
                      발행 완료 ↗
                    </a>
                  ) : (
                    result.error
                  )}
                </span>
              ))}
            </div>
          )}

          <PublishBar
            currentPost={currentPost}
            tags={tags}
            onTagsChange={handleTagsChange}
            onPublish={handlePublish}
            onOpenSettings={() => setShowSettings(true)}
          />
        </main>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
