//app\admin\admin-only\users\enrollment-status.tsx
'use client'

import { useState } from 'react'
import { AdminUser } from '../hooks/use-admin-users' // 💡 공용 타입으로 일치화

type EnrollmentStatus = 'active' | 'completed'
type UserRole = {
  id: number
  name: string
}


type Props = {
  user: AdminUser
  onUpdated: (user: AdminUser) => void
}

type UpdateResponse = {
  ok?: boolean
  message?: string
  user?: AdminUser
  error?: string | object // 💡 백엔드가 객체로 줄 수도 있으므로 타입을 유연하게 확장
  field_errors?: {
    enrollment_status?: string[]
    
  }
}

export default function EnrollmentStatusToggle({ user, onUpdated }: Props) {
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<any>('') // 💡 객체도 담을 수 있도록 임시 허용

  async function handleChange(nextStatus: EnrollmentStatus) {
    setErrorMessage('')

    if (nextStatus === user.enrollment_status) return

    try {
      setLoading(true)

      const response = await fetch('/api/admin/users/update-enrollment-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: user.id,
          enrollment_status: nextStatus,
        }),
      })

      const text = await response.text()
      const result = text ? (JSON.parse(text) as UpdateResponse) : {}
      
      // 💡 [체크 포인트 1] 콘솔창에서 백엔드가 준 진짜 데이터 구조를 확인하는 용도야!
      console.log('[EnrollmentStatusToggle] API Raw Result:', result)

      if (!response.ok) {
        const fieldError = result.field_errors?.enrollment_status?.[0]

        // result.error가 객체({id, name})여도 그대로 state에 저장해둠 (아래 JSX에서 처리할 예정)
        setErrorMessage(
          fieldError || result.error || '상태 변경에 실패했습니다.'
        )
        return
      }

      if (result.user) {
        onUpdated(result.user)
      }
    } catch (error) {
      console.error('[EnrollmentStatusToggle] update error:', error)
      setErrorMessage('상태 변경 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <select
        value={user.enrollment_status}
        disabled={loading}
        onChange={(event) =>
          handleChange(event.target.value as EnrollmentStatus)
        }
        style={{ padding: '6px' }}
      >
        <option value="active">재학</option>
        <option value="completed">수료</option>
      </select>

      {/* 💡 [체크 포인트 2] 화면이 뻗지 않도록 여기서 확실하게 타입을 체크해 줘 */}
      {errorMessage && (
        <p style={{ color: 'red', margin: '6px 0 0', fontSize: '12px' }}>
          {typeof errorMessage === 'object'
            ? `[에러 객체]: ${JSON.stringify(errorMessage)}`
            : errorMessage}
        </p>
      )}
    </div>
  )
}