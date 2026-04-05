import { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/serverAuth'

type Props = {
  children: ReactNode
}

export default async function AdminLayout({ children }: Props) {
  const authResult = await requireRole(['admin'])

  if (!authResult.ok) {
    redirect('/login?next=/admin')
  }

  const user = authResult.user

  return (
    <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '12px',
          background: '#fff',
          padding: '20px',
          marginBottom: '20px',
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: '8px' }}>관리자 페이지</h1>
        <p style={{ margin: 0 }}>
          관리자: {user.full_name} ({user.student_id})
        </p>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            marginTop: '16px',
          }}
        >
          <Link href="/admin">
            <button type="button">관리자 홈</button>
          </Link>
          <Link href="/admin/events">
            <button type="button">이벤트 관리</button>
          </Link>
          <Link href="/admin/qr">
            <button type="button">QR 관리</button>
          </Link>
          <Link href="/admin/attendance">
            <button type="button">출석 현황</button>
          </Link>
          <Link href="/admin/users">
            <button type="button">사용자 생성</button>
          </Link>
          <Link href="/">
            <button type="button">메인으로</button>
          </Link>
        </div>
      </div>

      {children}
    </main>
  )
}