// app/api/auth/me/route.ts
import { getSessionProfile } from '@/lib/server-session'
import { jsonNoStore } from '@/lib/security/api-response'

type MeResponse = {
  user?: {
    id: string
    student_id: string
    full_name: string
    role: string // Enum 대신 유연하게 string으로 받거나, DB의 name과 맞춥니다.
    email?: string | null
  }
  error?: string
}

export async function GET(): Promise<Response> {
  const session = await getSessionProfile()


  if (session.ok) {
    console.log('auth user id:', session.user.id)
    console.log('profile id:', session.profile.id)
    console.log('role:', session.profile.role)
  }
  if (!session.ok) {
    return jsonNoStore<MeResponse>(
      { error: '인증이 필요합니다.' },
      { status: 401 }
    )
  }

  return jsonNoStore<MeResponse>({

    user: {
      id: session.profile.id,
      student_id: session.profile.student_id,
      full_name: session.profile.full_name,
      // roles 테이블에서 Join된 name 값을 role 필드로 매핑합니다.
      // getSessionProfile 내부 쿼리가 수정되었다고 가정할 때의 접근 방식입니다.
      role: (session.profile.role as any)?.name || 'trainee',
      email: session.user.email ?? null,
    },
  })
}