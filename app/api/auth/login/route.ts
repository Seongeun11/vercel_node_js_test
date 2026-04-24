// app/api/auth/login/route.ts
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { studentIdToEmail } from '@/lib/auth-email'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request-ip'
import { NextRequest } from 'next/server'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type LoginBody = {
  student_id?: string
  password?: string
}

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
    const body = (await request.json()) as LoginBody
    const studentId = String(body.student_id ?? '').trim()
    const password = String(body.password ?? '')
    const clientIp = getClientIp(request)

    if (!studentId || !password) {
      return jsonNoStore(
        { error: '학번과 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
      )
    }

    // 1) IP 기준 제한
    const ipRateLimit = await checkRateLimit(`login:ip:${clientIp}`, 10, 60)

    if (!ipRateLimit.configured && process.env.NODE_ENV === 'production') {
      return jsonNoStore(
        { error: '로그인 보호 설정이 올바르지 않습니다. 관리자에게 문의해주세요.' },
        { status: 503 }
      )
    }

    if (!ipRateLimit.ok) {
      return jsonNoStore(
        { error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(ipRateLimit.resetInSeconds),
          },
        }
      )
    }

    // 2) 계정 기준 제한
    const accountRateLimit = await checkRateLimit(
      `login:student:${studentId}`,
      5,
      300
    )

    if (!accountRateLimit.ok) {
      return jsonNoStore(
        { error: '해당 계정의 로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(accountRateLimit.resetInSeconds),
          },
        }
      )
    }

    const email = studentIdToEmail(studentId)
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

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    if (signInError || !signInData.user || !signInData.session) {
      return jsonNoStore(
        { error: '학번 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, student_id, role')
      .eq('id', signInData.user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return jsonNoStore(
        { error: '프로필 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.' },
        { status: 403 }
      )
    }

    const response = jsonNoStore(
      {
        ok: true,
        user: profile,
      },
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
    if (process.env.NODE_ENV !== 'production') {
      console.error('[auth/login] unexpected error:', error)
    }

    return jsonNoStore(
      { error: '로그인 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}