// app/page.tsx
import Link from 'next/link'
import { getCurrentUser } from '@/lib/serverAuth'
import LogoutButton from '@/components/LogoutButton'

// 서버에서 사용하는 사용자 타입 정의 (최소 필드만)
type User = {
  full_name: string
  student_id: string
  role: 'admin' | 'captain' | 'trainee'
} | null

export default async function HomePage() {
  const user: User = await getCurrentUser()

  return (
    <main style={{ maxWidth: '860px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ marginBottom: '12px' }}>천심 영성 아카데미 출석 체크</h1>

      {!user ? (
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: '12px',
            padding: '20px',
            background: '#fff',
          }}
        >
          <p style={{ marginTop: 0 }}>로그인이 필요합니다.</p>
          <Link href="/login">
            <button type="button">로그인하러 가기</button>
          </Link>
        </div>
      ) : (
        <>
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: '12px',
              padding: '20px',
              background: '#fff',
              marginBottom: '20px',
            }}
          >
            <h2 style={{ marginTop: 0 }}>내 정보</h2>
            <p><strong>이름:</strong> {user.full_name}</p>
            <p><strong>학번:</strong> {user.student_id}</p>
            <p><strong>권한:</strong> {user.role}</p>
          </div>

          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: '12px',
              padding: '20px',
              background: '#fff',
            }}
          >
            <h2 style={{ marginTop: 0 }}>바로가기</h2>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Link href="/attendance/scan">
                <button type="button">출석 체크</button>
              </Link>

              {(user.role === 'admin' || user.role === 'captain') && (
                <Link href="/admin/logs">
                  <button type="button">출석 로그</button>
                </Link>
              )}

              {user.role === 'admin' && (
                <>
                  <Link href="/admin">
                    <button type="button">관리자 페이지</button>
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
                </>
              )}
            </div>
          </div>

          <form action="/api/auth/logout" method="post" style={{ marginTop: '20px' }}>
            <LogoutButton />
          </form>
        </>
      )}
    </main>
  )
}