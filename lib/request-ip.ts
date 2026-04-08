// lib/request-ip.ts
import { NextRequest } from 'next/server'

function normalizeIp(value: string | null): string | null {
  if (!value) return null

  const ip = value.split(',')[0].trim()

  if (!ip) return null
  if (ip === 'unknown') return null

  return ip
}

/**
 * 배포 환경 우선순위:
 * 1) Vercel / Edge 계열 헤더
 * 2) x-real-ip
 * 3) x-forwarded-for 첫 번째 값
 */
export function getClientIp(request: NextRequest): string {
  return (
    normalizeIp(request.headers.get('x-vercel-forwarded-for')) ||
    normalizeIp(request.headers.get('x-real-ip')) ||
    normalizeIp(request.headers.get('x-forwarded-for')) ||
    'unknown'
  )
}