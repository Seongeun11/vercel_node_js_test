//app\admin\admin-only\users\page.tsx
'use client'

import AdminHeader from '@/components/admin/AdminHeader'
import UserBulkUpload from './user-bulk-upload'
import UserCreateForm from './components/user-create-form'
import UserTableList from './components/user-table-list'
import { useAdminUsers } from './hooks/use-admin-users'

export default function AdminUsersPage() {
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

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      <AdminHeader
        title="회원 생성"
        description="관리자가 수련생, 캡틴, 관리자 계정을 생성할 수 있습니다."
      />

      {/* 1. 회원 생성 폼 컴포넌트 */}
      <UserCreateForm
        onSuccess={fetchUsers}
        onSetMessage={setMessage}
        onSetErrorMessage={setErrorMessage}
      />

      {/* 알림 메시지 영역 */}
      {message && <p style={{ color: 'green', marginTop: '16px' }}>{message}</p>}
      {errorMessage && <p style={{ color: 'red', marginTop: '16px' }}>{errorMessage}</p>}

      {/* 2. 회원 목록 조회 및 관리 테이블 컴포넌트 */}
      <UserTableList
        users={users}
        setUsers={setUsers}
        usersLoading={usersLoading}
        onFetchUsers={fetchUsers}
        onSetMessage={setMessage}
        onSetErrorMessage={setErrorMessage}
      />

      {/* 3. 엑셀 일괄 업로드 컴포넌트 */}
      <UserBulkUpload />
    </div>
  )
}