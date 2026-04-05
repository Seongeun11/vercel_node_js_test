import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { studentIdToEmail } from '../lib/auth-email'

dotenv.config({ path: '.env.local' })

type Role = 'admin' | 'captain' | 'trainee'

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase 환경변수가 없습니다.')
  }

  const studentId = '20260001'
  const fullName = '초기 관리자'
  const password = '1234'
  const role: Role = 'admin'

  const email = studentIdToEmail(studentId)

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  console.log('생성 이메일:', email)

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      student_id: studentId,
      full_name: fullName,
      role,
    },
  })

  if (error || !data.user) {
    throw new Error(error?.message ?? 'Auth 생성 실패')
  }

  console.log('Auth 생성 완료:', data.user.id)
}

main().catch((err) => {
  console.error('❌ 에러:', err)
  process.exit(1)
})