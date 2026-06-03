// lib/security/api-response.ts
import { NextResponse } from 'next/server'

/**
 * 민감한 API 응답 캐시 방지
 */
export function jsonNoStore<T>(body: T, init?: ResponseInit) {
  const response = NextResponse.json(body, init)

  response.headers.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  )
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')

  return response
}