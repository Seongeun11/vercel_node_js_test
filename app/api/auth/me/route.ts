// app/api/auth/me/route.ts
import { getSessionProfile } from '@/lib/server-session'
import { jsonNoStore } from '@/lib/security/api-response'

type MeResponse = {
  user?: {
    id: string
    student_id: string
    full_name: string
    role: 'admin' | 'captain' | 'trainee'
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
      { error: session.error },
      { status: session.status }
    )
  }

  return jsonNoStore<MeResponse>({

    user: {
      id: session.profile.id,
      student_id: session.profile.student_id,
      full_name: session.profile.full_name,
      role: session.profile.role,
      email: session.user.email ?? null,
    },
  })
}