// app/api/attendance/absence-reason/route.ts
import { NextRequest } from 'next/server'
import { getSessionProfile } from '@/lib/server-session'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type RequestBody = {
  id?: number | string
  absence_type?: number
  start_date?: string
  end_date?: string
  absence_reason?: string
}

// 1. 내 결석 사유 목록 조회 (GET) - 서버단 필터링 적용
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const session = await getSessionProfile(['trainee', 'captain', 'admin'])
    if (!session.ok) {
      return jsonNoStore({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const statusFilter = searchParams.get('statusFilter') // 'active' | 'ended' | 'all'

    let query = session.supabase
      .from('user_schedules')
      .select(`
        id, 
        absence_type, 
        start_date, 
        end_date, 
        absence_reason, 
        is_ended,
        created_at,
        absence_type_rel:absence_type ( text )
      `)
      .eq('user_id', session.profile.id)

    // 날짜 조건절 추가
    if (startDate) {
      query = query.gte('end_date', startDate)
    }
    if (endDate) {
      query = query.lte('start_date', endDate)
    }
    // 상태 조건절 추가
    if (statusFilter === 'active') {
      query = query.eq('is_ended', false)
    } else if (statusFilter === 'ended') {
      query = query.eq('is_ended', true)
    }

    const { data: rawItems, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('[absence-reason GET] error:', error)
      return jsonNoStore({ error: '목록을 불러오지 못했습니다.' }, { status: 500 })
    }

    const items = rawItems.map((item: any) => ({
      id: String(item.id),
      absence_type: item.absence_type,
      absence_type_name: item.absence_type_rel?.text ?? '기타',
      start_date: item.start_date,
      end_date: item.end_date,
      absence_reason: item.absence_reason,
      is_ended: item.is_ended,
      created_at: item.created_at,
    }))

    return jsonNoStore({ items })
  } catch {
    return jsonNoStore({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 2. 결석 사유 등록 (POST)
export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request)

    const session = await getSessionProfile(['trainee', 'captain', 'admin'])
    if (!session.ok) {
      return jsonNoStore({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = (await request.json()) as RequestBody
    const { absence_type, start_date, end_date, absence_reason } = body

    if (!absence_type || !start_date || !end_date || !absence_reason?.trim()) {
      return jsonNoStore({ error: '모든 필수 항목을 입력해주세요.' }, { status: 400 })
    }

    if (start_date > end_date) {
      return jsonNoStore({ error: '종료일은 시작일보다 빠를 수 없습니다.' }, { status: 400 })
    }

    if (absence_reason.trim().length > 500) {
      return jsonNoStore({ error: '사유는 500자 이하로 입력해주세요.' }, { status: 400 })
    }

    const { data: schedule, error } = await session.supabase
      .from('user_schedules')
      .insert({
        user_id: session.profile.id,
        absence_type: Number(absence_type),
        start_date,
        end_date,
        absence_reason: absence_reason.trim(),
        is_ended: false,
      })
      .select()
      .single()

    if (error) {
      console.error('[absence-reason POST] insert error:', error)
      return jsonNoStore({ error: '스케쥴 사유 등록에 실패했습니다.' }, { status: 500 })
    }

    return jsonNoStore({ success: true, schedule })
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore({ error: '허용되지 않은 요청입니다.' }, { status: 403 })
    }
    return jsonNoStore({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 3. 결석 사유 수정 (PUT)
export async function PUT(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request)

    const session = await getSessionProfile(['trainee', 'captain', 'admin'])
    if (!session.ok) {
      return jsonNoStore({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = (await request.json()) as RequestBody
    const { id, absence_type, start_date, end_date, absence_reason } = body

    if (!id || !absence_type || !start_date || !end_date || !absence_reason?.trim()) {
      return jsonNoStore({ error: '모든 필수 항목을 입력해주세요.' }, { status: 400 })
    }

    if (start_date > end_date) {
      return jsonNoStore({ error: '종료일은 시작일보다 빠를 수 없습니다.' }, { status: 400 })
    }

    const targetId = Number(id)

    const { data: schedule, error } = await session.supabase
      .from('user_schedules')
      .update({
        absence_type: Number(absence_type),
        start_date,
        end_date,
        absence_reason: absence_reason.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetId)
      .eq('user_id', session.profile.id)
      .select()
      .single()

    if (error || !schedule) {
      console.error('[absence-reason PUT] update error:', error)
      return jsonNoStore({ error: '수정 권한이 없거나 처리에 실패했습니다.' }, { status: 400 })
    }

    return jsonNoStore({ success: true, schedule })
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore({ error: '허용되지 않은 요청입니다.' }, { status: 403 })
    }
    return jsonNoStore({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 4. 결석 사유 삭제 (DELETE)
export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request)

    const session = await getSessionProfile(['trainee', 'captain', 'admin'])
    if (!session.ok) {
      return jsonNoStore({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const idParam = searchParams.get('id')

    if (!idParam) {
      return jsonNoStore({ error: '삭제할 ID가 전달되지 않았습니다.' }, { status: 400 })
    }

    const targetId = Number(idParam)

    const { error } = await session.supabase
      .from('user_schedules')
      .delete()
      .eq('id', targetId)
      .eq('user_id', session.profile.id)

    if (error) {
      console.error('[absence-reason DELETE] delete error:', error)
      return jsonNoStore({ error: '삭제 처리에 실패했습니다.' }, { status: 500 })
    }

    return jsonNoStore({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore({ error: '허용되지 않은 요청입니다.' }, { status: 403 })
    }
    return jsonNoStore({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}