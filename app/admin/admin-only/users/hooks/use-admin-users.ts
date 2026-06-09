//app\admin\admin-only\users\hooks\use-admin-users.ts
'use client'

import { useState } from 'react'

export type EnrollmentStatus = 'active' | 'completed'
export type UserRole = { id: number; name: string }
export type AdminUser = {
  id: string
  student_id: string
  full_name: string
  cohort_no: number | null
  enrollment_status: EnrollmentStatus
  role?: UserRole | null
  affiliation: string
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [message, setMessage] = useState('')

  async function fetchUsers() {
    try {
      setUsersLoading(true) // 
      const response = await fetch('/api/profiles/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      const text = await response.text()
      const result = text ? JSON.parse(text) : {}

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

  return {
    users,
    setUsers,
    usersLoading,
    errorMessage,
    setErrorMessage,
    message,
    setMessage,
    fetchUsers,
  }
}