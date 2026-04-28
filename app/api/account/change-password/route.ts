import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getSessionProfile } from '@/lib/server-session'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'
import { checkRateLimit } from '@/lib/rate-limit'

type ChangePasswordRequest = {
  current_password?: string
  new_password?: string
  confirm_password?: string
}

type ChangePasswordResponse = {
  success?: boolean
  message?: string
  error?: string
}

function isStrongPassword(password: string): boolean {
  // 최소 8자, 영문, 숫자 포함
  return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request)

    // 1. trainee 세션 확인
    const session = await getSessionProfile(['trainee'])

    if (!session.ok) {
      return jsonNoStore<ChangePasswordResponse>(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const userId = session.profile.id

    // 2. Rate Limit
    const rateLimit = await checkRateLimit(
      `change-password:user:${userId}`,
      5,
      60
    )

    if (!rateLimit.ok) {
      return jsonNoStore<ChangePasswordResponse>(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      )
    }

    // 3. 요청 body 검증
    const body = (await request.json()) as ChangePasswordRequest

    const currentPassword =
      typeof body.current_password === 'string'
        ? body.current_password.trim()
        : ''

    const newPassword =
      typeof body.new_password === 'string'
        ? body.new_password.trim()
        : ''

    const confirmPassword =
      typeof body.confirm_password === 'string'
        ? body.confirm_password.trim()
        : ''

    if (!currentPassword || !newPassword || !confirmPassword) {
      return jsonNoStore<ChangePasswordResponse>(
        { error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
      )
    }

    if (newPassword !== confirmPassword) {
      return jsonNoStore<ChangePasswordResponse>(
        { error: '새 비밀번호가 일치하지 않습니다.' },
        { status: 400 }
      )
    }

    if (currentPassword === newPassword) {
      return jsonNoStore<ChangePasswordResponse>(
        { error: '현재 비밀번호와 다른 비밀번호를 사용해주세요.' },
        { status: 400 }
      )
    }

    if (!isStrongPassword(newPassword)) {
      return jsonNoStore<ChangePasswordResponse>(
        { error: '새 비밀번호는 최소 8자 이상이며 영문과 숫자를 포함해야 합니다.' },
        { status: 400 }
      )
    }

    // 4. Auth 사용자 이메일 조회
    const { data: authUserData, error: authUserError } =
      await supabaseAdmin.auth.admin.getUserById(userId)

    if (authUserError || !authUserData.user?.email) {
      return jsonNoStore<ChangePasswordResponse>(
        { error: '사용자 정보를 확인할 수 없습니다.' },
        { status: 404 }
      )
    }

    const email = authUserData.user.email

    // 5. 현재 비밀번호 재검증
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )

    const { error: verifyError } =
      await supabaseAuth.auth.signInWithPassword({
        email,
        password: currentPassword,
      })

    if (verifyError) {
      return jsonNoStore<ChangePasswordResponse>(
        { error: '현재 비밀번호가 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    // 6. 비밀번호 변경
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      })

    if (updateError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[change-password] update error:', updateError)
      }

      return jsonNoStore<ChangePasswordResponse>(
        { error: '비밀번호 변경에 실패했습니다.' },
        { status: 500 }
      )
    }

    return jsonNoStore<ChangePasswordResponse>(
      {
        success: true,
        message: '비밀번호가 변경되었습니다.',
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore<ChangePasswordResponse>(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('[change-password] unexpected error:', error)
    }

    return jsonNoStore<ChangePasswordResponse>(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}