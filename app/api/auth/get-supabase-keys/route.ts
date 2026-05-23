// app/api/auth/get-supabase-keys/route.ts
import { getSessionProfile } from '@/lib/server-session'
import { jsonNoStore } from '@/lib/security/api-response'

// 유저 정보와 Supabase 키를 모두 포함할 수 있도록 통합 응답 타입을 정의합니다.
type SupabaseKeysResponse = {
  // 보안을 유지한 채 내려줄 Supabase 접속 키 정의
  supabase?: {
    url: string | undefined
    anonKey: string | undefined
  }
  error?: string
}

export async function GET(): Promise<Response> {
  // 1. Next.js 웹 서버 세션으로부터 로그인 상태를 받아옵니다.
  // 내부적으로 profiles와 roles 테이블을 조인하여 최종 가공을 완료한 세션입니다.
  const session = await getSessionProfile()

  if (session.ok) {
    console.log('auth user id:', session.user.id)
    console.log('profile id:', session.profile.id)
    console.log('role:', session.profile.role) // 출력 결과: "admin" (문자열)
  }

  // 2. 로그인되지 않은 접근은 401 에러로 즉시 차단합니다.
  if (!session.ok) {
    return jsonNoStore<SupabaseKeysResponse>(
      { error: '인증이 필요합니다.' },
      { status: 401 }
    )
  }

  // 🚀 [수정 핵심] session.profile.role 자체가 이미 정제된 문자열('admin' | 'captain' | 'trainee')입니다.
  // 불필요했던 하위 객체 탐색(.name)을 제거하여 올바른 값을 추출하도록 바인딩합니다.
  const userRole = session.profile.role || 'trainee'
  
  // 로깅 콘솔 기록 (서버 모니터링용)
  console.log(`[인증 시도] User ID: ${session.user?.id} | Role: ${userRole}`)

  // 3. [핵심 보안 방어선] 로그인한 유저의 권한이 'admin'(관리자)인지 검증합니다.
  if (userRole !== 'admin') {
    return jsonNoStore<SupabaseKeysResponse>(
      { error: '접근 권한이 없습니다.' },
      { status: 403 } // Forbidden
    )
  }

  // 4. 모든 보안 검증(로그인 완료 + 관리자 권한 확인)이 통과되면 
  // Vercel 환경 변수의 Supabase 키를 안전하게 반환합니다.
  return jsonNoStore<SupabaseKeysResponse>({
    supabase: {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
    }
  })
}