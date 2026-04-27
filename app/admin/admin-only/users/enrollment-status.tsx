'use client'

import { useState } from 'react'

type EnrollmentStatus = 'active' | 'completed'

type AdminUser = {
  id: string
  student_id: string
  full_name: string
  enrollment_status: EnrollmentStatus
}

type Props = {
  user: AdminUser
  onUpdated: (user: AdminUser) => void
}

type UpdateResponse = {
  ok?: boolean
  message?: string
  user?: AdminUser
  error?: string
  field_errors?: {
    enrollment_status?: string[]
  }
}

export default function EnrollmentStatusToggle({ user, onUpdated }: Props) {
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

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

      if (!response.ok) {
        const fieldError = result.field_errors?.enrollment_status?.[0]

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

      {errorMessage && (
        <p style={{ color: 'red', margin: '6px 0 0', fontSize: '12px' }}>
          {errorMessage}
        </p>
      )}
    </div>
  )
}