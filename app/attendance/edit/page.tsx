'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { fetchSessionUser, hasRole } from '@/lib/auth'

type AttendanceStatus = 'present' | 'late' | 'absent'

type StoredUser = {
  id: string
  full_name: string
  student_id: string
  role: 'admin' | 'captain' | 'trainee'
}

type UserItem = {
  id: string
  full_name: string
  student_id: string
  role: string
}

type EventItem = {
  id: string
  name: string
  start_time: string
  late_threshold_min: number
}

type AttendanceItem = {
  id: string
  user_id: string
  event_id: string
  date: string
  status: AttendanceStatus
  check_time: string | null
  method: string | null
  created_at?: string | null
}

type JsonResponse<T> = T & {
  error?: string
}

export default function AttendanceEditPage() {
  const router = useRouter()

  const [actor, setActor] = useState<StoredUser | null>(null)

  const [users, setUsers] = useState<UserItem[]>([])
  const [events, setEvents] = useState<EventItem[]>([])

  const [targetUserId, setTargetUserId] = useState('')
  const [eventId, setEventId] = useState('')
  const [date, setDate] = useState('')
  const [status, setStatus] = useState<AttendanceStatus>('present')
  //출석상태
  const [currentAttendance, setCurrentAttendance] = useState<AttendanceItem | null>(null)
  //페이지 로딩
  const [pageLoading, setPageLoading] = useState(true)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  //에러메세지
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  //검색기능 추가
  const [userSearchText, setUserSearchText] = useState('')
  const [eventSearchText, setEventSearchText] = useState('')

  useEffect(() => {
    const loadUser = async () => {
      const savedUser = await fetchSessionUser() as StoredUser | null

      if (!savedUser) {
        router.replace('/login')
        return
      }

      if (!hasRole(savedUser, ['admin', 'captain'])) {
        alert('캡틴 이상만 접근할 수 있습니다.')
        router.replace('/')
        return
      }

      setActor(savedUser)

      const todayKST = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date())

      setDate(todayKST)
      setPageLoading(false)
    }

    loadUser()
  }, [router])

  useEffect(() => {
    if (!actor?.id) return

    const fetchOptions = async () => {
      try {
        setOptionsLoading(true)
        setErrorMessage('')
        setMessage('')

        const [usersRes, eventsRes] = await Promise.all([
          fetch('/api/profiles/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }),
          fetch('/api/events/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }),
        ])

        const usersResult: JsonResponse<{ users: UserItem[] }> =
          usersRes.headers.get('content-type')?.includes('application/json')
            ? await usersRes.json()
            : { users: [], error: '사용자 목록 응답 형식이 올바르지 않습니다.' }

        const eventsResult: JsonResponse<{ events: EventItem[] }> =
          eventsRes.headers.get('content-type')?.includes('application/json')
            ? await eventsRes.json()
            : { events: [], error: '이벤트 목록 응답 형식이 올바르지 않습니다.' }

        if (!usersRes.ok) {
          setErrorMessage(usersResult.error || '사용자 목록을 불러오지 못했습니다.')
          return
        }

        if (!eventsRes.ok) {
          setErrorMessage(eventsResult.error || '이벤트 목록을 불러오지 못했습니다.')
          return
        }

        const fetchedUsers = usersResult.users || []
        const fetchedEvents = eventsResult.events || []

        setUsers(fetchedUsers)
        setEvents(fetchedEvents)

        if (fetchedUsers.length > 0) {
          setTargetUserId((prev) => prev || fetchedUsers[0].id)
        }

        if (fetchedEvents.length > 0) {
          setEventId((prev) => prev || fetchedEvents[0].id)
        }

        if (fetchedUsers.length === 0) {
          setErrorMessage('수정 가능한 사용자 목록이 없습니다.')
        } else if (fetchedEvents.length === 0) {
          setErrorMessage('선택 가능한 이벤트가 없습니다.')
        }
      } catch (error) {
        console.error('목록 조회 실패:', error)
        setErrorMessage('목록을 불러오는 중 오류가 발생했습니다.')
      } finally {
        setOptionsLoading(false)
      }
    }

    fetchOptions()
  }, [actor])

  useEffect(() => {
    if (!actor?.id || !targetUserId || !eventId || !date) {
      setCurrentAttendance(null)
      return
    }

    const fetchAttendanceDetail = async () => {
      try {
        setDetailLoading(true)
        setErrorMessage('')
        setMessage('')

        const response = await fetch('/api/attendance/detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
                        target_user_id: targetUserId,
            event_id: eventId,
            date,
          }),
        })

        const result: JsonResponse<{ attendance: AttendanceItem | null }> =
          response.headers.get('content-type')?.includes('application/json')
            ? await response.json()
            : { attendance: null, error: '출석 상세 응답 형식이 올바르지 않습니다.' }

        if (!response.ok) {
          setCurrentAttendance(null)
          setErrorMessage(result.error || '현재 출석 상태를 불러오지 못했습니다.')
          return
        }

        const foundAttendance = result.attendance ?? null
        setCurrentAttendance(foundAttendance)

        // 기존 기록이 있으면 상태 자동 반영, 없으면 기본값으로 복귀
        if (foundAttendance?.status) {
          setStatus(foundAttendance.status)
        } else {
          setStatus('present')
        }
      } catch (error) {
        console.error('출석 상세 조회 실패:', error)
        setCurrentAttendance(null)
        setErrorMessage('현재 출석 상태 조회 중 오류가 발생했습니다.')
      } finally {
        setDetailLoading(false)
      }
    }

    fetchAttendanceDetail()
  }, [actor, targetUserId, eventId, date])

  const filteredUsers = useMemo(() => {
  const keyword = userSearchText.trim().toLowerCase()

  if (!keyword) return users

  return users.filter((item) => {
    const fullName = item.full_name?.toLowerCase() || ''
    const studentId = item.student_id?.toLowerCase() || ''
    const role = item.role?.toLowerCase() || ''

    return (
      fullName.includes(keyword) ||
      studentId.includes(keyword) ||
      role.includes(keyword)
    )
  })
}, [users, userSearchText])

