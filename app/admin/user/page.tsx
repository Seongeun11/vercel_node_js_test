// app/admin/user/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type UserRole = 'trainee' | 'captain' | 'admin'

type CreateUserForm = {
  full_name: string
  student_id: string
  password: string
  role: UserRole
}

const INITIAL_FORM: CreateUserForm = {
  full_name: '',
  student_id: '',
  password: '',
  role: 'trainee',
}

export default function AdminUsersPage() {
  const router = useRouter()

  const [submitLoading, setSubmitLoading] = useState(false)
  const [form, setForm] = useState<CreateUserForm>(INITIAL_FORM)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const handleChange = <K extends keyof CreateUserForm>(
    key: K,
    value: CreateUserForm[K]
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const resetForm = () => {
    setForm(INITIAL_FORM)
  }

  const validateForm = () => {
    if (!form.full_name.trim()) return '이름을 입력해주세요.'
    if (!form.student_id.trim()) return '학번을 입력해주세요.'
    if (!/^[0-9A-Za-z_-]+$/.test(form.student_id.trim())) {
      return '학번 형식이 올바르지 않습니다.'
    }
    if (!form.password.trim()) return '비밀번호를 입력해주세요.'
    if (form.password.trim().length < 6) {
      return '비밀번호는 최소 6자 이상이어야 합니다.'
    }
    return ''
  }

  const handleSubmit = async () => {
    try {
      setSubmitLoading(true)
      setMessage('')
      setErrorMessage('')

      const validationError = validateForm()
      if (validationError) {
        setErrorMessage(validationError)
        return
      }

      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          student_id: form.student_id.trim(),
          password: form.password.trim(),
          role: form.role,
        }),
      })

      const result = response.headers
        .get('content-type')
        ?.includes('application/json')
        ? await response.json()
        : { error: '사용자 생성 응답 형식이 올바르지 않습니다.' }

      if (!response.ok) {
        setErrorMessage(result?.error || '사용자 생성에 실패했습니다.')
        return
      }

      setMessage('사용자가 생성되었습니다.')
      resetForm()
    } catch (error) {
      console.error(error)
      setErrorMessage('사용자 생성 중 오류가 발생했습니다.')
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '720px', margin: '0 auto' }}>
      <h2>사용자 생성</h2>

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '12px',
          padding: '20px',
          background: '#fff',
        }}
      >
        <label style={{ display: 'block', marginBottom: '6px' }}>이름</label>
        <input
          type="text"
          value={form.full_name}
          onChange={(e) => handleChange('full_name', e.target.value)}
          placeholder="예: 홍길동"
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '12px',
            boxSizing: 'border-box',
          }}
        />

        <label style={{ display: 'block', marginBottom: '6px' }}>학번</label>
        <input
          type="text"
          value={form.student_id}
          onChange={(e) => handleChange('student_id', e.target.value)}
          placeholder="예: 20241234"
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '12px',
            boxSizing: 'border-box',
          }}
        />

        <label style={{ display: 'block', marginBottom: '6px' }}>비밀번호</label>
        <input
          type="password"
          value={form.password}
          onChange={(e) => handleChange('password', e.target.value)}
          placeholder="최소 6자 이상"
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '12px',
            boxSizing: 'border-box',
          }}
        />

        <label style={{ display: 'block', marginBottom: '6px' }}>권한</label>
        <select
          value={form.role}
          onChange={(e) => handleChange('role', e.target.value as UserRole)}
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '16px',
            boxSizing: 'border-box',
          }}
        >
          <option value="trainee">trainee</option>
          <option value="captain">captain</option>
          <option value="admin">admin</option>
        </select>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleSubmit} disabled={submitLoading}>
            {submitLoading ? '생성중...' : '사용자 생성'}
          </button>

          <button type="button" onClick={() => router.push('/admin')}>
            관리자 페이지로
          </button>
        </div>

        {message && (
          <p style={{ color: 'green', marginTop: '16px' }}>✅ {message}</p>
        )}
        {errorMessage && (
          <p style={{ color: 'crimson', marginTop: '16px' }}>⚠️ {errorMessage}</p>
        )}
      </div>
    </div>
  )
}