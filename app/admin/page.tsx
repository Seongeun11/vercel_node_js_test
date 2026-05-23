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
      <h1>관리자용 출석관리 페이지</h1>
      26.05.06 업데이트<br />
      사용자 계정에 소속을 추가했습니다. ('아카데미', '영성', '모심', '효진정', '성화영성')<br />
      2026.05.12 업데이트<br />
      데이터베이스에 제2 정규화를 적용했습니다.
      2026.05.21 업데이트<br />
      페이지 최적화 및 오류 수정, supabase 자동 실행 함수등록(create_manual_attendance)
    </main>
  )
}