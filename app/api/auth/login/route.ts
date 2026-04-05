// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
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
    const studentId = String(body.student_id || '').trim()
    const password = String(body.password || '')

    if (!studentId || !password) {
      return NextResponse.json(
        { error: '학번과 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
      )
    }

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

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: studentIdToEmail(studentId),
      password,
    })

    if (signInError) {
      return NextResponse.json(
        { error: '학번 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: '로그인 세션 확인에 실패했습니다.' },
        { status: 401 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, student_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      await supabase.auth.signOut()
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

    // Supabase가 요청한 쿠키를 최종 응답에 반영
    for (const cookie of pendingCookies) {
      response.cookies.set({
        name: cookie.name,
        value: cookie.value,
        ...(cookie.options ?? {}),
      })
    }

    return response
  } catch (error) {
    console.error('auth/login POST error:', error)
    return NextResponse.json(
      { error: '로그인 처리 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}