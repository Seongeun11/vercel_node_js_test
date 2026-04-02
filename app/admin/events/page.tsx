'use client'
//admin/events/page.tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredUser, hasRole } from '@/lib/auth'

type StoredUser = {
  id: string
  full_name: string
  student_id: string
  role: 'admin' | 'captain' | 'trainee'
}

type EventType = 'normal' | 'special'

export default function AdminEventsPage() {
  const router = useRouter()

  const [actor, setActor] = useState<StoredUser | null>(null)

  const [name, setName] = useState('')
  const [type, setType] = useState<EventType>('normal')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [lateThresholdMin, setLateThresholdMin] = useState('5')
  const [allowDuplicate, setAllowDuplicate] = useState(false)

  const [loading, setLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const savedUser = getStoredUser() as StoredUser | null

    if (!savedUser) {
      router.replace('/login')
      return
    }

    if (!hasRole(savedUser, ['admin'])) {
      alert('관리자만 접근할 수 있습니다.')
      router.replace('/')
      return
    }

    setActor(savedUser)

    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const mi = String(now.getMinutes()).padStart(2, '0')

    setStartDate(`${yyyy}-${mm}-${dd}`)
    setStartTime(`${hh}:${mi}`)
    setLoading(false)
  }, [router])

  const buildStartTime = () => {
    if (!startDate || !startTime) return ''
    return `${startDate}T${startTime}:00`
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

      if (!name.trim()) {
        setErrorMessage('이벤트명을 입력해주세요.')
        return
      }

      if (!startDate || !startTime) {
        setErrorMessage('시작 날짜와 시간을 입력해주세요.')
        return
      }

      const start_time = buildStartTime()

      const response = await fetch('/api/events/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor_user_id: actor.id,
          name: name.trim(),
          type,
          start_time,
          late_threshold_min: Number(lateThresholdMin),
          allow_duplicate: allowDuplicate,
        }),
      })

      const result =
        response.headers.get('content-type')?.includes('application/json')
          ? await response.json()
          : { error: '이벤트 생성 응답 형식이 올바르지 않습니다.' }

      if (!response.ok) {
        setErrorMessage(result.error || '이벤트 생성에 실패했습니다.')
        return
      }

      setMessage(result.message || '이벤트가 생성되었습니다.')

      // 생성 후 기본값 일부 초기화
      setName('')
      setType('normal')
      setLateThresholdMin('5')
      setAllowDuplicate(false)
    } catch (error) {
      console.error('이벤트 생성 실패:', error)
      setErrorMessage('이벤트 생성 중 오류가 발생했습니다.')
    } finally {
      setSubmitLoading(false)
    }
  }

  if (loading || !actor) {
    return <div style={{ padding: '20px' }}>로딩중...</div>
  }

  return (
    <div style={{ padding: '20px', maxWidth: '560px', margin: '0 auto' }}>
      <h2>이벤트 생성</h2>

      <p style={{ marginBottom: '20px' }}>
        관리자: {actor.full_name} ({actor.student_id})
      </p>

      <label style={{ display: 'block', marginBottom: '6px' }}>이벤트명</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="예: 수요 워크숍"
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '12px',
          boxSizing: 'border-box',
        }}
      />

      <label style={{ display: 'block', marginBottom: '6px' }}>이벤트 타입</label>
      <select
        value={type}
        onChange={(e) => setType(e.target.value as EventType)}
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '12px',
          boxSizing: 'border-box',
        }}
      >
        <option value="normal">normal</option>
        <option value="special">special</option>
      </select>

      <label style={{ display: 'block', marginBottom: '6px' }}>시작 날짜</label>
      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '12px',
          boxSizing: 'border-box',
        }}
      />

      <label style={{ display: 'block', marginBottom: '6px' }}>시작 시간</label>
      <input
        type="time"
        value={startTime}
        onChange={(e) => setStartTime(e.target.value)}
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '12px',
          boxSizing: 'border-box',
        }}
      />

      <label style={{ display: 'block', marginBottom: '6px' }}>지각 기준(분)</label>
      <input
        type="number"
        min="0"
        value={lateThresholdMin}
        onChange={(e) => setLateThresholdMin(e.target.value)}
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '12px',
          boxSizing: 'border-box',
        }}
      />

      <label style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
        <input
          type="checkbox"
          checked={allowDuplicate}
          onChange={(e) => setAllowDuplicate(e.target.checked)}
        />
        중복 출석 허용
      </label>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={handleSubmit} disabled={submitLoading}>
          {submitLoading ? '생성중...' : '이벤트 생성'}
        </button>

        <button onClick={() => router.push('/admin')}>관리자 페이지로</button>
        <button onClick={() => router.push('/')}>메인으로</button>
      </div>

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