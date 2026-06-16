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
      tistory: { blogName: '', cookies: '' },
      velog: { accessToken: '', username: '' }
    }
  )
  const [activeTab, setActiveTab] = useState<'tistory' | 'velog'>('tistory')
  const [tistoryStatus, setTistoryStatus] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  const isTistoryLoggedIn = !!form.tistory.cookies

  async function handleTistoryLogin(): Promise<void> {
    setTistoryStatus('로그인 창을 열고 있습니다...')
    try {
      const { blogName, cookies } = await window.electron.tistory.login()
      setForm((f) => ({
        ...f,
        tistory: {
          blogName: blogName || f.tistory.blogName,
          cookies
        }
      }))
      setTistoryStatus('로그인 성공! 저장 버튼을 눌러 완료하세요.')
    } catch (err: unknown) {
      setTistoryStatus(`오류: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  function handleTistoryLogout(): void {
    setForm((f) => ({ ...f, tistory: { blogName: '', cookies: '' } }))
    setTistoryStatus('')
  }

  async function handleSave(): Promise<void> {
    setSaveError('')
    setIsSaving(true)
    try {
      await window.electron.settings.save(form)
      setSettings(form)
      onClose()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : String(err))
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
              {isTistoryLoggedIn ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-800">로그인됨</p>
                    {form.tistory.blogName && (
                      <p className="text-xs text-green-600 mt-0.5">
                        {form.tistory.blogName}.tistory.com
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleTistoryLogout}
                    className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    로그아웃
                  </button>
                </div>
              ) : (
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-3">
                  <p className="text-xs text-gray-600">
                    티스토리 Open API가 종료되어 브라우저 자동화 방식으로 글을 발행합니다.
                    아래 버튼을 눌러 티스토리에 로그인하세요.
                  </p>
                  <button
                    onClick={handleTistoryLogin}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    티스토리 로그인
                  </button>
                </div>
              )}

              {tistoryStatus && (
                <p className={`text-xs px-3 py-2 rounded-lg ${
                  tistoryStatus.startsWith('오류')
                    ? 'bg-red-50 text-red-600 border border-red-100'
                    : 'bg-blue-50 text-blue-600 border border-blue-100'
                }`}>
                  {tistoryStatus}
                </p>
              )}

              {isTistoryLoggedIn && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">블로그 이름</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={form.tistory.blogName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, tistory: { ...f.tistory, blogName: e.target.value } }))
                      }
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="myblog (myblog.tistory.com)"
                    />
                    <span className="text-sm text-gray-400 flex-shrink-0">.tistory.com</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    글쓰기 창이 열리면 내용을 확인 후 직접 발행 버튼을 눌러주세요.
                  </p>
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
                3. <code className="bg-teal-100 px-1 rounded">access_token</code>과 <code className="bg-teal-100 px-1 rounded">refresh_token</code> 값을 각각 복사
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  사용자명
                  <span className="text-xs font-normal text-gray-400 ml-1">(표시용, 발행에 영향 없음)</span>
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-400">@</span>
                  <input
                    type="text"
                    value={form.velog.username}
                    onChange={(e) => setForm((f) => ({ ...f, velog: { ...f.velog, username: e.target.value.replace(/^@/, '').replace(/^velog\.io\/@?/, '') } }))}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="mocosssiii"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  access_token
                  <span className="text-xs font-normal text-gray-400 ml-1">(24시간마다 갱신 필요)</span>
                </label>
                <textarea
                  value={form.velog.accessToken}
                  onChange={(e) => setForm((f) => ({ ...f, velog: { ...f.velog, accessToken: e.target.value.trim() } }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                  rows={2}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  refresh_token
                  <span className="text-xs font-normal text-gray-400 ml-1">(30일 유효)</span>
                </label>
                <textarea
                  value={form.velog.refreshToken}
                  onChange={(e) => setForm((f) => ({ ...f, velog: { ...f.velog, refreshToken: e.target.value.trim() } }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                  rows={2}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                />
              </div>
            </>
          )}
        </div>

        {saveError && (
          <div className="mx-5 mb-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            저장 실패: {saveError}
          </div>
        )}

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
