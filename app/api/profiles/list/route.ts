// app/api/profiles/list/route.ts
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type EnrollmentStatus = 'active' | 'completed'
type UserRole = 'admin' | 'captain' | 'trainee'

function normalizeEnrollmentStatus(
  status: string | null
): EnrollmentStatus {
  return status === 'completed' ? 'completed' : 'active'
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)

    // 관리자 권한 확인
    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    // 요청 Body에서 status 조건 추출 (기본값: undefined)
    let statusFilter: string | undefined
    try {
      const body = await request.json()
      statusFilter = body?.status
    } catch {
      // Body가 없는 경우 예외 처리
    }

    // 1. Supabase 쿼리 생성
    let query = supabaseAdmin
      .from('profiles')
      .select(`
        id,
        full_name,
        student_id,    
        cohort_no,
        enrollment_status,
        current_points,
        created_at,
        updated_at,
        roles ( name ),
        affiliations ( name )
      `)
      .order('student_id', { ascending: true })

    // status 파라미터가 들어온 경우 DB 조건절 적용
    if (statusFilter) {
      query = query.eq('enrollment_status', statusFilter)
    }

    const { data, error } = await query

    if (error) {
      return jsonNoStore(
        { error: error.message },
        { status: 500 }
      )
    }

    // 2. 클라이언트용 데이터 평탄화 매핑
    const users = ((data ?? []) as any[]).map((user) => ({
      id: user.id,
      full_name: user.full_name,
      student_id: user.student_id,
      cohort_no: user.cohort_no,
      created_at: user.created_at,
      updated_at: user.updated_at,
      role: (user.roles?.name || 'trainee') as UserRole,
      affiliation: user.affiliations?.name || '미지정',
      affiliation_id: user.affiliation_id,
      enrollment_status: normalizeEnrollmentStatus(user.enrollment_status),
      current_points: user.current_points !== undefined && user.current_points !== null ? user.current_points : 0,
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