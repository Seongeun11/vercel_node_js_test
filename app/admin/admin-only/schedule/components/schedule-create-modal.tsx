//app\admin\admin-only\schedule\components\schedule-create-modal.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { AbsenceType, ScheduleItem } from '../page'

type Props = {
  absenceTypes: AbsenceType[]
  onClose: () => void
  onSuccess: (newSchedule: ScheduleItem) => void
}

type UserProfile = {
  id: string
  full_name: string
  student_id: string
  affiliation: string
}

export default function ScheduleCreateModal({ absenceTypes, onClose, onSuccess }: Props) {
  const getTodayStr = () => new Date().toISOString().split('T')[0]

  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [userList, setUserList] = useState<UserProfile[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const [absenceType, setAbsenceType] = useState<number>(absenceTypes[0]?.id || 1)
  const [startDate, setStartDate] = useState(getTodayStr())
  const [endDate, setEndDate] = useState(getTodayStr())
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // enrollment_status가 active인 유저 목록만 불러오기
  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true)
      try {
        const res = await fetch('/api/profiles/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' }),
        })
        const data = await res.json()
        if (res.ok && data.users) {
          setUserList(data.users)
        }
      } catch (err) {
        console.error('유저 목록 불러오기 실패:', err)
      } finally {
        setLoadingUsers(false)
      }
    }
    fetchUsers()
  }, [])

  const filteredUsers = userList.filter((u) => {
    if (!userSearchTerm.trim()) return true
    const term = userSearchTerm.toLowerCase()
    return (
      u.full_name?.toLowerCase().includes(term) ||
      u.student_id?.toLowerCase().includes(term) ||
      u.affiliation?.toLowerCase().includes(term)
    )
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) {
      setError('유저를 검색 후 선택해주세요.')
      return
    }
    if (!startDate || !endDate) {
      setError('시작날짜와 종료날짜를 입력해주세요.')
      return
    }
    if (startDate > endDate) {
      setError('종료날짜는 시작날짜보다 빠를 수 없습니다.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/admin/users/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.id,
          absence_type: Number(absenceType),
          start_date: startDate,
          end_date: endDate,
          absence_reason: reason,
        }),
      })

      const data = await res.json()
      if (res.ok && data.schedule) {
        onSuccess(data.schedule)
      } else {
        setError(data.error || '등록 중 오류가 발생했습니다.')
      }
    } catch (err) {
      setError('서버 요청 실패')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>스케쥴 직접 등록</h2>

        {error && <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', marginBottom: '12px', fontSize: '14px' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* 유저 검색 및 선택 */}
          <div style={{ marginBottom: '12px', position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', fontWeight: 500 }}>유저 검색 (이름/학번/소속)</label>
            {selectedUser ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f1f5f9', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}>
                <div>
                  <strong>{selectedUser.full_name}</strong> ({selectedUser.student_id}) - {selectedUser.affiliation}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(null)
                    setUserSearchTerm('')
                  }}
                  style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  변경
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(e) => {
                    setUserSearchTerm(e.target.value)
                    setShowDropdown(true)
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="이름 또는 학번 검색..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
                {showDropdown && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '180px', overflowY: 'auto', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', zIndex: 10, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                    {loadingUsers ? (
                      <div style={{ padding: '8px 12px', color: '#94a3b8', fontSize: '13px' }}>유저 목록 불러오는 중...</div>
                    ) : filteredUsers.length === 0 ? (
                      <div style={{ padding: '8px 12px', color: '#94a3b8', fontSize: '13px' }}>검색 결과가 없습니다.</div>
                    ) : (
                      filteredUsers.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => {
                            setSelectedUser(u)
                            setShowDropdown(false)
                          }}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <strong>{u.full_name}</strong> ({u.student_id}) | {u.affiliation}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 외출 유형 */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', fontWeight: 500 }}>외출 유형</label>
            <select
              value={absenceType}
              onChange={(e) => setAbsenceType(Number(e.target.value))}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
            >
              {absenceTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.text}
                </option>
              ))}
            </select>
          </div>

          {/* 날짜 선택 (시작날짜 / 종료날짜) */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', fontWeight: 500 }}>시작 날짜</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', fontWeight: 500 }}>종료 날짜</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              />
            </div>
          </div>

          {/* 사유 */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px', fontWeight: 500 }}>사유</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="외출/휴가 사유를 입력하세요."
              rows={3}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
            >
              {submitting ? '등록 중...' : '등록하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}