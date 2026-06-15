// app\admin\admin-only\layout.tsx
import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/serverAuth'

//export const dynamic = 'force-dynamic'

// Next.js가 주소창에서 추출한 params 타입을 정의합니다.
// Next.js 최신 버전 규격: params는 Promise 형태로 들어옵니다.
/*
type Props = {
  children: ReactNode
  params: Promise<{
    programType: string
  }>
}*/
// 주소창 영문(Key)을 Supabase 테이블의 실제 name(Value)으로 맵핑하는 사전 정의
const PROGRAM_NAME_MAP: Record<string, string> = {
  academy: '아카데미',
  spirituality: '영성 40일',
  mosim: '모심 40일',
  hujin: '효진정',
  seonghwa: '성화영성',
  resonance: '3일 공명기도',
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
// 1. ReactNode 타입의 children을 프롭으로 받습니다.
type Props = {
  children: ReactNode
}
// 컴포넌트 인자에 params를 추가합니다.
export default async function AdminLayout({ children }: Props) {
  const authResult = await requireRole(['admin', 'captain'])

  if (!authResult.ok) {
    redirect('/forbidden')
  }

  const user = authResult.user

  // Promise로 감싸진 params를 await로 안전하게 꺼냅니다.
  //const resolvedParams = await params
  //const currentProgram = resolvedParams.programType || 'academy'

  // 사전을 이용해 한글 명칭 변환 (정의되지 않은 경로 대비 예외처리 포함)
  //const supabaseProgramName = PROGRAM_NAME_MAP[currentProgram] || currentProgram

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
          <h1 style={{ margin: 0, fontSize: '24px' }}> 운영 페이지</h1>
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
           
            
            {/* 
            {(user.role === 'captain' || user.role === 'admin') && (
              <Link href="/admin/requests"style={navLinkStyle}>
                출석 변경 요청 처리</Link>
            )}*/}

            {user.role === 'admin' && (
              <>
                <Link href={`/admin/admin-only/logs`} style={navLinkStyle}>
                  출석 로그
                </Link>
                <Link href={`/admin/admin-only/attendance`} style={navLinkStyle}>
                  출석 조회 및 수정
                </Link>
                <Link href={`/admin/admin-only/attendance/monthly`} style={navLinkStyle}>
                  월별 출석 조회
                </Link>
                <Link href={`/admin/admin-only/attendance-today`} style={navLinkStyle}>
                  오늘 출석 운영
                </Link>
                <Link href={`/admin/admin-only/qr`} style={navLinkStyle}>
                  QR 관리
                </Link>
                <Link href={`/admin/admin-only/events`} style={navLinkStyle}>
                  행사 관리
                </Link>
                <Link href={`/admin/admin-only/users`} style={navLinkStyle}>
                  회원 관리
                </Link>
                <Link href={`/admin/admin-only/points`} style={navLinkStyle}>
                  포인트 관리
                </Link>
                <Link href={`/admin/admin-only/export`} style={navLinkStyle}>
                  엑셀로 내보내기
                </Link>
              </>
            )}

            <Link href="/" style={navLinkStyle}>
              메인으로
            </Link>
          </nav>
        </aside>

        <main style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', minHeight: '500px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}