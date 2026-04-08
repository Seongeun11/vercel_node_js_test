// app/api/auth/logout/route.ts
import { NextRequest} from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type PendingCookie = {
  name: string
  value: string
  options?: Parameters<NextRequest['cookies']['set']>[0] extends infer T
    ? T extends { name: string; value: string }
      ? Omit<T, 'name' | 'value'>
      : never
    : never
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)

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

    await supabase.auth.signOut()

    const response = jsonNoStore(
      { message: '로그아웃되었습니다.' },
      { status: 200 }
    )

    for (const cookie of pendingCookies) {
      response.cookies.set({
        name: cookie.name,
        value: cookie.value,
        ...(cookie.options ?? {}),
      })
    }

    return response
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    console.error('[AUTH_LOGOUT_POST_ERROR]', error)

    return jsonNoStore(
      { error: '로그아웃 처리 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}