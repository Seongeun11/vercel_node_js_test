//app\admin\admin-only\notion-sync\page.tsx
'use client'

import { useState, useEffect } from 'react'

type Profile = {
  id: string
  full_name: string
  student_id: string
}

type EventItem = {
  id: string
  name: string
}

export default function NotionSyncAdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  
  // 선택된 폼 상태
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  
  // 상태 관리
  const [loading, setLoading] = useState<boolean>(false)
  const [fetchingInitial, setFetchingInitial] = useState<boolean>(true)
  const [logResult, setLogResult] = useState<{
    success?: boolean
    synced?: boolean
    message?: string
    error?: string
  } | null>(null)

  // 1. 기초 데이터 (학생 목록 및 이벤트 목록) 로드
  useEffect(() => {
    async function fetchInitialData() {
      try {
        setFetchingInitial(true)
        
        // Active 상태의 학생 목록 조회
        const profilesRes = await fetch('/api/profiles/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' }),
        })
        const profilesData = await profilesRes.json()

        // 이벤트 목록 조회
        const eventsRes = await fetch('/api/events/list')
        const eventsData = await eventsRes.json()

        if (profilesData.users) setProfiles(profilesData.users)
        if (eventsData.items) setEvents(eventsData.items)
      } catch (err) {
        console.error('기초 데이터 로딩 실패:', err)
      } finally {
        setFetchingInitial(false)
      }
    }

    fetchInitialData()
  }, [])

  // 2. 수동 노션 동기화 API 호출 핸들러
  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId || !selectedEventId) {
      alert('학생과 이벤트를 모두 선택해 주세요.')
      return
    }

    setLoading(true)
    setLogResult(null)

    try {
      const response = await fetch('/api/notion-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: selectedUserId,
          event_id: selectedEventId,
        }),
      })

      const data = await response.json()
      setLogResult(data)
    } catch (err: any) {
      setLogResult({
        success: false,
        error: err.message || '동기화 요청 중 네트워크 오류가 발생했습니다.',
      })
    } finally {
      setLoading(false)
    }
  }

  if (fetchingInitial) {
    return (
      <div className="p-8 text-center text-gray-500">
        관리자 노션 연동 데이터를 불러오는 중입니다...
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* 헤더 영역 */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-900">노션(Notion) 출석 동기화 관리</h1>
        <p className="text-sm text-gray-600 mt-1">
          Supabase의 출석 데이터를 노션 데이터베이스로 수동 전송하거나 동기화 상태를 점검합니다.
        </p>
      </div>

      {/* 동기화 수동 실행 폼 */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">단일 출석 건 수동 동기화</h2>
        <form onSubmit={handleSync} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 학생 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                대상 학생 (Active 수강생만 표시)
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">-- 학생 선택 --</option>
                {profiles.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.student_id})
                  </option>
                ))}
              </select>
            </div>

            {/* 이벤트 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                대상 이벤트 / 수업
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">-- 이벤트 선택 --</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-md transition-colors disabled:bg-gray-400"
            >
              {loading ? '노션 동기화 진행 중...' : '노션으로 즉시 동기화 실행'}
            </button>
          </div>
        </form>
      </div>

      {/* 실행 결과 및 로그 리포트 */}
      {logResult && (
        <div
          className={`p-4 rounded-lg border ${
            logResult.error
              ? 'bg-red-50 border-red-200 text-red-800'
              : logResult.synced === false
              ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
              : 'bg-green-50 border-green-200 text-green-800'
          }`}
        >
          <h3 className="font-semibold text-base mb-1">동기화 처리 결과</h3>
          {logResult.error && <p className="text-sm">❌ 에러: {logResult.error}</p>}
          {logResult.message && <p className="text-sm">ℹ️ 안내: {logResult.message}</p>}
          {logResult.synced && (
            <p className="text-sm">
              ✅ 성공: 노션 DB에 정상적으로 반영되었습니다.
            </p>
          )}
        </div>
      )}
    </div>
  )
}