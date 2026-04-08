// lib/security/csrf.ts
import { NextRequest } from 'next/server'

function getAllowedOrigins(): string[] {
  return [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
    // 로컬 개발 편의
    process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : undefined,
    process.env.NODE_ENV !== 'production' ? 'http://127.0.0.1:3000' : undefined,
  ].filter(Boolean) as string[]
}

/**
 * 상태 변경 요청에 대해 same-origin 검사
 * - GET/HEAD/OPTIONS 제외
 * - production에서는 반드시 통과해야 함
 */
export function assertSameOrigin(request: NextRequest) {
  const method = request.method.toUpperCase()

  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return
  }

  const allowedOrigins = getAllowedOrigins()
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  const hasValidOrigin = !!origin && allowedOrigins.includes(origin)
  const hasValidReferer =
    !!referer && allowedOrigins.some((allowed) => referer.startsWith(allowed))

  // 브라우저 기반 POST 요청은 origin 또는 referer 중 하나는 있어야 함
  // 서버 간 호출/헬스체크 같은 특수 케이스가 있으면 예외 처리 추가
  if (!hasValidOrigin && !hasValidReferer) {
    throw new Error('CSRF_BLOCKED')
  }
  //production에서는 Origin/Referer 둘 다 없으면 무조건 차단
  if (!origin && !referer) {
  throw new Error('Invalid request origin')
}
}