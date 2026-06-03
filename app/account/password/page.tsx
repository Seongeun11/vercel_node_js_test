// app/account/password/page.tsx
'use client'

import { FormEvent, useMemo, useState } from 'react'

type ChangePasswordResponse = {
  success?: boolean
  message?: string
  error?: string
}

function isStrongPassword(password: string): boolean {
  // 최소 8자, 영문, 숫자 포함
  return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)
}

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const canSubmit = useMemo(() => {
    return (
      currentPassword.trim().length > 0 &&
      newPassword.trim().length > 0 &&
      confirmPassword.trim().length > 0 &&
      !isSubmitting
    )
  }, [currentPassword, newPassword, confirmPassword, isSubmitting])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setMessage('')
    setError('')

    const current = currentPassword.trim()
    const next = newPassword.trim()
    const confirm = confirmPassword.trim()

    if (!current || !next || !confirm) {
      setError('현재 비밀번호와 새 비밀번호를 모두 입력해주세요.')
      return
    }

    if (next !== confirm) {
      setError('새 비밀번호가 일치하지 않습니다.')
      return
    }

    if (current === next) {
      setError('현재 비밀번호와 다른 비밀번호를 사용해주세요.')
      return
    }

    if (!isStrongPassword(next)) {
      setError('새 비밀번호는 최소 8자 이상이며 영문과 숫자를 포함해야 합니다.')
      return
    }

    try {
      setIsSubmitting(true)

      const response = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          current_password: current,
          new_password: next,
          confirm_password: confirm,
        }),
      })

      const data = (await response.json()) as ChangePasswordResponse

      if (!response.ok) {
        setError(data.error || '비밀번호 변경에 실패했습니다.')
        return
      }

        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      // 비밀번호 변경 성공 후 세션 정리
        await fetch('/auth/signout', {
        method: 'POST',
        credentials: 'include',
        })

    // 새 비밀번호로 다시 로그인 유도
    window.location.href = '/login?reason=password_changed'
    } catch {
      setError('서버와 통신 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">비밀번호 변경</h1>

        <p className="mt-2 text-sm text-gray-600">
          보안을 위해 현재 비밀번호를 다시 입력해주세요.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div style={{ 
      padding: '0px', 
      display: 'flex',          // Flexbox 활성화
      flexDirection: 'column',  // 세로 방향으로 나열
      gap: '10px',             // 요소들 사이의 일정한 간격 (margin 대신 사용 권장)
      maxWidth: '300px'         // 로그인 폼이 너무 넓어지지 않도록 제한 (선택 사항)
    }}>
            <label className="mb-1 block text-sm font-medium">
              현재 비밀번호
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-black/20"
            />
          </div>

          <div style={{ 
      padding: '0px', 
      display: 'flex',          // Flexbox 활성화
      flexDirection: 'column',  // 세로 방향으로 나열
      gap: '10px',             // 요소들 사이의 일정한 간격 (margin 대신 사용 권장)
      maxWidth: '300px'         // 로그인 폼이 너무 넓어지지 않도록 제한 (선택 사항)
    }}>
            <label className="mb-1 block text-sm font-medium">
              새 비밀번호
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-black/20"
            />
            <p className="mt-1 text-xs text-gray-500">
              최소 8자 이상, 영문과 숫자를 포함해야 합니다.
            </p>
          </div>

          <div style={{ 
      padding: '0px', 
      display: 'flex',          // Flexbox 활성화
      flexDirection: 'column',  // 세로 방향으로 나열
      gap: '10px',             // 요소들 사이의 일정한 간격 (margin 대신 사용 권장)
      maxWidth: '300px'         // 로그인 폼이 너무 넓어지지 않도록 제한 (선택 사항)
    }}>
            <label className="mb-1 block text-sm font-medium">
              새 비밀번호 확인
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-black/20"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />
            비밀번호 보기
          </label>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-black px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </section>
    </main>
  )
}