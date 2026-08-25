// app/api/admin/users/schedules/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request-ip'
import { writeAdminAuditLog } from '@/lib/admin-audit'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

const createScheduleSchema = z.object({
  user_id: z.string().uuid('유효하지 않은 유저 ID입니다.'),
  absence_type: z.number({ error: '외출 유형을 선택해주세요.' }),
  start_date: z.string().min(1, '시작 날짜를 선택해주세요.'),
  end_date: z.string().min(1, '종료 날짜를 선택해주세요.'),
  absence_reason: z.string().optional().nullable(),
})

// 1. 스케쥴 목록 및 외출 유형/회원 메타데이터 조회
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore({ error: authResult.error }, { status: authResult.status })
    }

    const todayStr = new Date().toISOString().split('T')[0]

    // 날짜가 지난 스케쥴 자동 종료(is_ended = true) 처리
    await supabaseAdmin
      .from('user_schedules')
      .update({ is_ended: true })
      .lt('end_date', todayStr)
      .eq('is_ended', false)

    const { searchParams } = request.nextUrl
    const userId = searchParams.get('user_id')
    const absenceType = searchParams.get('absence_type')

    // 외출 유형 공통 코드 조회
    const { data: absenceTypes, error: typeError } = await supabaseAdmin
      .from('absence_type')
      .select('id, text')
      .order('id', { ascending: true })

    if (typeError) {
      return jsonNoStore({ error: '외출 유형 목록 조회 실패' }, { status: 500 })
    }

    // 스케쥴 목록 조회 쿼리 빌드
    let query = supabaseAdmin
      .from('user_schedules')
      .select(`
        id,
        user_id,
        absence_type,
        absence_reason,
        start_date,
        end_date,
        is_ended,
        created_at,
        profiles:user_id (
          full_name,
          student_id,
          cohort_no,
          affiliation:affiliation_id ( name )
        ),
        absence_type_info:absence_type ( id, text )
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (userId) query = query.eq('user_id', userId)
    if (absenceType) query = query.eq('absence_type', Number(absenceType))

    const { data: schedules, error: scheduleError } = await query

    if (scheduleError) {
      console.error('[schedules GET] Fetch error:', scheduleError)
      return jsonNoStore({ error: '스케쥴 목록 조회 실패' }, { status: 500 })
    }

    return jsonNoStore({ schedules: schedules || [], absenceTypes: absenceTypes || [] }, { status: 200 })
  } catch (err) {
    return jsonNoStore({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 2. 신규 스케쥴 등록
export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request)

  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])
    if (!authResult.ok || !authResult.user) {
      return jsonNoStore({ error: authResult.error }, { status: authResult.status })
    }

    const rateLimit = await checkRateLimit(`admin:schedules:ip:${clientIp}`, 50, 60)
    if (!rateLimit.ok) {
      return jsonNoStore({ error: '요청이 너무 많습니다.' }, { status: 429 })
    }

    const rawBody = await request.json()
    const parsed = createScheduleSchema.safeParse(rawBody)

    if (!parsed.success) {
      return jsonNoStore(
        { error: '입력값이 올바르지 않습니다.', field_errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { user_id: userId, absence_type, absence_reason, start_date, end_date } = parsed.data

    const todayStr = new Date().toISOString().split('T')[0]
    const isEnded = end_date < todayStr

    const { data: insertedSchedule, error: insertError } = await supabaseAdmin
      .from('user_schedules')
      .insert({
        user_id: userId,
        absence_type,
        absence_reason: absence_reason || '관리자 등록',
        start_date,
        end_date,
        is_ended: isEnded,
      })
      .select(`
        id,
        user_id,
        absence_type,
        absence_reason,
        start_date,
        end_date,
        is_ended,
        created_at,
        profiles:user_id (
          full_name,
          student_id,
          cohort_no,
          affiliation:affiliation_id ( name )
        ),
        absence_type_info:absence_type ( id, text )
      `)
      .single()

    if (insertError || !insertedSchedule) {
      console.error('[admin/schedules] Insert error:', insertError)
      return jsonNoStore({ error: '스케쥴 등록에 실패했습니다.' }, { status: 500 })
    }

    // 백그라운드 병렬 처리
    const updateProfilePromise = supabaseAdmin
      .from('profiles')
      .update({ user_schedules: insertedSchedule.id })
      .eq('id', userId)

    const writeLogPromise = writeAdminAuditLog({
      actorUserId: authResult.user.id,
      targetUserId: userId,
      action: 'admin.user_schedule.create',
      metadata: { client_ip: clientIp, schedule_id: insertedSchedule.id, absence_type },
    })

    void Promise.all([updateProfilePromise, writeLogPromise]).catch((err) =>
      console.error('[schedules POST] Background task error:', err)
    )

    return jsonNoStore(
      { ok: true, message: '스케쥴이 등록되었습니다.', schedule: insertedSchedule },
      { status: 201 }
    )
  } catch (error) {
    return jsonNoStore({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}