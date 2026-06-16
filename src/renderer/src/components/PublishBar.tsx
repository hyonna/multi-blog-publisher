import React, { useState } from 'react'
import { useStore } from '../stores/useStore'
import { Post } from '../types'

interface PublishBarProps {
  currentPost: Post | null
  tags: string[]
  onTagsChange: (tags: string[]) => void
  onPublish: (platforms: string[]) => Promise<void>
  onOpenSettings: () => void
}

export function PublishBar({
  currentPost,
  tags,
  onTagsChange,
  onPublish,
  onOpenSettings
}: PublishBarProps): React.ReactElement {
  const { settings, isPublishing } = useStore()
  const [platforms, setPlatforms] = useState<Record<string, boolean>>({
    tistory: true,
    velog: true
  })
  const [tagInput, setTagInput] = useState('')
  const [publishResult, setPublishResult] = useState<Record<string, { success: boolean; url?: string; error?: string }> | null>(null)

  const hasTistory = !!settings?.tistory.accessToken
  const hasVelog = !!settings?.velog.accessToken

  function togglePlatform(p: string): void {
    setPlatforms((prev) => ({ ...prev, [p]: !prev[p] }))
  }

  function addTag(e: React.KeyboardEvent<HTMLInputElement>): void {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault()
      const tag = tagInput.trim().replace(/^,/, '')
      if (tag && !tags.includes(tag)) {
        onTagsChange([...tags, tag])
      }
      setTagInput('')
    }
  }

  function removeTag(tag: string): void {
    onTagsChange(tags.filter((t) => t !== tag))
  }

  async function handlePublish(): Promise<void> {
    const selected = Object.entries(platforms)
      .filter(([, v]) => v)
      .map(([k]) => k)

    if (selected.length === 0) return

    setPublishResult(null)
    await onPublish(selected)
  }

  const selectedPlatforms = Object.entries(platforms).filter(([, v]) => v).map(([k]) => k)
  const canPublish = currentPost && selectedPlatforms.length > 0 && !isPublishing

  return (
    <footer className="border-t border-gray-200 bg-white px-4 py-3 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500">발행 대상</span>

        <button
          onClick={() => togglePlatform('tistory')}
          disabled={!hasTistory}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
            platforms.tistory && hasTistory
              ? 'bg-orange-500 border-orange-500 text-white'
              : hasTistory
              ? 'border-gray-300 text-gray-500 hover:border-orange-400'
              : 'border-gray-200 text-gray-300 cursor-not-allowed'
          }`}
          title={!hasTistory ? '설정에서 티스토리 계정을 연결해주세요' : undefined}
        >
          <span>티스토리</span>
          {!hasTistory && <span className="text-[10px]">미연결</span>}
          {currentPost?.publishedTo.tistory && <span className="text-[10px] opacity-75">✓발행됨</span>}
        </button>

        <button
          onClick={() => togglePlatform('velog')}
          disabled={!hasVelog}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
            platforms.velog && hasVelog
              ? 'bg-teal-500 border-teal-500 text-white'
              : hasVelog
              ? 'border-gray-300 text-gray-500 hover:border-teal-400'
              : 'border-gray-200 text-gray-300 cursor-not-allowed'
          }`}
          title={!hasVelog ? '설정에서 벨로그 계정을 연결해주세요' : undefined}
        >
          <span>벨로그</span>
          {!hasVelog && <span className="text-[10px]">미연결</span>}
          {currentPost?.publishedTo.velog && <span className="text-[10px] opacity-75">✓발행됨</span>}
        </button>
      </div>

      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-xs font-medium text-gray-500 flex-shrink-0">태그</span>
        <div className="flex items-center gap-1 flex-wrap min-w-0">
          {tags.map((tag) => (
            <span key={tag} className="flex items-center gap-0.5 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:text-red-500 ml-0.5">×</button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={addTag}
            placeholder="태그 입력 후 Enter"
            className="text-xs border-none outline-none bg-transparent text-gray-600 placeholder-gray-300 min-w-[100px]"
          />
        </div>
      </div>

      {publishResult && (
        <div className="flex items-center gap-2">
          {Object.entries(publishResult).map(([platform, result]) => (
            <span key={platform} className={`text-xs px-2 py-1 rounded-full ${result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {platform}: {result.success ? (
                <a href={result.url} target="_blank" rel="noreferrer" className="underline">발행 완료 ↗</a>
              ) : result.error}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onOpenSettings}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
          title="설정"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <button
          onClick={async () => {
            const result = await (async () => {
              await handlePublish()
            })()
            void result
          }}
          disabled={!canPublish}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            canPublish
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isPublishing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              발행 중...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              발행하기
            </>
          )}
        </button>
      </div>
    </footer>
  )
}
