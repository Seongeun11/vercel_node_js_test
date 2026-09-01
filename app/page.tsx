// app\page.tsx
import Link from 'next/link'
import { getCurrentUser } from '@/lib/serverAuth'
import LogoutButton from '@/components/LogoutButton'

// 서버에서 사용하는 사용자 타입 정의 (최소 필드만)
type User = {
  full_name: string
  student_id: string
  role: 'admin' | 'captain' | 'trainee'
  current_points: number // [추가] 포인트 표시를 위한 필드 정의
} | null

export default async function HomePage() {
  const user: User = await getCurrentUser()
  // 포인트 사용 버튼을 노출할 허용 계정 이름 정의
  //const ALLOWED_STORE_NAMES = ['천심 굿즈', '천심 카페'];
  
  // 현재 로그인한 유저의 이름이 허용 목록에 있는지 검사
  const isStoreAccount_goods = user && '천심굿즈'.includes(user.full_name);
   const isStoreAccount_cafe = user && '천심카페'.includes(user.full_name);
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
           {/* [수정] 비어있던 공간에 안전하게 포인트를 출력하며 천단위 콤마 포맷팅 적용 */}
            {user.role === 'trainee' && (
              
              <p>
                <strong>아카데미 포인트:</strong>{' '}<br></br>
                <span style={{ color: '#0070f3', fontWeight: 'bold' }}>
                  {user.current_points.toLocaleString()}
                </span> P<br></br><br></br> 
                <strong>아카데미 포인트는<br></br>수요워크샵, 천심원 집중기도회<br></br>출석 및 과제 기간내 제출시 적립됩니다.</strong> <br></br> <br></br>
                <span style={{ color: '#0070f3', fontWeight: 'bold' }}>{/* span을 div로 바꿀것*/}
                <strong>출석시에만 적립되며 지각 및 결석은 적립되지 않습니다.</strong>
                </span>
              </p>
              
            )}
          </div>

          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: '12px',
              padding: '20px',
              background: '#fff',
            }}
          >
            {user.role === 'trainee' &&(<h2 style={{ marginTop: 0 }}>바로가기</h2>)}
            {user.role === 'admin' &&(<h2 style={{ marginTop: 0 }}>관리자 전용 페이지 바로가기</h2>)}

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
               {/*
              <Link href="/attendance/point-requests">
              <button type="button">아카데미 포인트 사용</button>
              </Link>
              */}
              {
              <Link href="/attendance/my-absence-reason">
              <button type="button">내 결석 사유 등록 및 수정하기</button>
              </Link>
              }
              
              <Link href="/account/password">
              <button type="button">비밀번호 변경</button>
              </Link>
              </>
              )}


              {user.role === 'captain' && isStoreAccount_goods &&(
                
                <>
                  
                  <Link href="/admin/point-requests">
                    <button type="button">천심 굿즈 포인트 사용 페이지</button>
                  </Link>
                  </>
              )}
              {user.role === 'captain' && isStoreAccount_cafe &&(
                
                <>
                  
                  <Link href="/admin/point-requests">
                    <button type="button">천심 카페 포인트 사용 페이지</button>
                  </Link>
                  </>
              )}


              {user.role === 'admin' && (
                
                <>
                  
                  <Link href="/admin/admin-only">
                    <button type="button">관리자 전용 페이지</button>
                  </Link>
                  {/* 
                  <Link href="/admin/spirituality">
                    <button type="button">영성수련 페이지</button>
                  </Link>
                  <Link href="/admin/mosim">
                    <button type="button">모심수련 페이지</button>
                  </Link>
                  <Link href="/admin/hujin">
                    <button type="button">효진정 페이지</button>
                  </Link>
                  <Link href="/admin/seonghwa">
                    <button type="button">성화영성 페이지</button>
                  </Link>
                  <Link href="/admin/resonance">
                    <button type="button">3일 공명기도 페이지</button>
                  </Link>*/}
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