import React from 'react'
import { useStore } from '../stores/useStore'
import { Post } from '../types'

interface SidebarProps {
  onNewPost: () => void
  onSelectPost: (id: string) => void
  onDeletePost: (id: string) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric'
  })
}

function getPlatformBadges(post: Post): React.ReactNode {
  return (
    <div className="flex gap-1 mt-1">
      {post.publishedTo.tistory && (
        <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-medium">
          T
        </span>
      )}
      {post.publishedTo.velog && (
        <span className="text-[10px] bg-teal-100 text-teal-600 px-1.5 py-0.5 rounded font-medium">
          V
        </span>
      )}
    </div>
  )
}

export function Sidebar({ onNewPost, onSelectPost, onDeletePost }: SidebarProps): React.ReactElement {
  const { posts, currentPostId } = useStore()

  return (
    <aside className="w-60 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 pt-10">
        <button
          onClick={onNewPost}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새 글 작성
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {posts.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm mt-4">
            <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            작성된 글이 없습니다
          </div>
        ) : (
          <ul className="py-2">
            {posts.map((post) => (
              <li key={post.id}>
                <button
                  onClick={() => onSelectPost(post.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors group relative ${
                    currentPostId === post.id ? 'bg-indigo-50 border-r-2 border-indigo-500' : ''
                  }`}
                >
                  <div className={`text-sm font-medium truncate ${currentPostId === post.id ? 'text-indigo-700' : 'text-gray-800'}`}>
                    {post.title}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-gray-400">{formatDate(post.updatedAt)}</span>
                    {getPlatformBadges(post)}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`"${post.title}" 글을 삭제할까요?`)) {
                        onDeletePost(post.id)
                      }
                    }}
                    className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-400 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
