// app/api/profiles/list/route.ts
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type EnrollmentStatus = 'active' | 'completed'
type UserRole = 'admin' | 'captain' | 'trainee'

type ProfileRow = {
  id: string
  full_name: string
  student_id: string
  role: UserRole
  cohort_no: number | null
  enrollment_status: EnrollmentStatus | null
  created_at: string
  updated_at: string
}

function normalizeEnrollmentStatus(
  status: string | null
): EnrollmentStatus {
  return status === 'completed' ? 'completed' : 'active'
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])

    if (!authResult.ok) {
      return jsonNoStore(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        full_name,
        student_id,
        role,
        cohort_no,
        enrollment_status,
        created_at,
        updated_at
      `)
      .order('student_id', { ascending: true })

    if (error) {
      return jsonNoStore(
        { error: error.message },
        { status: 500 }
      )
    }

    const users = ((data ?? []) as ProfileRow[]).map((user) => ({
      ...user,
      enrollment_status: normalizeEnrollmentStatus(user.enrollment_status),
    }))

    return jsonNoStore({ users }, { status: 200 })
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    return jsonNoStore(
      { error: '사용자 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}