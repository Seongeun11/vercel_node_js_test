'use client'

import { useState, useEffect } from 'react'
import EnrollmentStatusToggle from '../enrollment-status'
import ResetPasswordPanel from '../reset-password-panel'
import AffiliationSelect from '@/components/common/affiliation-select' // 🔄 공용 컴포넌트
import { AdminUser, UserRole } from '../hooks/use-admin-users'

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
  const [isUserListOpen, setIsUserListOpen] = useState(false)
  const [selectedPasswordUser, setSelectedPasswordUser] = useState<AdminUser | null>(null)
  
  // 🔍 공용 컴포넌트가 선택하는 소속 고유 ID 문자열 저장 ("1", "2" 등)
  const [filterAffiliationId, setFilterAffiliationId] = useState<string>('')

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
  }, [])

  // 리스트 토글 및 데이터 페칭 핸들러
  const handleToggleList = () => {
    const nextState = !isUserListOpen
    setIsUserListOpen(nextState)

    if (nextState && users.length === 0) {
      onFetchUsers()
    }

    if (!nextState) {
      setSelectedPasswordUser(null)
      setFilterAffiliationId('') // 테이블 접힐 때 필터 초기화
    }
  }

  // 🔥 [완벽 교정 구역] 번호형 ID와 문자열 소속 한글 명칭을 유기적으로 이어주는 크로스 매칭 필터링
  const filteredUsers = users.filter((user) => {
    // 1. 소속 필터가 비어있거나 전체 보기 상태이면 검사 없이 무조건 노출
    if (!filterAffiliationId) return true

    // 2. 선택된 고유 ID에 대응하는 데이터베이스상의 진짜 한글 소속 명칭 탐색
    const targetAffiliationName = affiliationMap[filterAffiliationId]

    // 3. 만약 소속 맵 로딩이 미처 완료되지 않았거나 대응값을 찾지 못했다면 일단 비노출 차단
    if (!targetAffiliationName) return false

    // 4. 유저 데이터 객체 내부의 실제 값 탐색 및 동치성 점검
    const userAffiliation = typeof (user as any).affiliation === 'object'
      ? (user as any).affiliation?.name // 혹시 모를 객체형 구조 대비 방어선
      : user.affiliation;              // 현재의 순수 텍스트 포맷 ("아카데미")

    // 최종 비교: "아카데미" === "아카데미" 매칭 성공 보장
    return String(userAffiliation).trim() === targetAffiliationName.trim()
  })

  return (
    <div style={{ marginTop: '24px', border: '1px solid #ddd', borderRadius: '12px', background: '#fff', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>계정 목록</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* 🔄 공용 소속 셀렉트 박스 컴포넌트 연동 배치 구역 */}
          {isUserListOpen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px', color: '#475569', fontWeight: 500 }}>소속 필터:</span>
              <AffiliationSelect
                value={filterAffiliationId}
                onChange={(val) => setFilterAffiliationId(val)} // 공용 컴포넌트 내부 e.target.value 전달 규격 호환
                showAllOption={true}
                allOptionLabel="전체 보기"
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={handleToggleList}>
              {isUserListOpen ? '접기' : '펼치기'}
            </button>

            <button type="button" onClick={onFetchUsers} disabled={usersLoading}>
              {usersLoading ? '불러오는 중...' : '새로고침'}
            </button>
          </div>
        </div>
      </div>

      {isUserListOpen && (
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
                        <td style={{ borderBottom: '1px solid #edf2f7', padding: '10px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPasswordUser(user)
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
        </>
      )}
    </div>
  )
}