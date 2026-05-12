import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        // 서버 컴포넌트에서 쿠키를 설정할 때 발생하는 에러를 방어합니다.
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
            } catch {
              // Server Component에서는 set 실패 가능하므로 무시
            }
          }
        },
      },
    }
  )
}