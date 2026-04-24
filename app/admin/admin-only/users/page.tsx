// app/admin/users/page.tsx
'use client'

import { useState } from 'react'
import AdminHeader from '@/components/admin/AdminHeader'
import UserBulkUpload from './user-bulk-upload'

type UserRole = 'admin' | 'captain' | 'trainee'

type CreateUserResponse = {
  message?: string
  user?: {
    id: string
    student_id: string
    full_name: string
    role: UserRole
    cohort_no: number
  }
  error?: string
}

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'trainee', label: '수련생' },
  { value: 'captain', label: '캡틴' },
  { value: 'admin', label: '관리자' },
]

export default function AdminUsersPage() {
  const [studentId, setStudentId] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('trainee')
  const [password, setPassword] = useState('')
  const [cohortNo, setCohortNo] = useState('')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleCreateUser() {
    setMessage('')
    setErrorMessage('')

    const normalizedStudentId = studentId.trim()
    const normalizedFullName = fullName.trim()
    const normalizedCohortNo = cohortNo.trim()

    if (!normalizedStudentId) {
      setErrorMessage('학번을 입력해주세요.')
      return
    }

    if (!normalizedFullName) {
      setErrorMessage('이름을 입력해주세요.')
      return
    }

    if (!password.trim()) {
      setErrorMessage('초기 비밀번호를 입력해주세요.')
      return
    }
    if (normalizedCohortNo) {
    const cohortNumber = Number(normalizedCohortNo)

    if (!Number.isInteger(cohortNumber) || cohortNumber <= 0) {
      setErrorMessage('기수는 1 이상 정수로 입력해주세요.')
      return
    }
  }
    try {
      setLoading(true)

      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          student_id: normalizedStudentId,
          full_name: normalizedFullName,
          role,
          password: password,
          cohort_no: normalizedCohortNo === '' ? null : Number(normalizedCohortNo),
        }),
      })

      const text = await response.text()
      const result: CreateUserResponse = text ? JSON.parse(text) : {}

      if (!response.ok) {
        setErrorMessage(result?.error || '사용자 생성에 실패했습니다.')
        return
      }

      setMessage(result?.message || '사용자가 생성되었습니다.')

      setStudentId('')
      setFullName('')
      setRole('trainee')
      setPassword('')
    } catch (error) {
      console.error('[admin/users] create error:', error)
      setErrorMessage('사용자 생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto' }}>
      <AdminHeader
        title="사용자 생성"
        description="관리자가 수련생, 캡틴, 관리자 계정을 생성할 수 있습니다."
      />

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '12px',
          background: '#fff',
          padding: '20px',
        }}
      >
        <div style={{ display: 'grid', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>학번</label>
            <input
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="예: 20260001"
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>이름</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="예: 홍길동"
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>권한</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>초기 비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="초기 비밀번호 입력"
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            />
             <p style={{ margin: '6px 0 0', color: '#666', fontSize: '13px' }}>
    8자리 이상 입력하세요.
  </p>
          </div>
          <div>
  <label style={{ display: 'block', marginBottom: '6px' }}>기수</label>
  <input
    type="number"
    min="1"
    step="1"
    value={cohortNo}
    onChange={(event) => setCohortNo(event.target.value)}
    placeholder="예: 10"
    style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
  />
  <p style={{ margin: '6px 0 0', color: '#666', fontSize: '13px' }}>
    기수: 1 이상 정수만 가능합니다.
  </p>
</div>

          <button type="button" onClick={handleCreateUser} disabled={loading}>
            {loading ? '생성 중...' : '사용자 생성'}
          </button>
        </div>

        {message && <p style={{ color: 'green', marginTop: '16px' }}>{message}</p>}
        {errorMessage && <p style={{ color: 'red', marginTop: '16px' }}>{errorMessage}</p>}
      </div>
        {/* 새 엑셀 일괄 등록 섹션 */}
  <UserBulkUpload />
    </div>
  )
}