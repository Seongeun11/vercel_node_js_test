import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/serverAuth'

export default async function AdminPage() {
  const authResult = await requireRole(['admin'])

  if (!authResult.ok) {
    redirect('/')
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>관리자 페이지</h1>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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
      </div>
    </main>
  )
}