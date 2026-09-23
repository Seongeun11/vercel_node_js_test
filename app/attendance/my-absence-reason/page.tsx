import { getSessionProfile } from '@/lib/server-session'
import { redirect } from 'next/navigation'
import AbsenceReasonManager from './components/absence-reason-manager'
import { AbsenceType } from './components/absence-reason-list'
import Link from 'next/link'

export default async function AbsencePage() {
  const session = await getSessionProfile(['trainee', 'captain', 'admin'])
  if (!session.ok) {
    redirect('/login')
  }

  // 1. 결석 구분 목록 조회
  const { data: absenceTypes } = await session.supabase
    .from('absence_type')
    .select('id, text')
    .order('id', { ascending: true })

  // 2. 선택 가능한 행사 목록 조회
  let eventsQuery = session.supabase
    .from('events')
    .select('id, name, start_time')
    .is('deleted_at', null)
    .eq('is_active', true)

  // 타입 단언 및 affiliation_id 존재 여부 확인
  const profile = session.profile as typeof session.profile & { affiliation_id?: number }
  
  if (profile?.affiliation_id) {
    eventsQuery = eventsQuery.or(`affiliations_id.eq.${profile.affiliation_id},affiliations_id.is.null`)
  }

  const { data: events } = await eventsQuery.order('start_time', { ascending: false })

  const safeAbsenceTypes: AbsenceType[] = Array.isArray(absenceTypes) ? absenceTypes : []
  const safeEvents = Array.isArray(events) ? events : []

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ marginBottom: '8px' }}>내 결석 사유 관리</h1>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        행사를 선택하여 결석 사유를 등록, 조회, 수정 및 삭제할 수 있습니다.
      </p>

      <div style={{ display: 'flex', gap: '22px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <Link href="/">
          <button type="button">메인으로</button>
        </Link>
      </div>

      <AbsenceReasonManager 
        absenceTypes={safeAbsenceTypes} 
        events={safeEvents} 
      />
    </main>
  )
}