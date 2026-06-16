import React, { useState, useEffect } from 'react'
import { Settings } from '../types'
import { useStore } from '../stores/useStore'

interface SettingsModalProps {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps): React.ReactElement {
  const { settings, setSettings } = useStore()
  const [form, setForm] = useState<Settings>(
    settings ?? {
      tistory: { appId: '', appSecret: '', accessToken: '', blogName: '' },
      velog: { accessToken: '', username: '' }
    }
  )
  const [activeTab, setActiveTab] = useState<'tistory' | 'velog'>('tistory')
  const [tistoryStatus, setTistoryStatus] = useState<string>('')
  const [blogs, setBlogs] = useState<{ name: string; title: string }[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  async function handleTistoryAuth(): Promise<void> {
    if (!form.tistory.appId || !form.tistory.appSecret) {
      setTistoryStatus('App ID와 App Secret을 먼저 입력해주세요.')
      return
    }
    setTistoryStatus('인증 창이 열렸습니다...')
    try {
      const token = await window.electron.tistory.auth(form.tistory.appId, form.tistory.appSecret)
      const blogList = await window.electron.tistory.getBlogs(token)
      setBlogs(blogList)
      setForm((f) => ({
        ...f,
        tistory: {
          ...f.tistory,
          accessToken: token,
          blogName: blogList[0]?.name ?? ''
        }
      }))
      setTistoryStatus('인증 성공!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setTistoryStatus(`오류: ${msg}`)
    }
  }

  async function handleSave(): Promise<void> {
    setIsSaving(true)
    try {
      await window.electron.settings.save(form)
      setSettings(form)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">플랫폼 설정</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-gray-100">
          {(['tistory', 'velog'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'tistory' ? '티스토리' : '벨로그'}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {activeTab === 'tistory' && (
            <>
              <p className="text-xs text-gray-500 bg-orange-50 border border-orange-100 rounded-lg p-3">
                <strong>설정 방법:</strong> tistory.com/guide/api/manage/register 에서 앱을 등록하고
                App ID와 Secret Key를 입력한 후 OAuth 인증을 진행하세요.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">App ID</label>
                <input
                  type="text"
                  value={form.tistory.appId}
                  onChange={(e) => setForm((f) => ({ ...f, tistory: { ...f.tistory, appId: e.target.value } }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Tistory App ID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">App Secret Key</label>
                <input
                  type="password"
                  value={form.tistory.appSecret}
                  onChange={(e) => setForm((f) => ({ ...f, tistory: { ...f.tistory, appSecret: e.target.value } }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Secret Key"
                />
              </div>

              <button
                onClick={handleTistoryAuth}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                OAuth 인증하기
              </button>

              {tistoryStatus && (
                <p className={`text-xs px-3 py-2 rounded-lg ${tistoryStatus.startsWith('오류') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  {tistoryStatus}
                </p>
              )}

              {form.tistory.accessToken && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">블로그 선택</label>
                  <select
                    value={form.tistory.blogName}
                    onChange={(e) => setForm((f) => ({ ...f, tistory: { ...f.tistory, blogName: e.target.value } }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {blogs.map((b) => (
                      <option key={b.name} value={b.name}>{b.title} ({b.name})</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {activeTab === 'velog' && (
            <>
              <p className="text-xs text-gray-500 bg-teal-50 border border-teal-100 rounded-lg p-3">
                <strong>토큰 가져오는 방법:</strong><br />
                1. velog.io에 로그인<br />
                2. 개발자 도구(F12) → Application → Cookies → velog.io<br />
                3. <code className="bg-teal-100 px-1 rounded">user_access_token</code> 값을 복사해서 붙여넣기
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">벨로그 사용자명</label>
                <input
                  type="text"
                  value={form.velog.username}
                  onChange={(e) => setForm((f) => ({ ...f, velog: { ...f.velog, username: e.target.value } }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="velog.io/@username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
                <textarea
                  value={form.velog.accessToken}
                  onChange={(e) => setForm((f) => ({ ...f, velog: { ...f.velog, accessToken: e.target.value } }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                  rows={3}
                  placeholder="user_access_token 값 붙여넣기"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
