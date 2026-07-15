'use client'

// 🛠️ 오류 해결: 명시적으로 React 임포트 및 함수명 대문자(UserEditPanel)로 교정
import React, { useState, useEffect } from 'react'
import { AdminUser } from '../hooks/use-admin-users'

type UserEditPanelProps = {
  user: AdminUser
  initialMode: 'name' | 'password'
  onCancel: () => void
  onSuccess: (updatedUser?: AdminUser) => void
  // 🎯 논리 교정: 부모 컴포넌트에서 전달하는 알림 메시지 함수 타입을 추가합니다.
  onSetMessage: (msg: string) => void
  onSetErrorMessage: (msg: string) => void
}

type CommonResponse = {
  ok?: boolean
  message?: string
  user?: AdminUser
  error?: string
  field_errors?: {
    full_name?: string[]
    password?: string[]
  }
}

export default function UserEditPanel({
  user,
  initialMode,
  onCancel,
  onSuccess,
  onSetMessage,      // 🔄 추가
  onSetErrorMessage,  // 🔄 추가
}: UserEditPanelProps) {
  const [mode, setMode] = useState<'name' | 'password'>(initialMode)
  const [loading, setLoading] = useState(false)

  // 이름 변경 관련 상태
  const [fullName, setFullName] = useState('')

  // 비밀번호 변경 관련 상태
  const [password, setPassword] = useState('')

  // 유저가 변경될 때 상태 초기화
  useEffect(() => {
    if (user) {
      setFullName(user.full_name)
      setPassword('')
      onSetMessage('')
      onSetErrorMessage('')
      setMode(initialMode)
    }
  }, [user, initialMode, onSetMessage, onSetErrorMessage])

  // 이름 변경 API 요청
  async function handleUpdateName() {
    onSetMessage('')
    onSetErrorMessage('')
    const normalizedFullName = fullName.trim()

    if (!normalizedFullName) {
      onSetErrorMessage('이름을 입력해주세요.')
      return
    }
    if (normalizedFullName === user.full_name) {
      onSetErrorMessage('현재 이름과 동일합니다.')
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

      const text = await response.text()
      let result: CommonResponse = {}
      const contentType = response.headers.get('content-type')

      if (contentType && contentType.includes('application/json') && text) {
        try {
          result = JSON.parse(text) as CommonResponse
        } catch (err) {
          console.error('[UserEditPanel] JSON 파싱 실패:', err)
        }
      }

      if (!response.ok) {
        if (!contentType || !contentType.includes('application/json')) {
          onSetErrorMessage(`서버 오류가 발생했습니다. (HTTP 상태 코드: ${response.status})`)
          return
        }
        const nameErrors = result.field_errors?.full_name
        onSetErrorMessage(
          Array.isArray(nameErrors) && nameErrors.length > 0
            ? nameErrors[0]
            : result.error || '이름 변경에 실패했습니다.'
        )
        return
      }

      onSetMessage(result.message || '이름이 성공적으로 변경되었습니다.')
      const updatedUser: AdminUser = result.user || { ...user, full_name: normalizedFullName }
      onSuccess(updatedUser)
    } catch (error) {
      console.error('[UserEditPanel] 이름 변경 에러:', error)
      onSetErrorMessage('이름 변경 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 비밀번호 초기화 API 요청
  async function handleResetPassword() {
    onSetMessage('')
    onSetErrorMessage('')
    const normalizedPassword = password.trim()

    if (!normalizedPassword) {
      onSetErrorMessage('새 비밀번호를 입력해주세요.')
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
      const result = text ? (JSON.parse(text) as CommonResponse) : {}

      if (!response.ok) {
        const passwordErrors = result.field_errors?.password
        onSetErrorMessage(
          Array.isArray(passwordErrors) && passwordErrors.length > 0
            ? passwordErrors[0]
            : result.error || '비밀번호 변경에 실패했습니다.'
        )
        return
      }

      setPassword('')
      onSetMessage(result.message || '비밀번호가 변경되었습니다.')
      onSuccess()
    } catch (error) {
      console.error('[UserEditPanel] 비밀번호 변경 에러:', error)
      onSetErrorMessage('비밀번호 변경 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '16px',
        background: '#f8fafc',
        marginTop: '8px',
        marginBottom: '8px',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
      }}
    >
      {/* 내부 기능 전환 탭 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px' }}>
        <button
          type="button"
          onClick={() => { setMode('name'); onSetMessage(''); onSetErrorMessage(''); }}
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            borderRadius: '4px',
            border: 'none',
            background: mode === 'name' ? '#111827' : 'transparent',
            color: mode === 'name' ? '#fff' : '#475569',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          이름 변경
        </button>
        <button
          type="button"
          onClick={() => { setMode('password'); onSetMessage(''); onSetErrorMessage(''); }}
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            borderRadius: '4px',
            border: 'none',
            background: mode === 'password' ? '#111827' : 'transparent',
            color: mode === 'password' ? '#fff' : '#475569',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          비밀번호 초기화
        </button>
      </div>

      <p style={{ marginTop: 0, fontSize: '13px', color: '#64748b' }}>
        대상 계정: <strong>{user.full_name} ({user.student_id})</strong>
      </p>

      {/* 1. 이름 변경 양식 */}
      {mode === 'name' && (
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
              background: '#ffffff',
            }}
          />
        </div>
      )}

      {/* 2. 비밀번호 초기화 양식 */}
      {mode === 'password' && (
        <div style={{ display: 'grid', gap: '8px', maxWidth: '300px' }}>
          <label style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>새 비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="새 비밀번호 입력"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '14px',
              background: '#ffffff',
            }}
          />
          <span style={{ color: '#64748b', fontSize: '12px' }}>
            8자 이상, 소문자/숫자를 포함해야 합니다.
          </span>
        </div>
      )}

      {/* 공통 컨트롤 버튼 영역 */}
      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={mode === 'name' ? handleUpdateName : handleResetPassword}
          disabled={loading}
          style={{
            padding: '8px 14px',
            borderRadius: '6px',
            border: 'none',
            background: '#111827',
            color: '#fff',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '변경 중...' : mode === 'name' ? '이름 변경 저장' : '비밀번호 변경 저장'}
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
            cursor: 'pointer',
          }}
        >
          취소
        </button>
      </div>
    </div>
  )
}