// app/admin/layout.tsx
import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

type Props = {
  children: ReactNode
}

const navLinkStyle: React.CSSProperties = {
  display: 'block',
  padding: '10px 12px',
  borderRadius: '8px',
  textDecoration: 'none',
  color: '#111827',
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
}

export default async function AdminLayout({ children }: Props) {
  const authResult = await requireRole(['admin', 'captain'])

  if (!authResult.ok) {
    redirect('/forbidden')
  }

  const user = authResult.user

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <div
        style={{
          borderBottom: '1px solid #e5e7eb',
          background: '#fff',
          padding: '16px 24px',
        }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: '24px' }}>운영 페이지</h1>
          <p style={{ margin: '8px 0 0', color: '#4b5563' }}>
            사용자: {user.full_name} ({user.student_id}) / 권한: {user.role}
          </p>
        </div>
      </div>

      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '240px 1fr',
          gap: '24px',
          padding: '24px',
          alignItems: 'start',
        }}
      >
        <aside
          style={{
            border: '1px solid #ddd',
            borderRadius: '12px',
            background: '#fff',
            padding: '16px',
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>
            운영 메뉴
          </h2>

          <nav style={{ display: 'grid', gap: '8px' }}>
            <Link href="/admin/admin-only/logs" style={navLinkStyle}>
              출석 로그

            </Link>
            {(user.role === 'captain' || user.role === 'admin') && (
              <Link href="/admin/requests"style={navLinkStyle}>
                출석 변경 요청 처리</Link>
            )}

            {user.role === 'admin' && (
              <>
                <Link href="/admin/admin-only/attendance/monthly" style={navLinkStyle}>
                  월별 출석 조회
                </Link>
                <Link href="/admin/admin-only/attendance-today" style={navLinkStyle}>
        오늘 출석 운영
        </Link>
                <Link href="/admin/admin-only/attendance" style={navLinkStyle}>
                  출석 조회 및 수정
                </Link>
                {/* 
                <Link href="/admin/admin-only/qr" style={navLinkStyle}>
                  QR 관리
                </Link>
                */}
                <Link href="/admin/admin-only/events" style={navLinkStyle}>
                  행사 관리
                </Link>
                <Link href="/admin/admin-only/users" style={navLinkStyle}>
                  회원 관리
                </Link>
                        
            <Link href="/admin/admin-only/export" style={navLinkStyle}>
              엑셀로 내보내기
            </Link>
              </>
            )}

            <Link href="/" style={navLinkStyle}>
              메인으로
            </Link>
          </nav>
        </aside>

        <main>{children}</main>
      </div>
    </div>
  )
}