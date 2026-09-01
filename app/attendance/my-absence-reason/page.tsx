//app\attendance\my-absence-reason\page.tsx
import { getSessionProfile } from '@/lib/server-session'
import { redirect } from 'next/navigation'
import AbsenceReasonManager from './components/absence-reason-manager'
import { AbsenceType } from './components/absence-reason-list' // 경로 수정
import Link from 'next/link'
export default async function AbsencePage() {
  const session = await getSessionProfile(['trainee', 'captain', 'admin'])
  if (!session.ok) {
    redirect('/login')
  }

  const { data: absenceTypes } = await session.supabase
    .from('absence_type')
    .select('id, text')
    .order('id', { ascending: true })

  const safeAbsenceTypes: AbsenceType[] = Array.isArray(absenceTypes) ? absenceTypes : []

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ marginBottom: '8px' }}>내 결석 사유 관리</h1>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        결석 사유를 등록, 조회, 수정 및 삭제할 수 있습니다.
      </p>
      
      <div style={{ display: 'flex', gap: '22px', flexWrap: 'wrap'}}>
            <Link href="/">
              <button type="button">메인으로</button>
            </Link>
            {/*
            <Link href="/attendance/requests">
              <button type="button">내 변경 요청 보기</button>
            </Link>
            */}
          </div>
          

      <AbsenceReasonManager absenceTypes={safeAbsenceTypes} />
    </main>
  )
}