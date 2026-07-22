'use client'

// 🛠️ 오류 해결: UMD 글로벌 참조 에러 방지를 위해 명시적으로 React 추가 임포트
import React, { useState, useEffect } from 'react'
import EnrollmentStatusToggle from './enrollment-status'

import AffiliationSelect from '@/components/common/affiliation-select' // 🔄 공용 컴포넌트
import { AdminUser, UserRole } from '../hooks/use-admin-users'
import UserEditPanel from './user-edit-panel' // 통합 패널 

const ROLE_OPTIONS = [
  { value: 'admin', label: '관리자', id: 1 },
  { value: 'captain', label: '캡틴', id: 2 },
  { value: 'trainee', label: '수련생', id: 3 },
] as const

type Props = {
  users: AdminUser[]
  setUsers: React.Dispatch<React.SetStateAction<AdminUser[]>>
  usersLoading: boolean
  onFetchUsers: () => void
  onSetMessage: (msg: string) => void
  onSetErrorMessage: (msg: string) => void
}

function getRoleLabel(role: string | UserRole | null | undefined): string {
  if (!role) return '권한 없음'
  const roleName = typeof role === 'object' && 'name' in role ? role.name : role
  const matchedOption = ROLE_OPTIONS.find((option) => option.value === roleName)
  return matchedOption?.label ?? String(roleName)
}

