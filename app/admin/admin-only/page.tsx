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
      사용자 계정에 소속을 추가했습니다. ('아카데미', '영성', '모심', '효진정', '성화영성', '3일 공명기도')<br />
      2026.05.12 업데이트<br />
      데이터베이스에 제2 정규화를 적용했습니다.<br />
      2026.05.21 업데이트<br />
      supabase 자동오늘회차등록 - 실행시간 kst 03시 - 함수등록: cron_create_today_occurrences <br />== vercel웹사이트경로와 정확히 일치해야함<br />
      2026.06.01 업데이트<br /> 
      소속 필터링 추가: components\common\affiliation-select.tsx
      <br/>2026.06.01 업데이트<br /> 
      supabase 자동 실행 함수등록: fn_sync_attendance_to_points<br/>
      [public.attendance][포인트 통합 트리거](데이터 변동)(자동 정산)
      <br/>2026.07.04 업데이트<br /> 
      supabase 자동 결석 처리 - 실행시간 kst 02시 - 함수등록: cron_daily-attendance-auto-close-job<br/>== mark_absent_by_occurrence_with_log 와 연동되어 순차 결석처리됨.<br />


    </main>
  )
}