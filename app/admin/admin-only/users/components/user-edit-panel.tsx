'use client'

import React, { useState, useEffect } from 'react'
import AffiliationSelect from '@/components/common/affiliation-select'
import { AdminUser } from '../hooks/use-admin-users'

// 권한 매핑 옵션 (DB roles 테이블과 동기화)
const ROLE_OPTIONS = [
  { value: 'admin', label: '관리자', id: 1 },
  { value: 'captain', label: '캡틴', id: 2 },
  { value: 'trainee', label: '수련생', id: 3 },
] as const

type UserEditPanelProps = {
  user: AdminUser
  initialMode?: 'profile' | 'password'
  onCancel: () => void
  onSuccess: (updatedUser?: AdminUser) => void
  onSetMessage: (msg: string) => void
  onSetErrorMessage: (msg: string) => void
}

type CommonResponse = {
  ok?: boolean
  message?: string
  user?: AdminUser
  error?: string
  field_errors?: Record<string, string[]>
}

export default function UserEditPanel({
  user,
  initialMode = 'profile',
  onCancel,
  onSuccess,
  onSetMessage,
  onSetErrorMessage,
}: UserEditPanelProps) {
  const [mode, setMode] = useState<'profile' | 'password'>(initialMode)
  const [loading, setLoading] = useState(false)

  // 1. 프로필 수정 관련 State
  const [studentId, setStudentId] = useState('')
  const [fullName, setFullName] = useState('')
  const [roleId, setRoleId] = useState<number>(3)
  const [affiliationId, setAffiliationId] = useState<string>('')
  const [cohortNo, setCohortNo] = useState('')

  // 2. 비밀번호 초기화 관련 State
  const [password, setPassword] = useState('')

  // 대상 유저 변경 시 폼 데이터 초기화
  useEffect(() => {
    if (user) {
      setStudentId(user.student_id || '')
      setFullName(user.full_name || '')

      // Role (객체, 문자열 모두 유연하게 판별)
      const currentRoleName = typeof user.role === 'object' ? user.role?.name : user.role
      const matchedRole = ROLE_OPTIONS.find((r) => r.value === currentRoleName)
      setRoleId(matchedRole ? matchedRole.id : 3)

      // Affiliation & Cohort
      const currentAffiliationId = (user as any).affiliation_id
      setAffiliationId(currentAffiliationId ? String(currentAffiliationId) : '')
      setCohortNo(user.cohort_no ? String(user.cohort_no) : '')

      setPassword('')
      onSetMessage('')
      onSetErrorMessage('')
      setMode(initialMode)
    }
  }, [user, initialMode, onSetMessage, onSetErrorMessage])

  // [기능 1] 통합 회원정보 수정 API 요청 handler
  async function handleUpdateProfile() {
    onSetMessage('')
    onSetErrorMessage('')

    const normalizedStudentId = studentId.trim()
    const normalizedFullName = fullName.trim()
    const normalizedCohortNo = cohortNo.trim()

    // 1차 클라이언트 입력값 검증
    if (!normalizedStudentId) return onSetErrorMessage('학번을 입력해주세요.')
    if (!normalizedFullName) return onSetErrorMessage('이름을 입력해주세요.')
    if (!affiliationId) return onSetErrorMessage('소속을 선택해주세요.')

    let parsedCohortNo: number | null = null
    if (normalizedCohortNo) {
      const num = Number(normalizedCohortNo)
      if (!Number.isInteger(num) || num <= 0) {
        return onSetErrorMessage('기수는 1 이상의 정수로 입력해주세요.')
      }
      parsedCohortNo = num
    }

    try {
      setLoading(true)
      const response = await fetch('/api/admin/users/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: user.id,
          student_id: normalizedStudentId,
          full_name: normalizedFullName,
          role_id: Number(roleId),
          affiliation_id: Number(affiliationId),
          cohort_no: parsedCohortNo,
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
        // 필드 단위 에러 메시지가 존재하는 경우 우선 표출
        const firstFieldError = result.field_errors
          ? Object.values(result.field_errors)[0]?.[0]
          : null

        onSetErrorMessage(firstFieldError || result.error || '정보 수정에 실패했습니다.')
        return
      }

      onSetMessage(result.message || '회원 정보가 성공적으로 수정되었습니다.')
      onSuccess(result.user)
    } catch (error) {
      console.error('[UserEditPanel] 정보 수정 에러:', error)
      onSetErrorMessage('정보 수정 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // [기능 2] 비밀번호 초기화 API 요청 handler
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
    <div style={panelContainerStyle}>
      {/* 1. 내부 기능 전환 탭 */}
      <div style={tabHeaderStyle}>
        <button
          type="button"
          onClick={() => { setMode('profile'); onSetMessage(''); onSetErrorMessage(''); }}
          style={getTabButtonStyle(mode === 'profile')}
        >
          회원 정보 수정
        </button>
        <button
          type="button"
          onClick={() => { setMode('password'); onSetMessage(''); onSetErrorMessage(''); }}
          style={getTabButtonStyle(mode === 'password')}
        >
          비밀번호 초기화
        </button>
      </div>

      <p style={{ marginTop: 0, marginBottom: '16px', fontSize: '13px', color: '#64748b' }}>
        대상 계정: <strong>{user.full_name} ({user.student_id})</strong>
      </p>

      {/* 2. 회원 정보 수정 양식 (학번, 이름, 권한, 소속, 기수) */}
      {mode === 'profile' && (
        <div style={gridFormStyle}>
          <div>
            <label style={labelStyle}>학번</label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="예: 20260001"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>이름</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="예: 홍길동"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>권한</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(Number(e.target.value))}
              style={inputStyle}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>소속</label>
            <AffiliationSelect
              value={affiliationId}
              onChange={(val) => setAffiliationId(val)}
              showAllOption={true}
              allOptionLabel="소속 선택"
            />
          </div>

          <div>
            <label style={labelStyle}>기수</label>
            <input
              type="number"
              min="1"
              value={cohortNo}
              onChange={(e) => setCohortNo(e.target.value)}
              placeholder="숫자만 입력"
              style={inputStyle}
            />
          </div>
        </div>
      )}

      {/* 3. 비밀번호 초기화 양식 */}
      {mode === 'password' && (
        <div style={{ display: 'grid', gap: '8px', maxWidth: '300px' }}>
          <label style={labelStyle}>새 비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="새 비밀번호 입력"
            style={inputStyle}
          />
          <span style={{ color: '#64748b', fontSize: '12px' }}>
            8자 이상, 소문자/숫자를 포함해야 합니다.
          </span>
        </div>
      )}

      {/* 4. 하단 버튼 영역 */}
      <div style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={mode === 'profile' ? handleUpdateProfile : handleResetPassword}
          disabled={loading}
          style={{
            ...primaryBtnStyle,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '저장 중...' : mode === 'profile' ? '정보 수정 저장' : '비밀번호 저장'}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          style={cancelBtnStyle}
        >
          취소
        </button>
      </div>
    </div>
  )
}

// Inline Styles
const panelContainerStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '16px',
  background: '#f8fafc',
  marginTop: '8px',
  marginBottom: '8px',
  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
}

const tabHeaderStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginBottom: '16px',
  borderBottom: '1px solid #cbd5e1',
  paddingBottom: '8px',
}

const gridFormStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  color: '#475569',
  fontWeight: 500,
  marginBottom: '4px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  fontSize: '14px',
  background: '#ffffff',
  outline: 'none',
  boxSizing: 'border-box',
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '6px',
  border: 'none',
  background: '#111827',
  color: '#fff',
  fontWeight: 600,
  fontSize: '14px',
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#334155',
  fontSize: '14px',
  cursor: 'pointer',
}

function getTabButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    fontSize: '13px',
    borderRadius: '4px',
    border: 'none',
    background: active ? '#111827' : 'transparent',
    color: active ? '#fff' : '#475569',
    fontWeight: 600,
    cursor: 'pointer',
  }
}