import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { verifyPassword } from '@/lib/password'
import { setSessionCookie } from '@/lib/session'

type LoginBody = {
  student_id?: string
  password?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody

    const normalizedID = String(body.student_id || '').trim()
    const normalizedPassword = String(body.password || '')

    if (!normalizedID || !normalizedPassword) {
      return NextResponse.json(
        { error: '학번과 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
      )
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name, student_id, role, password_hash')
      .eq('student_id', normalizedID)
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // Supabase single() results in no rows
        return NextResponse.json(
          { error: '학번 또는 비밀번호가 올바르지 않습니다.' },
          { status: 401 }
        )
      }
      throw error // Unexpected database error
    }

    if (!profile) {
      return NextResponse.json(
        { error: '학번 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    const isValidPassword = verifyPassword(normalizedPassword, profile.password_hash)

    if (!isValidPassword) {
      return NextResponse.json(
        { error: '학번 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    const safeUser = {
      id: profile.id,
      full_name: profile.full_name,
      student_id: profile.student_id,
      role: profile.role,
    }

    await setSessionCookie(safeUser)

    return NextResponse.json({ user: safeUser }, { status: 200 })
  } catch (error) {
    console.error('auth/login POST error:', error)
    return NextResponse.json(
      { error: '로그인 처리 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
