// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { studentIdToEmail } from '@/lib/auth-email'

type LoginBody = {
  student_id?: string
  password?: string
}

type PendingCookie = {
  name: string
  value: string
  options?: any
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginBody
    const studentId = String(body.student_id ?? '').trim()
    const password = String(body.password ?? '')

    if (!studentId || !password) {
      return NextResponse.json(
        { error: '학번과 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
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
          set(name: string, value: string, options: any) {
            pendingCookies.push({ name, value, options })
          },
          remove(name: string, options: any) {
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

    //console.log('[LOGIN] studentId:', studentId)
    //console.log('[LOGIN] email:', email)
    //console.log('[LOGIN] signIn user:', signInData.user?.id ?? null)
    //console.log('[LOGIN] signIn session:', !!signInData.session)
    //console.error('[LOGIN] signIn error:', signInError)

    if (signInError || !signInData.user || !signInData.session) {
      return NextResponse.json(
        { error: '학번 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    // 로그인 직후 profile 조회는 admin client로 수행
    const signedInUser = signInData.user

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, student_id, role')
      .eq('id', signedInUser.id)
      .maybeSingle()

    //console.error('[LOGIN] profileError:', profileError)
    //console.log('[LOGIN] profile:', profile)

    if (profileError || !profile) {
      return NextResponse.json(
        { error: '프로필 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.' },
        { status: 403 }
      )
    }

    const response = NextResponse.json(
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
    //console.error('[LOGIN] profileError:', profileError)
   // console.log('[LOGIN] profile:', profile)
    //console.log('[LOGIN] pendingCookies:', pendingCookies)
    return response
  } catch (error) {
    console.error('[AUTH_LOGIN_POST_ERROR]', error)
    return NextResponse.json(
      { error: '로그인 처리 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}