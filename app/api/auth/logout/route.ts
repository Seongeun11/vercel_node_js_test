import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/session'

export async function POST() {
  try {
    await clearSessionCookie()
    return NextResponse.json({ message: '로그아웃되었습니다.' }, { status: 200 })
  } catch (error) {
    console.error('auth/logout POST error:', error)
    return NextResponse.json(
      { error: '로그아웃 처리 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