//검색상태 기능
const filteredEvents = useMemo(() => {
  const keyword = eventSearchText.trim().toLowerCase()

  if (!keyword) return events

  return events.filter((item) => {
    const name = item.name?.toLowerCase() || ''
    const startTime = item.start_time?.toLowerCase() || ''

    return (
      name.includes(keyword) ||
      startTime.includes(keyword)
    )
  })
}, [events, eventSearchText])

//검색 결과가 없으면 첫번째 항목 자동선탣
useEffect(() => {
  if (filteredUsers.length === 0) {
    setTargetUserId('')
    return
  }

  const isSelectedUserVisible = filteredUsers.some((item) => item.id === targetUserId)

  if (!isSelectedUserVisible) {
    setTargetUserId(filteredUsers[0].id)
  }
}, [filteredUsers, targetUserId])

useEffect(() => {
  if (filteredEvents.length === 0) {
    setEventId('')
    return
  }

  const isSelectedEventVisible = filteredEvents.some((item) => item.id === eventId)

  if (!isSelectedEventVisible) {
    setEventId(filteredEvents[0].id)
  }
}, [filteredEvents, eventId])

  const formatEventDateTime = (value: string) => {
    try {
      return new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(value))
    } catch {
      return value
    }
  }

  const formatCheckTime = (value: string | null | undefined) => {
    if (!value) return '-'

    try {
      return new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date(value))
    } catch {
      return value
    }
  }

  const handleSubmit = async () => {
    try {
      setSubmitLoading(true)
      setErrorMessage('')
      setMessage('')

      if (!actor?.id) {
        setErrorMessage('로그인이 필요합니다.')
        return
      }

      if (!targetUserId) {
        setErrorMessage('사용자 아이디 없음: 사용자를 선택해주세요.')
        return
      }

      if (!eventId) {
        setErrorMessage('이벤트아이디 없음: 이벤트를 선택해주세요.')
        return
      }

      if (!date) {
        setErrorMessage('출석 날짜를 선택해주세요.')
        return
      }

      if (!status) {
        setErrorMessage('출석 상태를 선택해주세요.')
        return
      }

      const response = await fetch('/api/attendance/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
                    target_user_id: targetUserId,
          event_id: eventId,
          date,
          status,
          method: 'manual',
        }),
      })

      const result =
        response.headers.get('content-type')?.includes('application/json')
          ? await response.json()
          : { error: '출석 수정 응답 형식이 올바르지 않습니다.' }

      if (!response.ok) {
        setErrorMessage(result.error || '출석 수정에 실패했습니다.')
        return
      }

      setMessage(result.message || '출석 수정이 완료되었습니다.')

      // 저장 후 최신 상태 다시 조회
      const detailResponse = await fetch('/api/attendance/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
                    target_user_id: targetUserId,
          event_id: eventId,
          date,
        }),
      })

      const detailResult =
        detailResponse.headers.get('content-type')?.includes('application/json')
          ? await detailResponse.json()
          : { attendance: null }

      if (detailResponse.ok) {
        setCurrentAttendance(detailResult.attendance ?? null)
      }
    } catch (error) {
      console.error('출석 수정 실패:', error)
      setErrorMessage('출석 수정 중 오류가 발생했습니다.')
    } finally {
      setSubmitLoading(false)
    }
  }

  if (pageLoading) {
    return <div style={{ padding: '20px' }}>로딩중...</div>
  }

  return (
    <div style={{ padding: '20px', maxWidth: '560px', margin: '0 auto' }}>
      <h2>출석 수정</h2>

      {actor && (
        <p style={{ marginBottom: '20px' }}>
          수정자: {actor.full_name} ({actor.student_id}) / 권한: {actor.role}
        </p>
      )}
      
      <label style={{ display: 'block', marginBottom: '6px' }}>사용자 검색</label>
      <input
        type="text"
        placeholder="이름, 학번, role 검색"
        value={userSearchText}
        onChange={(e) => setUserSearchText(e.target.value)}
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '12px',
          boxSizing: 'border-box',
        }}
      />
      <label style={{ display: 'block', marginBottom: '6px' }}>수정 대상 사용자</label>
      <select
        value={targetUserId}
        onChange={(e) => setTargetUserId(e.target.value)}
        disabled={optionsLoading || filteredUsers.length === 0}
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '12px',
          boxSizing: 'border-box',
        }}
      >
        {filteredUsers.length === 0 ? (
          <option value="">사용자 없음</option>
        ) : (
          filteredUsers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.full_name} ({item.student_id}) / {item.role}
            </option>
          ))
        )}
      </select>
      <label style={{ display: 'block', marginBottom: '6px' }}>이벤트 검색</label>
      <input
        type="text"
        placeholder="이벤트명 검색"
        value={eventSearchText}
        onChange={(e) => setEventSearchText(e.target.value)}
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '12px',
          boxSizing: 'border-box',
        }}
      />
      <label style={{ display: 'block', marginBottom: '6px' }}>이벤트 선택</label>
      <select
        value={eventId}
        onChange={(e) => setEventId(e.target.value)}
        disabled={optionsLoading || filteredEvents.length === 0}
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '12px',
          boxSizing: 'border-box',
        }}
      >
        {filteredEvents.length === 0 ? (
          <option value="">이벤트 없음</option>
        ) : (
          filteredEvents.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} / {formatEventDateTime(item.start_time)}
            </option>
          ))
        )}
      </select>

      <label style={{ display: 'block', marginBottom: '6px' }}>출석 날짜</label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '12px',
          boxSizing: 'border-box',
        }}
      />

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '12px',
          backgroundColor: '#fafafa',
        }}
      >
        <strong>현재 출석 상태</strong>

        {detailLoading ? (
          <p style={{ marginTop: '8px' }}>조회 중...</p>
        ) : currentAttendance ? (
          <div style={{ marginTop: '8px', lineHeight: 1.8 }}>
            <div>상태: {currentAttendance.status}</div>
            <div>체크 시간: {formatCheckTime(currentAttendance.check_time)}</div>
            <div>체크 방식: {currentAttendance.method || '-'}</div>
            <div>출석 날짜: {currentAttendance.date}</div>
          </div>
        ) : (
          <p style={{ marginTop: '8px' }}>기존 출석 기록이 없습니다.</p>
        )}
      </div>

      <label style={{ display: 'block', marginBottom: '6px' }}>변경할 출석 상태</label>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '12px',
          boxSizing: 'border-box',
        }}
      >
        <option value="present">출석</option>
        <option value="late">지각</option>
        <option value="absent">결석</option>
      </select>

      <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={handleSubmit}
          disabled={
            submitLoading ||
            optionsLoading ||
            detailLoading ||
            !targetUserId ||
            !eventId ||
            !date
          }
        >
          {submitLoading ? '처리중...' : '수정 저장'}
        </button>

        <button onClick={() => router.push('/')}>메인으로</button>
      </div>

      {optionsLoading && (
        <p style={{ marginTop: '16px' }}>목록을 불러오는 중입니다...</p>
      )}

      {message && (
        <p style={{ color: 'green', marginTop: '16px' }}>
          ✅ {message}
        </p>
      )}

      {errorMessage && (
        <p style={{ color: 'crimson', marginTop: '16px' }}>
          ⚠️ {errorMessage}
        </p>
      )}
    </div>
  )
}