//app\admin\page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/serverAuth'
//vercel 빌드 형식 dynamic으로 선언
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const authResult = await requireRole(['admin'])

  if (!authResult.ok) {
  if (authResult.status === 401) {
    redirect('/login')
  }
  redirect('/forbidden')
}

  return (
    <main style={{ padding: 24 }}>
      <h1>관리자 페이지</h1>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>

        <Link href="/admin/admin-only/events">
          <button type="button">이벤트 관리</button>

        </Link>
        <Link href="/admin/admin-only/attendance-today">
        <button type="button">오늘 출석 운영</button>
        </Link>
        
        <Link href="/admin/admin-only/qr">
          <button type="button">QR 관리</button>
        </Link>

        <Link href="/admin/admin-only/attendance">
          <button type="button">출석 수정</button>
        </Link>

        <Link href="/admin/admin-only/users">
          <button type="button">사용자 생성</button>
        </Link>
      </div>
    </main>
  )
}