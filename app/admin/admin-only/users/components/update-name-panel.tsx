'use client'

import { useState, useEffect } from 'react'
type AdminUser = {
  id: string
  student_id: string
  full_name: string
}

type UpdateNamePanelProps = {
  user: AdminUser
  onCancel: () => void
  onSuccess: (updatedUser: AdminUser) => void
}

type UpdateNameResponse = {
  ok?: boolean
  message?: string
  user?: AdminUser
  error?: string
  field_errors?: {
    full_name?: string[]
  }
}

export default function UpdateNamePanel({
  user,
  onCancel,
  onSuccess,
}: UpdateNamePanelProps) {
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (user) {
      setFullName(user.full_name)
      setMessage('')
      setErrorMessage('')
    }
  }, [user])

  async function handleUpdateName() {
    setMessage('')
    setErrorMessage('')

    const normalizedFullName = fullName.trim()

    if (!normalizedFullName) {
      setErrorMessage('이름을 입력해주세요.')
      return
    }

    if (normalizedFullName === user.full_name) {
      setErrorMessage('현재 이름과 동일합니다.')
      return
    }

    try {
      setLoading(true)

      const response = await fetch('/api/admin/users/update-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: user.id,
          full_name: normalizedFullName,
        }),
      })

      // 1. 응답 텍스트를 먼저 가져옵니다.
      const text = await response.text()
      let result: UpdateNameResponse = {}

      // 2. 응답이 JSON 규격인지 헤더를 체크하고 안전하게 파싱을 시도합니다.
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json') && text) {
        try {
          result = JSON.parse(text) as UpdateNameResponse
        } catch (parseError) {
          console.error('[UpdateNamePanel] JSON 파싱 실패:', parseError)
          // 파싱 실패 시 예외가 터지지 않게 빈 객체 상태를 유지합니다.
        }
      }

      // 3. HTTP 상태 코드가 OK가 아닐 경우 처리
      if (!response.ok) {
        // 백엔드가 개발 모드 에러 HTML을 주었거나 JSON이 아닐 경우 대응
        if (!contentType || !contentType.includes('application/json')) {
          setErrorMessage(`서버 오류가 발생했습니다. (HTTP 상태 코드: ${response.status})`)
          return
        }

        const nameErrors = result.field_errors?.full_name
        setErrorMessage(
          Array.isArray(nameErrors) && nameErrors.length > 0
            ? nameErrors[0]
            : result.error || '이름 변경에 실패했습니다.'
        )
        return
      }

      // 4. 성공 처리
      setMessage(result.message || '이름이 성공적으로 변경되었습니다.')
      
      const updatedUser: AdminUser = result.user || { ...user, full_name: normalizedFullName }
      onSuccess(updatedUser)
    } catch (error) {
      console.error('[UpdateNamePanel] 네트워크 또는 내부 에러:', error)
      setErrorMessage('이름 변경 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.')
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
      <h4 style={{ marginTop: 0 }}>회원 이름 변경</h4>

      <p style={{ marginTop: 0, fontSize: '14px', color: '#334155' }}>
        대상 계정:{' '}
        <strong>
          {user.full_name} ({user.student_id})
        </strong>
      </p>

      <div style={{ display: 'grid', gap: '8px', maxWidth: '300px' }}>
        <label style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>새 이름</label>
        <input
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="변경할 이름 입력"
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            fontSize: '14px',
            outline: 'none',
            background: '#ffffff'
          }}
        />
      </div>

      <div
        style={{
          marginTop: '16px',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <button 
          type="button" 
          onClick={handleUpdateName} 
          disabled={loading}
          style={{
            padding: '8px 14px',
            borderRadius: '6px',
            border: 'none',
            background: '#111827',
            color: '#fff',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '변경 중...' : '이름 변경'}
        </button>

        <button 
          type="button" 
          onClick={onCancel} 
          disabled={loading}
          style={{
            padding: '8px 14px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#fff',
            color: '#334155',
            cursor: 'pointer'
          }}
        >
          취소
        </button>
      </div>

      {message && (
        <p style={{ color: 'green', marginTop: '12px', fontSize: '13px', fontWeight: 500 }}>{message}</p>
      )}

      {errorMessage && (
        <p style={{ color: 'red', marginTop: '12px', fontSize: '13px', fontWeight: 500 }}>{errorMessage}</p>
      )}
    </div>
  )
}