// app/api/auth/me/route.ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/serverAuth'

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    return NextResponse.json({ user }, { status: 200 })
  } catch (error) {
    console.error('auth/me GET error:', error)
    return NextResponse.json(
      { error: '세션 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}