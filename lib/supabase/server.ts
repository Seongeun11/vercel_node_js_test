// lib/supabase/server.ts
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * Server Component / Route Handler에서 현재 요청의 쿠키를 기반으로
 * 인증 세션을 읽기 위한 서버 클라이언트.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {
          // Server Component에서는 set이 필요 없으므로 noop
        },
        remove() {
          // Server Component에서는 remove가 필요 없으므로 noop
        },
      },
    }
  )
}