// lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'

/**
 * 관리자 전용 작업(계정 생성/삭제 등)에만 사용한다.
 * 절대 클라이언트 컴포넌트에서 import 하면 안 된다.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)