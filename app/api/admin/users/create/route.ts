// app/api/admin/users/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { studentIdToEmail } from '@/lib/auth-email'

type Body = {
  student_id: string
  password: string
  full_name: string
  role: 'admin' | 'captain' | 'trainee'
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(['admin'])

    if (!authResult.ok || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = (await request.json()) as Body
    const studentId = String(body.student_id || '').trim()
    const password = String(body.password || '').trim()
    const fullName = String(body.full_name || '').trim()
    const role = String(body.role || '').trim() as Body['role']

    // 기본 검증
    if (!studentId || !password || !fullName || !role) {
      return NextResponse.json(
        { error: '필수값이 누락되었습니다.' },
        { status: 400 }
      )
    }

    if (!['admin', 'captain', 'trainee'].includes(role)) {
      return NextResponse.json(
        { error: '유효하지 않은 역할입니다.' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: '비밀번호는 최소 8자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    // 필요시 학번 포맷 검증
    if (!/^\d{4,20}$/.test(studentId)) {
      return NextResponse.json(
        { error: '학번 형식이 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    const email = studentIdToEmail(studentId)

    // auth.users 생성
    // profiles는 DB trigger가 자동 생성
    const { data: createdAuth, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          student_id: studentId,
          full_name: fullName,
          role,
        },
      })

    if (createAuthError || !createdAuth.user) {
      return NextResponse.json(
        { error: createAuthError?.message || '사용자 생성 실패' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: createdAuth.user.id,
        student_id: studentId,
        full_name: fullName,
        role,
      },
    })
  } catch (error) {
    console.error('[ADMIN_USER_CREATE_ERROR]', error)
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    )
  }
}