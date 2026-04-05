import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

type PendingCookie = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[0] extends infer T
    ? T extends { name: string; value: string }
      ? Omit<T, 'name' | 'value'>
      : never
    : never
}

export async function POST(request: NextRequest) {
  try {
    const pendingCookies: PendingCookie[] = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options) {
            pendingCookies.push({ name, value, options })
          },
          remove(name: string, options) {
            pendingCookies.push({ name, value: '', options })
          },
        },
      }
    )

    // 1) Supabase 세션 종료
    await supabase.auth.signOut()

    const response = NextResponse.json(
      { message: '로그아웃되었습니다.' },
      { status: 200 }
    )

    // 2) Supabase auth 쿠키 제거 반영
    for (const cookie of pendingCookies) {
      response.cookies.set({
        name: cookie.name,
        value: cookie.value,
        ...(cookie.options ?? {}),
      })
    }

    return response
  } catch (error) {
    console.error('[AUTH_LOGOUT_POST_ERROR]', error)
    return NextResponse.json(
      { error: '로그아웃 처리 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}