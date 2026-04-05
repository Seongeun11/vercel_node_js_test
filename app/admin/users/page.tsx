'use client'

import { useState } from 'react'
//vercel 빌드 형식 dynamic으로 선언
export const dynamic = 'force-dynamic'

type Role = 'admin' | 'captain' | 'trainee'

export default function AdminUsersPage() {
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('trainee')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit() {
    setMessage('')
    setErrorMessage('')

    if (!studentId.trim() || !password.trim() || !fullName.trim()) {
      setErrorMessage('학번, 비밀번호, 이름을 모두 입력해주세요.')
      return
    }

    try {
      setLoading(true)

      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          student_id: studentId.trim(),
          password: password.trim(),
          full_name: fullName.trim(),
          role,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setErrorMessage(result?.error || '사용자 생성에 실패했습니다.')
        return
      }

      setMessage('사용자가 생성되었습니다.')
      setStudentId('')
      setPassword('')
      setFullName('')
      setRole('trainee')
    } catch (error) {
      console.error('사용자 생성 실패:', error)
      setErrorMessage('사용자 생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '12px',
        background: '#fff',
        padding: '20px',
        maxWidth: '640px',
      }}
    >
      <h2 style={{ marginTop: 0 }}>사용자 생성</h2>

      <label style={{ display: 'block', marginBottom: '6px' }}>학번</label>
      <input
        type="text"
        value={studentId}
        onChange={(e) => setStudentId(e.target.value)}
        style={{ width: '100%', padding: '10px', marginBottom: '12px', boxSizing: 'border-box' }}
      />

      <label style={{ display: 'block', marginBottom: '6px' }}>비밀번호</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: '100%', padding: '10px', marginBottom: '12px', boxSizing: 'border-box' }}
      />

      <label style={{ display: 'block', marginBottom: '6px' }}>이름</label>
      <input
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        style={{ width: '100%', padding: '10px', marginBottom: '12px', boxSizing: 'border-box' }}
      />

      <label style={{ display: 'block', marginBottom: '6px' }}>권한</label>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        style={{ width: '100%', padding: '10px', marginBottom: '16px', boxSizing: 'border-box' }}
      >
        <option value="trainee">trainee</option>
        <option value="captain">captain</option>
        <option value="admin">admin</option>
      </select>

      <button type="button" onClick={handleSubmit} disabled={loading}>
        {loading ? '생성 중...' : '사용자 생성'}
      </button>

      {message && <p style={{ color: 'green', marginTop: '16px' }}>{message}</p>}
      {errorMessage && <p style={{ color: 'red', marginTop: '16px' }}>{errorMessage}</p>}
    </div>
  )
}