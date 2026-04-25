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
      <h1>월별 출석관리</h1>

      
    </main>
  )
}