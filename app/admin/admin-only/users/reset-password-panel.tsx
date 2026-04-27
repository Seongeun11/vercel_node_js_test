'use client'

import { useState } from 'react'

type AdminUser = {
  id: string
  student_id: string
  full_name: string
}

type ResetPasswordPanelProps = {
  user: AdminUser
  onCancel: () => void
  onSuccess?: () => void
}

type ResetPasswordResponse = {
  ok?: boolean
  message?: string
  error?: string
  field_errors?: {
    password?: string[]
  }
}

export default function ResetPasswordPanel({
  user,
  onCancel,
  onSuccess,
}: ResetPasswordPanelProps) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleResetPassword() {
    setMessage('')
    setErrorMessage('')

    const normalizedPassword = password.trim()

    if (!normalizedPassword) {
      setErrorMessage('새 비밀번호를 입력해주세요.')
      return
    }

    try {
      setLoading(true)

      const response = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: user.id,
          password: normalizedPassword,
        }),
      })

      const text = await response.text()
      const result = text ? (JSON.parse(text) as ResetPasswordResponse) : {}

      if (!response.ok) {
        const passwordErrors = result.field_errors?.password

        setErrorMessage(
          Array.isArray(passwordErrors) && passwordErrors.length > 0
            ? passwordErrors[0]
            : result.error || '비밀번호 변경에 실패했습니다.'
        )
        return
      }

      setPassword('')
      setMessage(result.message || '비밀번호가 변경되었습니다.')
      onSuccess?.()
    } catch (error) {
      console.error('[ResetPasswordPanel] reset password error:', error)
      setErrorMessage('비밀번호 변경 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        marginTop: '20px',
        border: '1px solid #ddd',
        borderRadius: '12px',
        padding: '16px',
        background: '#fafafa',
      }}
    >
      <h4 style={{ marginTop: 0 }}>비밀번호 초기화</h4>

      <p style={{ marginTop: 0 }}>
        대상 계정:{' '}
        <strong>
          {user.full_name} ({user.student_id})
        </strong>
      </p>

      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="새 비밀번호 입력"
        style={{
          width: '100%',
          padding: '10px',
          boxSizing: 'border-box',
        }}
      />

      <p style={{ margin: '6px 0 0', color: '#666', fontSize: '13px' }}>
        8자 이상, 소문자/숫자를 포함해야 합니다.
      </p>

      <div
        style={{
          marginTop: '12px',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <button type="button" onClick={handleResetPassword} disabled={loading}>
          {loading ? '변경 중...' : '비밀번호 변경'}
        </button>

        <button type="button" onClick={onCancel} disabled={loading}>
          취소
        </button>
      </div>

      {message && (
        <p style={{ color: 'green', marginTop: '12px' }}>{message}</p>
      )}

      {errorMessage && (
        <p style={{ color: 'red', marginTop: '12px' }}>{errorMessage}</p>
      )}
    </div>
  )
}