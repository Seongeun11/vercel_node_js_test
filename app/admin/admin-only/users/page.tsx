'use client'

import { useState } from 'react'
import AdminHeader from '@/components/admin/AdminHeader'
import UserBulkUpload from './components/user-bulk-upload'
import UserCreateForm from './components/user-create-form'
import UserTableList from './components/user-table-list'
import { useAdminUsers } from './hooks/use-admin-users'

type TabType = 'register' | 'list'

export default function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState<TabType>('register')
  
  const {
    users,
    setUsers,
    usersLoading,
    errorMessage,
    setErrorMessage,
    message,
    setMessage,
    fetchUsers,
  } = useAdminUsers()

  // 탭 변경 시 알림 메시지를 초기화하여 UX 혼선을 방지합니다.
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setMessage('')
    setErrorMessage('')
  }

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      <AdminHeader
        title="회원 관리"
        description="관리자가 수련생, 캡틴, 관리자 계정을 생성하고 목록을 관리할 수 있습니다."
      />

      {/* 🔄 탭 내비게이션 바 */}
      <div style={tabContainerStyle}>
        <button
          type="button"
          onClick={() => handleTabChange('register')}
          style={{
            ...tabButtonStyle,
            borderBottom: activeTab === 'register' ? '2px solid #111827' : '2px solid transparent',
            color: activeTab === 'register' ? '#111827' : '#64748b',
            fontWeight: activeTab === 'register' ? 700 : 500,
          }}
        >
          회원 등록 (개별/일괄)
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('list')}
          style={{
            ...tabButtonStyle,
            borderBottom: activeTab === 'list' ? '2px solid #111827' : '2px solid transparent',
            color: activeTab === 'list' ? '#111827' : '#64748b',
            fontWeight: activeTab === 'list' ? 700 : 500,
          }}
        >
          계정 목록 조회
        </button>
      </div>

      {/* 공통 알림 메시지 영역 */}
      {message && <p style={{ color: 'green', marginTop: '16px', marginBottom: '16px' }}>{message}</p>}
      {errorMessage && <p style={{ color: 'red', marginTop: '16px', marginBottom: '16px' }}>{errorMessage}</p>}

      {/* 탭 콘텐츠 영역 */}
      <div style={{ marginTop: '20px' }}>
        {activeTab === 'register' && (
          <div style={{ display: 'grid', gap: '24px' }}>
            {/* 1. 회원 생성 폼 컴포넌트 */}
            <UserCreateForm
              onSuccess={fetchUsers}
              onSetMessage={setMessage}
              onSetErrorMessage={setErrorMessage}
            />
            
            {/* 3. 엑셀 일괄 업로드 컴포넌트 */}
            <UserBulkUpload />
          </div>
        )}

        {activeTab === 'list' && (
          /* 2. 회원 목록 조회 및 관리 테이블 컴포넌트 */
          <UserTableList
            users={users}
            setUsers={setUsers}
            usersLoading={usersLoading}
            onFetchUsers={fetchUsers}
            onSetMessage={setMessage}
            onSetErrorMessage={setErrorMessage}
          />
        )}
      </div>
    </div>
  )
}

// 🎨 스타일 정의
const tabContainerStyle = {
  display: 'flex',
  borderBottom: '1px solid #e2e8f0',
  marginTop: '20px',
  gap: '8px',
}

const tabButtonStyle = {
  padding: '10px 16px',
  fontSize: '15px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  outline: 'none',
  transition: 'all 0.2s',
}