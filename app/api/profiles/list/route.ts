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
  // 조인된 데이터 (Supabase 쿼리 결과 형태)
  roles: { name: string }
  cohort_no: number | null
  enrollment_status: EnrollmentStatus | null
  affiliation: string 
  current_points: number // 🪙 타입 명세서에 포인트 필드 추가
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
// 관리자 권한 확인
    const authResult = await requireRole(['admin'])

    if (!authResult.ok) {
      return jsonNoStore(
        { error: authResult.error },
        { status: authResult.status }
      )
    }
// 2. [수정 핵심] 조인 쿼리 실행
    // role_id, affiliation_id 대신 각 테이블의 name을 가져옵니다.
    const { data, error } = await supabaseAdmin
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

    if (error) {
      return jsonNoStore(
        { error: error.message },
        { status: 500 }
      )
    }
// 3. [수정 핵심] 클라이언트용 데이터 평탄화 매핑
    // 중첩된 roles.name과 affiliations.name을 최상위 필드로 끌어올립니다.
    const users = ((data ?? []) as any[]).map((user) => ({
      id: user.id,
      full_name: user.full_name,
      student_id: user.student_id,
      cohort_no: user.cohort_no,
      created_at: user.created_at,
      updated_at: user.updated_at,
      // 가공 필드
      role: (user.roles?.name || 'trainee') as UserRole,
      affiliation: user.affiliations?.name || '미지정',
      affiliation_id: user.affiliation_id, // 💡 [추가] 이 줄을 추가하여 프론트 필터 락을 해결합니다.
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