export default function UserTableList({
  users,
  setUsers,
  usersLoading,
  onFetchUsers,
  onSetMessage,
  onSetErrorMessage,
}: Props) {
  
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [filterAffiliationId, setFilterAffiliationId] = useState<string>('1')
  const [filterEnrollment, setFilterEnrollment] = useState<string>('active')
  const [affiliationMap, setAffiliationMap] = useState<Record<string, string>>({})

  useEffect(() => {
    async function fetchAffiliationMeta() {
      try {
        const res = await fetch('/api/affiliations', { method: 'GET', cache: 'no-store' })
        const result = await res.json()
        if (res.ok && result.success && Array.isArray(result.data)) {
          const dict: Record<string, string> = {}
          result.data.forEach((item: { id: number; name: string }) => {
            dict[String(item.id)] = item.name
          })
          setAffiliationMap(dict)
        }
      } catch (err) {
        console.error('[UserTableList] 소속 메타데이터 동기화 실패:', err)
      }
    }
    void fetchAffiliationMeta()
    if (users.length === 0) {
      onFetchUsers()
    }
  }, [])

  const filteredUsers = users.filter((user) => {
    if (filterAffiliationId && filterAffiliationId !== 'all' && filterAffiliationId !== '') {
      const targetAffiliationName = affiliationMap[filterAffiliationId]
      if (!targetAffiliationName) return true 

      const userAffiliation = typeof (user as any).affiliation === 'object'
        ? (user as any).affiliation?.name
        : user.affiliation;

      if (String(userAffiliation).trim() !== targetAffiliationName.trim()) {
        return false
      }
    }

    if (filterEnrollment !== 'all') {
      if (user.enrollment_status !== filterEnrollment) {
        return false
      }
    }
    
    return true
  })

  const handleUpdateUserData = (updatedUser: AdminUser) => {
    setUsers((prevUsers) =>
      prevUsers.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u))
    )
  }

  return (
    <div style={{ marginTop: '24px', border: '1px solid #ddd', borderRadius: '12px', background: '#fff', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>계정 목록</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* 상태 필터 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px', color: '#475569', fontWeight: 500 }}>상태 필터:</span>
            <select
              value={filterEnrollment}
              onChange={(e) => setFilterEnrollment(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                backgroundColor: '#fff',
                outline: 'none'
              }}
            >
              <option value="active">재학생만 보기</option>
              <option value="completed">수료생만 보기</option>
              <option value="all">전체 상태 보기</option>
            </select>
          </div>
          
          {/* 소속 필터 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px', color: '#475569', fontWeight: 500 }}>소속 필터:</span>
            <AffiliationSelect
              value={filterAffiliationId}
              onChange={(val) => setFilterAffiliationId(val)}
              showAllOption={true}
              allOptionLabel="전체 보기"
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={onFetchUsers} disabled={usersLoading}>
              {usersLoading ? '불러오는 중...' : '새로고침'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginTop: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ borderBottom: '2px solid #e2e8f0', padding: '10px', textAlign: 'left' }}>학번</th> 
              <th style={{ borderBottom: '2px solid #e2e8f0', padding: '10px', textAlign: 'left' }}>이름</th> 
              <th style={{ borderBottom: '2px solid #e2e8f0', padding: '10px', textAlign: 'left' }}>권한</th> 
              <th style={{ borderBottom: '2px solid #e2e8f0', padding: '10px', textAlign: 'left' }}>기수</th> 
              <th style={{ borderBottom: '2px solid #e2e8f0', padding: '10px', textAlign: 'left' }}>재학/수료</th> 
              <th style={{ borderBottom: '2px solid #e2e8f0', padding: '10px', textAlign: 'left' }}>소속</th> 
              <th style={{ borderBottom: '2px solid #e2e8f0', padding: '10px', textAlign: 'left' }}>계정변경</th> 
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                  {users.length === 0 ? '표시할 계정이 없습니다.' : '선택한 소속에 해당하는 회원이 없습니다.'}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const displayAffiliation = typeof user.affiliation === 'object'
                  ? (user.affiliation as any)?.name ?? '-'
                  : user.affiliation;
                const isEditingThisUser = editingUserId === user.id;
                
                return (
                  <React.Fragment key={user.id}>
                    <tr style={{ transition: 'background 0.2s', background: isEditingThisUser ? '#f8fafc' : 'transparent' }}>
                      <td style={{ borderBottom: '1px solid #edf2f7', padding: '10px' }}>{user.student_id}</td>
                      <td style={{ borderBottom: '1px solid #edf2f7', padding: '10px' }}>{user.full_name}</td>
                      <td style={{ borderBottom: '1px solid #edf2f7', padding: '10px' }}>{getRoleLabel(user.role)}</td>
                      <td style={{ borderBottom: '1px solid #edf2f7', padding: '10px' }}>{user.cohort_no ?? '-'}</td>
                      <td style={{ borderBottom: '1px solid #edf2f7', padding: '10px' }}>
                        <EnrollmentStatusToggle
                          user={user}
                          onUpdated={handleUpdateUserData}
                        />
                      </td>
                      <td style={{ borderBottom: '1px solid #edf2f7', padding: '10px' }}>
                        <span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '13px' }}>
                          {displayAffiliation}
                        </span>
                      </td>
                      <td style={{ borderBottom: '1px solid #edf2f7', padding: '10px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            onSetMessage('')
                            onSetErrorMessage('')
                            setEditingUserId(isEditingThisUser ? null : user.id)
                          }}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: isEditingThisUser ? '#3b82f6' : '#f1f5f9',
                            color: isEditingThisUser ? '#ffffff' : '#000000',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: isEditingThisUser ? 600 : 400
                          }}
                        >
                          {isEditingThisUser ? '닫기' : '변경'}
                        </button>
                      </td>
                    </tr>

                    {/* 패널 삽입 영역 */}
                    {isEditingThisUser && (
                      <tr>
                        <td colSpan={7} style={{ padding: '4px 12px 12px 12px', borderBottom: '1px solid #cbd5e1', background: '#f8fafc' }}>
                          {/* 🛠️ 오류 해결: 필수 속성인 initialMode('name')를 전달하고 확장된 Prop을 정상 연결 */}
                          <UserEditPanel
                            user={user}
                            initialMode="profile"
                            onCancel={() => setEditingUserId(null)}
                            onSuccess={(updatedUser) => {
                              if (updatedUser) {
                                handleUpdateUserData(updatedUser)
                              }
                              setEditingUserId(null)
                            }}
                            onSetMessage={onSetMessage}
                            onSetErrorMessage={onSetErrorMessage}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}