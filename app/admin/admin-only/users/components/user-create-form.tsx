//app\admin\admin-only\users\components\user-create-form.tsx
'use client'

import { useState } from 'react'
import AffiliationSelect from '@/components/common/affiliation-select'
import { EnrollmentStatus } from '../hooks/use-admin-users'

const ROLE_OPTIONS = [
  { value: 'admin', label: '관리자', id: 1 },
  { value: 'captain', label: '캡틴', id: 2 },
  { value: 'trainee', label: '수련생', id: 3 },
] as const

const ENROLLMENT_STATUS_OPTIONS: Array<{ value: EnrollmentStatus; label: string }> = [
  { value: 'active', label: '재학' },
  { value: 'completed', label: '수료' },
]

type Props = {
  onSuccess: () => void
  onSetMessage: (msg: string) => void
  onSetErrorMessage: (msg: string) => void
}

export default function UserCreateForm({ onSuccess, onSetMessage, onSetErrorMessage }: Props) {
  const [studentId, setStudentId] = useState('')
  const [fullName, setFullName] = useState('')
  const [roleId, setRoleId] = useState<number>(3)
  const [password, setPassword] = useState('')
  const [cohortNo, setCohortNo] = useState('')
  const [enrollmentStatus, setEnrollmentStatus] = useState<EnrollmentStatus>('active')
  const [affiliationId, setAffiliationId] = useState<string>('')
  const [loading, setLoading] = useState(false)

  async function handleCreateUser() {
    onSetMessage('')
    onSetErrorMessage('')

    const normalizedStudentId = studentId.trim()
    const normalizedFullName = fullName.trim()
    const normalizedCohortNo = cohortNo.trim()
    const normalizedAffiliationid = affiliationId.trim()

    if (!normalizedStudentId) return onSetErrorMessage('학번을 입력해주세요.')
    if (!normalizedFullName) return onSetErrorMessage('이름을 입력해주세요.')
    if (!password.trim()) return onSetErrorMessage('초기 비밀번호를 입력해주세요.')
    if (!normalizedAffiliationid) return onSetErrorMessage('소속을 선택해주세요.')

    if (normalizedCohortNo) {
      const cohortNumber = Number(normalizedCohortNo)
      if (!Number.isInteger(cohortNumber) || cohortNumber <= 0) {
        return onSetErrorMessage('기수는 1 이상 정수로 입력해주세요.')
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
          role_id: roleId,
          affiliation_id: Number(affiliationId),
          password,
          cohort_no: normalizedCohortNo === '' ? null : Number(normalizedCohortNo),
          enrollment_status: enrollmentStatus,
        }),
      })

      const text = await response.text()
      const result = text ? JSON.parse(text) : {}

      if (!response.ok) {
        onSetErrorMessage(result.error || '사용자 생성에 실패했습니다.')
        return
      }

      onSetMessage(result.message || '사용자가 생성되었습니다.')
      // 성공 후 초기화
      setStudentId('')
      setFullName('')
      setRoleId(3)
      setPassword('')
      setCohortNo('')
      setEnrollmentStatus('active')
      setAffiliationId('')

      onSuccess() // 목록 새로고침
    } catch (error) {
      console.error('[admin/users] create error:', error)
      onSetErrorMessage('사용자 생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '12px', background: '#fff', padding: '20px' }}>
      <div style={{ display: 'grid', gap: '12px' }}>
        {/* 학번 입력 */}
        <div>
          <label style={{ display: 'block', marginBottom: '6px' }}>학번</label>
          <input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="예: 20260001" style={inputStyle} />
        </div>
        {/* 이름 입력 */}
        <div>
          <label style={{ display: 'block', marginBottom: '6px' }}>이름</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="예: 홍길동" style={inputStyle} />
        </div>
        {/* 권한 선택 */}
        <div>
          <label style={{ display: 'block', marginBottom: '6px' }}>권한</label>
          <select value={roleId} onChange={(e) => setRoleId(Number(e.target.value))} style={inputStyle}>
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>
        {/* 소속 선택 */}
        <div>
          <label style={{ display: 'block', marginBottom: '6px' }}>소속</label>
          <AffiliationSelect value={affiliationId} onChange={(val) => setAffiliationId(val)} showAllOption={true} allOptionLabel="소속 선택" />
        </div>
        {/* 재학/수료 선택 */}
        <div>
          <label style={{ display: 'block', marginBottom: '6px' }}>재학/수료</label>
          <select value={enrollmentStatus} onChange={(e) => setEnrollmentStatus(e.target.value as EnrollmentStatus)} style={inputStyle}>
            {ENROLLMENT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        {/* 기수 */}
        <div>
          <label style={{ display: 'block', marginBottom: '6px' }}>기수</label>
          <input type="number" min="1" value={cohortNo} onChange={(e) => setCohortNo(e.target.value)} placeholder="예: 10" style={inputStyle} />
        </div>
        {/* 비밀번호 */}
        <div>
          <label style={{ display: 'block', marginBottom: '6px' }}>초기 비밀번호</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="초기 비밀번호 입력" style={inputStyle} />
        </div>
        

        <button type="button" onClick={handleCreateUser} disabled={loading}>
          {loading ? '생성 중...' : '회원 생성'}
        </button>
      </div>
    </div>
  )
}

const inputStyle = { padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', minWidth: '180px', outline: 'none', background: '#ffffff' }