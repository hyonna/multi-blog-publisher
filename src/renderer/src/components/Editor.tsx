import React, { useEffect, useRef } from 'react'
import MDEditor from '@uiw/react-md-editor'
import { useStore } from '../stores/useStore'

interface EditorProps {
  content: string
  onChange: (value: string) => void
}

export function Editor({ content, onChange }: EditorProps): React.ReactElement {
  const { isSaving } = useStore()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const styleEl = document.createElement('style')
    styleEl.textContent = `
      .w-md-editor { border: none !important; box-shadow: none !important; }
      .w-md-editor-toolbar { border-bottom: 1px solid #e5e7eb !important; background: #f9fafb !important; padding: 6px 12px !important; }
      .w-md-editor-content { background: #ffffff !important; }
      .w-md-editor-text-pre > code, .w-md-editor-text-input, .w-md-editor-text { font-size: 15px !important; line-height: 1.8 !important; font-family: 'JetBrains Mono', 'Fira Code', monospace !important; }
      .wmde-markdown { font-size: 15px !important; line-height: 1.8 !important; padding: 20px 32px !important; }
    `
    document.head.appendChild(styleEl)
    return () => styleEl.remove()
  }, [])

  const placeholder = `# 제목을 입력하세요

글 내용을 마크다운으로 작성하세요...

## 소제목

본문 내용을 자유롭게 작성해 보세요.

\`\`\`javascript
// 코드 블록도 사용할 수 있습니다
console.log('Hello, World!')
\`\`\`
`

  return (
    <div ref={containerRef} className="flex-1 flex flex-col h-full relative" data-color-mode="light">
      {isSaving && (
        <div className="absolute top-3 right-4 z-10 flex items-center gap-1.5 text-xs text-gray-400 bg-white px-2 py-1 rounded shadow-sm border border-gray-100">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          저장 중...
        </div>
      )}
      <MDEditor
        value={content || placeholder}
        onChange={(v) => onChange(v ?? '')}
        height="100%"
        visibleDragbar={false}
        preview="live"
        style={{ flex: 1, borderRadius: 0 }}
        textareaProps={{
          placeholder: '# 제목\n\n내용을 입력하세요...'
        }}
      />
    </div>
  )
}
