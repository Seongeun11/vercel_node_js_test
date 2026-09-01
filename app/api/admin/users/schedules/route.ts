import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request-ip'
import { writeAdminAuditLog } from '@/lib/admin-audit'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

const scheduleSchema = z.object({
  id: z.number().optional(),
  user_id: z.string().uuid('유효하지 않은 유저 ID입니다.'),
  absence_type: z.number({ error: '외출 유형을 선택해주세요.' }),
  start_date: z.string().min(1, '시작 날짜를 선택해주세요.'),
  end_date: z.string().min(1, '종료 날짜를 선택해주세요.'),
  absence_reason: z.string().optional().nullable(),
})

// 1. 스케쥴 목록 조회 (기간 필터 포함)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore({ error: authResult.error }, { status: authResult.status })
    }

    const todayStr = new Date().toISOString().split('T')[0]

    // 지난 스케쥴 자동 종료 처리
    await supabaseAdmin
      .from('user_schedules')
      .update({ is_ended: true })
      .lt('end_date', todayStr)
      .eq('is_ended', false)

    const { searchParams } = request.nextUrl
    const userId = searchParams.get('user_id')
    const absenceType = searchParams.get('absence_type')
    const isEndedParam = searchParams.get('is_ended')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const { data: absenceTypes, error: typeError } = await supabaseAdmin
      .from('absence_type')
      .select('id, text')
      .order('id', { ascending: true })

    if (typeError) {
      return jsonNoStore({ error: '외출 유형 목록 조회 실패' }, { status: 500 })
    }

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

    if (userId) query = query.eq('user_id', userId)
    if (absenceType) query = query.eq('absence_type', Number(absenceType))
    if (isEndedParam === 'true') query = query.eq('is_ended', true)
    if (isEndedParam === 'false') query = query.eq('is_ended', false)
    
    // 날짜 기간 필터링 조건
    if (startDate) query = query.gte('end_date', startDate)
    if (endDate) query = query.lte('start_date', endDate)

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
    const parsed = scheduleSchema.safeParse(rawBody)

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

    void writeAdminAuditLog({
      actorUserId: authResult.user.id,
      targetUserId: userId,
      action: 'admin.user_schedule.create',
      metadata: { client_ip: clientIp, schedule_id: insertedSchedule.id, absence_type },
    })

    return jsonNoStore({ ok: true, message: '스케쥴이 등록되었습니다.', schedule: insertedSchedule }, { status: 201 })
  } catch (error) {
    return jsonNoStore({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 3. 스케쥴 수정
export async function PUT(request: NextRequest) {
  const clientIp = getClientIp(request)

  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])
    if (!authResult.ok || !authResult.user) {
      return jsonNoStore({ error: authResult.error }, { status: authResult.status })
    }

    const rawBody = await request.json()
    const parsed = scheduleSchema.safeParse(rawBody)

    if (!parsed.success || !parsed.data.id) {
      return jsonNoStore({ error: '올바르지 않은 스케쥴 정보입니다.' }, { status: 400 })
    }

    const { id, user_id: userId, absence_type, absence_reason, start_date, end_date } = parsed.data
    const todayStr = new Date().toISOString().split('T')[0]
    const isEnded = end_date < todayStr

    const { data: updatedSchedule, error: updateError } = await supabaseAdmin
      .from('user_schedules')
      .update({
        user_id: userId,
        absence_type,
        absence_reason,
        start_date,
        end_date,
        is_ended: isEnded,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
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

    if (updateError || !updatedSchedule) {
      return jsonNoStore({ error: '스케쥴 수정 실패' }, { status: 500 })
    }

    void writeAdminAuditLog({
      actorUserId: authResult.user.id,
      targetUserId: userId,
      action: 'admin.user_schedule.update',
      metadata: { client_ip: clientIp, schedule_id: id },
    })

    return jsonNoStore({ ok: true, message: '수정되었습니다.', schedule: updatedSchedule }, { status: 200 })
  } catch (error) {
    return jsonNoStore({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 4. 스케쥴 삭제
export async function DELETE(request: NextRequest) {
  const clientIp = getClientIp(request)

  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])
    if (!authResult.ok || !authResult.user) {
      return jsonNoStore({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = request.nextUrl
    const id = searchParams.get('id')

    if (!id) {
      return jsonNoStore({ error: '삭제할 항목 ID가 없습니다.' }, { status: 400 })
    }

    const { error: deleteError } = await supabaseAdmin
      .from('user_schedules')
      .delete()
      .eq('id', Number(id))

    if (deleteError) {
      return jsonNoStore({ error: '삭제 처리에 실패했습니다.' }, { status: 500 })
    }

    void writeAdminAuditLog({
      actorUserId: authResult.user.id,
      action: 'admin.user_schedule.delete',
      metadata: { client_ip: clientIp, schedule_id: id },
    })

    return jsonNoStore({ ok: true, message: '삭제되었습니다.' }, { status: 200 })
  } catch (error) {
    return jsonNoStore({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}