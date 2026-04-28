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
              {user.role === 'trainee' &&(
                <>
              {/*
              <Link href="/attendance/scan">
                <button type="button">출석 체크</button>              
              </Link>
              */}
              <Link href="/attendance/my">
                <button type="button">내 출석 조회</button>
              </Link>

              <Link href="/attendance/requests">
              <button type="button">내 출석 변경 요청</button>
              </Link>
              <Link href="/account/password">
              <button type="button">비밀번호 변경</button>
              </Link>
              </>
              )}

              {user.role === 'admin' && (
                <>
                  <Link href="/admin">
                    <button type="button">관리자 페이지</button>
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