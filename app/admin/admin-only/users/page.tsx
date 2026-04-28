'use client'

import { useEffect, useState } from 'react'
import AdminHeader from '@/components/admin/AdminHeader'
import UserBulkUpload from './user-bulk-upload'
import ResetPasswordPanel from './reset-password-panel'
import EnrollmentStatusToggle from './enrollment-status'

type UserRole = 'admin' | 'captain' | 'trainee'
type EnrollmentStatus = 'active' | 'completed'

type AdminUser = {
  id: string
  student_id: string
  full_name: string
  role: UserRole
  cohort_no: number | null
  enrollment_status: EnrollmentStatus
  created_at?: string
  updated_at?: string
}

type CreateUserResponse = {
  ok?: boolean
  message?: string
  user?: AdminUser
  error?: string
  field_errors?: Record<string, string[]>
}

type UserListResponse = {
  users?: AdminUser[]
  error?: string
}


const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'trainee', label: '수련생' },
  { value: 'captain', label: '캡틴' },
  { value: 'admin', label: '관리자' },
]

const ENROLLMENT_STATUS_OPTIONS: Array<{
  value: EnrollmentStatus
  label: string
}> = [
  { value: 'active', label: '재학' },
  { value: 'completed', label: '수료' },
]

function getRoleLabel(role: UserRole): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role
}

function getEnrollmentStatusLabel(status?: EnrollmentStatus): string {
  return status === 'completed' ? '수료' : '재학'
}

function getFirstFieldError(
  fieldErrors: Record<string, string[]> | undefined
): string {
  if (!fieldErrors) return ''

  const firstError = Object.values(fieldErrors)
    .flat()
    .find((message) => Boolean(message))

  return firstError ?? ''
}

export default function AdminUsersPage() {
  
  const [studentId, setStudentId] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('trainee')
  const [password, setPassword] = useState('')
  const [cohortNo, setCohortNo] = useState('')
  const [enrollmentStatus, setEnrollmentStatus] =
    useState<EnrollmentStatus>('active')
  const [isUserListOpen, setIsUserListOpen] = useState(true)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [selectedPasswordUser, setSelectedPasswordUser] =
    useState<AdminUser | null>(null)

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function fetchUsers() {
    try {
      setUsersLoading(true)

      const response = await fetch('/api/profiles/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })

      const text = await response.text()
      const result: UserListResponse = text ? JSON.parse(text) : {}

      if (!response.ok) {
        setErrorMessage(result.error || '사용자 목록 조회에 실패했습니다.')
        return
      }

      setUsers(result.users ?? [])
    } catch (error) {
      console.error('[admin/users] list error:', error)
      setErrorMessage('사용자 목록 조회 중 오류가 발생했습니다.')
    } finally {
      setUsersLoading(false)
    }
  }

  useEffect(() => {
    void fetchUsers()
  }, [])

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
          password,
          cohort_no:
            normalizedCohortNo === '' ? null : Number(normalizedCohortNo),
          enrollment_status: enrollmentStatus,
        }),
      })

      const text = await response.text()
      const result: CreateUserResponse = text ? JSON.parse(text) : {}

      if (!response.ok) {
        const fieldError = getFirstFieldError(result.field_errors)

        setErrorMessage(
          fieldError || result.error || '사용자 생성에 실패했습니다.'
        )
        return
      }

      setMessage(result.message || '사용자가 생성되었습니다.')

      setStudentId('')
      setFullName('')
      setRole('trainee')
      setPassword('')
      setCohortNo('')
      setEnrollmentStatus('active')

      await fetchUsers()
    } catch (error) {
      console.error('[admin/users] create error:', error)
      setErrorMessage('사용자 생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
  <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
    <AdminHeader
      title="회원 생성"
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
            onChange={(event) => setStudentId(event.target.value)}
            placeholder="예: 20260001"
            style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px' }}>이름</label>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="예: 홍길동"
            style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px' }}>권한</label>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
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
          <label style={{ display: 'block', marginBottom: '6px' }}>
            재학/수료
          </label>
          <select
            value={enrollmentStatus}
            onChange={(event) =>
              setEnrollmentStatus(event.target.value as EnrollmentStatus)
            }
            style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
          >
            {ENROLLMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px' }}>
            초기 비밀번호
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="초기 비밀번호 입력"
            style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
          />
          <p style={{ margin: '6px 0 0', color: '#666', fontSize: '13px' }}>
            8자 이상, 소문자/숫자를 포함해야 합니다.
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
        </div>

        <button type="button" onClick={handleCreateUser} disabled={loading}>
          {loading ? '생성 중...' : '회원 생성'}
        </button>
      </div>

      {message && (
        <p style={{ color: 'green', marginTop: '16px' }}>{message}</p>
      )}

      {errorMessage && (
        <p style={{ color: 'red', marginTop: '16px' }}>{errorMessage}</p>
      )}
    </div>

    <div
      style={{
        marginTop: '24px',
        border: '1px solid #ddd',
        borderRadius: '12px',
        background: '#fff',
        padding: '20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <h3 style={{ margin: 0 }}>계정 목록</h3>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setIsUserListOpen((prev) => {
                const next = !prev

                if (!next) {
                  setSelectedPasswordUser(null)
                }

                return next
              })
            }}
          >
            {isUserListOpen ? '접기' : '펼치기'}
          </button>

          <button type="button" onClick={fetchUsers} disabled={usersLoading}>
            {usersLoading ? '불러오는 중...' : '새로고침'}
          </button>
        </div>
      </div>

      {isUserListOpen && (
        <>
          <div style={{ overflowX: 'auto', marginTop: '12px' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px',
              }}
            >
              <thead>
                <tr>
                  <th style={{ borderBottom: '1px solid #ddd', padding: '8px' }}>
                    학번
                  </th>
                  <th style={{ borderBottom: '1px solid #ddd', padding: '8px' }}>
                    이름
                  </th>
                  <th style={{ borderBottom: '1px solid #ddd', padding: '8px' }}>
                    권한
                  </th>
                  <th style={{ borderBottom: '1px solid #ddd', padding: '8px' }}>
                    기수
                  </th>
                  <th style={{ borderBottom: '1px solid #ddd', padding: '8px' }}>
                    재학/수료
                  </th>
                  <th style={{ borderBottom: '1px solid #ddd', padding: '8px' }}>
                    비밀번호
                  </th>
                </tr>
              </thead>

              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{ padding: '16px', textAlign: 'center' }}
                    >
                      표시할 계정이 없습니다.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>
                        {user.student_id}
                      </td>

                      <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>
                        {user.full_name}
                      </td>

                      <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>
                        {getRoleLabel(user.role)}
                      </td>

                      <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>
                        {user.cohort_no ?? '-'}
                      </td>

                      <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>
                        <EnrollmentStatusToggle
                          user={user}
                          onUpdated={(updatedUser) => {
                            setUsers((prevUsers) =>
                              prevUsers.map((prevUser) =>
                                prevUser.id === updatedUser.id
                                  ? { ...prevUser, ...updatedUser }
                                  : prevUser
                              )
                            )
                          }}
                        />
                      </td>

                      <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPasswordUser(user)
                            setMessage('')
                            setErrorMessage('')
                          }}
                        >
                          변경
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {selectedPasswordUser && (
            <ResetPasswordPanel
              user={selectedPasswordUser}
              onCancel={() => setSelectedPasswordUser(null)}
              onSuccess={() => {
                setSelectedPasswordUser(null)
              }}
            />
          )}
        </>
      )}
    </div>

    <UserBulkUpload />
  </div>
)
}