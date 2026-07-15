//app\admin\admin-only\users\components\user-table-list.tsx
'use client'

import { useState, useEffect } from 'react'
import EnrollmentStatusToggle from './enrollment-status'
import ResetPasswordPanel from './reset-password-panel'
import AffiliationSelect from '@/components/common/affiliation-select' // 🔄 공용 컴포넌트
import { AdminUser, UserRole } from '../hooks/use-admin-users'
import UpdateNamePanel from './update-name-panel' // 이름변경


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
  const [setIsUserListOpen] = useState(false)
  const [selectedPasswordUser, setSelectedPasswordUser] = useState<AdminUser | null>(null)

  const [selectedNameUser, setSelectedNameUser] = useState<AdminUser | null>(null) // 🔄 이름 변경 대상 유저 상태 추가
  
  // 🔍 공용 컴포넌트가 선택하는 소속 고유 ID 문자열 저장 ("1", "2" 등)
  // 🎯 [요청 반영] 초기 소속 필터 기본값을 '1' (아카데미)로 설정합니다.
  const [filterAffiliationId, setFilterAffiliationId] = useState<string>('1')
  // 🎓 2. 재학/수료 상태 필터 추가 (기본값: 'active'로 설정하여 재학생만 우선 노출)
  // 'all' | 'active' | 'completed'
  const [filterEnrollment, setFilterEnrollment] = useState<string>('active')

  // 🗺️ 고유 ID를 한글 소속 명칭으로 변환하기 위한 사전 매핑 정보 사전 객체
  const [affiliationMap, setAffiliationMap] = useState<Record<string, string>>({})

  // 🔄 컴포넌트 마운트 시 전체 소속 리스트를 가져와 { "1": "아카데미", "2": "영성" } 형태의 지도 자료구조 빌드
  useEffect(() => {
    async function fetchAffiliationMeta() {
      try {
        const res = await fetch('/api/affiliations', { method: 'GET', cache: 'no-store' })
        const result = await res.json()
        if (res.ok && result.success && Array.isArray(result.data)) {
          const dict: Record<string, string> = {}
          result.data.forEach((item: { id: number; name: string }) => {
            dict[String(item.id)] = item.name // 예시: dict["1"] = "아카데미"
          })
          setAffiliationMap(dict)
        }
      } catch (err) {
        console.error('[UserTableList] 소속 메타데이터 동기화 실패:', err)
      }
    }
    void fetchAffiliationMeta()
    // 💡 목록이 상시 노출되므로, 진입 시 데이터가 없다면 자동으로 불러옵니다.
    if (users.length === 0) {
      onFetchUsers()
    }
  }, [])



    

    

  // 🔥 [복합 교정 구역] 소속 필터링과 재학/수료 상태 필터링을 체이닝 방식으로 결합
  // 🔥 [논리오류 교정 완료] 결합형 필터링 로직
  const filteredUsers = users.filter((user) => {
    // ---- [파트 A: 소속 필터링] ----
    // 'all' 이거나 빈 값인 경우는 필터를 생략하고 전체를 보여줍니다.
    if (filterAffiliationId && filterAffiliationId !== 'all' && filterAffiliationId !== '') {
      const targetAffiliationName = affiliationMap[filterAffiliationId]
      
      // 💡 [핵심 교정] 아직 API 조회가 완료되지 않아 매핑 딕셔너리가 빈 값일 경우, 
      // 리스트를 다 지워버리는 대신 필터 검사를 임시 통과시켜 튕김 현상을 원천 방지합니다.
      if (!targetAffiliationName) return true 

      const userAffiliation = typeof (user as any).affiliation === 'object'
        ? (user as any).affiliation?.name
        : user.affiliation;

      if (String(userAffiliation).trim() !== targetAffiliationName.trim()) {
        return false
      }
    }

    // ---- [파트 B: 재학/수료 필터링 추가] ----
    if (filterEnrollment !== 'all') {
      // user.enrollment_status 값이 'active' 혹은 'completed' 인지 매칭 점검
      if (user.enrollment_status !== filterEnrollment) {
        return false
      }
    }

    return true
  })

  return (
    <div style={{ marginTop: '24px', border: '1px solid #ddd', borderRadius: '12px', background: '#fff', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>계정 목록</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>

          {/* 🎓 재학/수료 토글 필터 셀렉터 추가 배치 */}
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
          
          {/* 🔄 공용 소속 셀렉트 박스 컴포넌트 연동 배치 구역 */}
          {
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px', color: '#475569', fontWeight: 500 }}>소속 필터:</span>
              <AffiliationSelect
                value={filterAffiliationId}
                onChange={(val) => setFilterAffiliationId(val)} // 공용 컴포넌트 내부 e.target.value 전달 규격 호환
                showAllOption={true}
                allOptionLabel="전체 보기"
              />
            </div>
          }

          <div style={{ display: 'flex', gap: '8px' }}>
            

            <button type="button" onClick={onFetchUsers} disabled={usersLoading}>
              {usersLoading ? '불러오는 중...' : '새로고침'}
            </button>
          </div>
        </div>
      </div>

      {
        <>
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
    <th style={{ borderBottom: '2px solid #e2e8f0', padding: '10px', textAlign: 'left' }}>이름 변경</th> 
    <th style={{ borderBottom: '2px solid #e2e8f0', padding: '10px', textAlign: 'left' }}>비밀번호</th> 
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

                    return (
                      <tr key={user.id} style={{ transition: 'background 0.2s' }}>
                        <td style={{ borderBottom: '1px solid #edf2f7', padding: '10px' }}>{user.student_id}</td>
                        <td style={{ borderBottom: '1px solid #edf2f7', padding: '10px' }}>{user.full_name}</td>
                        <td style={{ borderBottom: '1px solid #edf2f7', padding: '10px' }}>{getRoleLabel(user.role)}</td>
                        <td style={{ borderBottom: '1px solid #edf2f7', padding: '10px' }}>{user.cohort_no ?? '-'}</td>
                        <td style={{ borderBottom: '1px solid #edf2f7', padding: '10px' }}>
                          <EnrollmentStatusToggle
                            user={user}
                            onUpdated={(updatedUser) => {
                              setUsers((prevUsers) =>
                                prevUsers.map((prevUser) =>
                                  prevUser.id === updatedUser.id ? { ...prevUser, ...updatedUser } : prevUser
                                )
                              )
                            }}
                          />
                        </td>
                        <td style={{ borderBottom: '1px solid #edf2f7', padding: '10px' }}>
                          <span style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '13px' }}>
                            {displayAffiliation}
                          </span>
                        </td>

                        {/* 🔄 [새로 추가] 이름 변경 버튼 */}
                        <td style={{ borderBottom: '1px solid #edf2f7', padding: '10px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedNameUser(user)
                              setSelectedPasswordUser(null) // 충돌 방지 차원에서 비밀번호 패널은 닫아줍니다.
                              onSetMessage('') 
                              onSetErrorMessage('') 
                            }}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              fontSize: '13px',
                              cursor: 'pointer'
                            }}
                          >
                            변경
                          </button>
                        </td>

                        <td style={{ borderBottom: '1px solid #edf2f7', padding: '10px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPasswordUser(user)
                              setSelectedNameUser(null) // 이름 변경 패널은 닫아줍니다
                              onSetMessage('')
                              onSetErrorMessage('')
                            }}
                          >
                            변경
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {selectedPasswordUser && (
            <ResetPasswordPanel
              user={selectedPasswordUser}
              onCancel={() => setSelectedPasswordUser(null)}
              onSuccess={() => setSelectedPasswordUser(null)}
            />
          )}

          {/* 🔄 [새로 추가] 이름 변경 패널 */}
          {selectedNameUser && (
            <UpdateNamePanel
              user={selectedNameUser}
              onCancel={() => setSelectedNameUser(null)}
              onSuccess={(updatedUser) => {
                // 로컬 user 리스트 상태 동기화 처리
                setUsers((prevUsers) =>
                  prevUsers.map((u) => (u.id === updatedUser.id ? { ...u, full_name: updatedUser.full_name } : u))
                )
                setSelectedNameUser(null)
              }}
            />
          )}
        </>
        
      }
      
    </div>
    
  )
}