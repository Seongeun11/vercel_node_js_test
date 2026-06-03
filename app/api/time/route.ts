//api/time/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  const now = new Date()

  const response = NextResponse.json({
    serverTimeUtc: now.toISOString(),
    serverTimestamp: now.getTime(),
  })

  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  response.headers.set('X-Server-Time', String(now.getTime()))
  response.headers.set('Date', now.toUTCString())

  return response
}