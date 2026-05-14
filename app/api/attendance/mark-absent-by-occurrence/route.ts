// app/api/attendance/mark-absent-by-occurrence/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type MarkAbsentBody = {
  occurrence_id?: string
}



type MarkAbsentResponse = {
  message?: string
  occurrence_id?: string
  marked_absent_count?: number
  skipped_count?: number
  error?: string
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore<MarkAbsentResponse>(
        {error: '인증이 필요합니다.' },
      { status: 401 }
      )
    }

    const body = (await request.json()) as MarkAbsentBody
    const occurrenceId = String(body.occurrence_id ?? '').trim()

    if (!occurrenceId) {
      return jsonNoStore<MarkAbsentResponse>(
        { error: '회차 ID가 필요합니다.' },
        { status: 400 }
      )
    }


    const { data, error } = await supabaseAdmin.rpc(
    'mark_absent_by_occurrence_with_log',
    {
      p_occurrence_id: occurrenceId,
      p_changed_by: authResult.user.id,
      p_reason: '관리자 미출석자 일괄 결석 처리',
    }
  )

  if (error) {
    const message = error.message || '결석 처리에 실패했습니다.'

    if (
      message.includes('회차 ID가 필요합니다.') ||
      message.includes('변경자 ID가 필요합니다.') ||
      message.includes('보관된 회차에는 결석 처리를 할 수 없습니다.')
    ) {
      return jsonNoStore<MarkAbsentResponse>(
        { error: message },
        { status: 400 }
      )
    }
    if (message.includes('attendance_target_not_allowed')) {
      return jsonNoStore(
        { error: '재학 상태의 수련생만 결석 처리할 수 있습니다.' },
        { status: 403 }
      )
    }
    if (message.includes('회차를 찾을 수 없습니다.')) {
      return jsonNoStore<MarkAbsentResponse>(
        { error: message },
        { status: 404 }
      )
    }

    console.error('[attendance/mark-absent-by-occurrence] rpc error:', error)

    return jsonNoStore<MarkAbsentResponse>(
      { error: '결석 처리에 실패했습니다.' },
      { status: 500 }
    )
  }

  const result = Array.isArray(data) ? data[0] : data

  if (!result) {
    return jsonNoStore<MarkAbsentResponse>(
      { error: '결석 처리 결과를 찾을 수 없습니다.' },
      { status: 500 }
    )
  }

  return jsonNoStore<MarkAbsentResponse>(
    {
      message:
        Number(result.marked_absent_count ?? 0) > 0
          ? '결석 처리가 완료되었습니다.'
          : '결석 처리할 대상이 없습니다.',
      occurrence_id: String(result.occurrence_id),
      marked_absent_count: Number(result.marked_absent_count ?? 0),
      skipped_count: Number(result.skipped_count ?? 0),
    },
    { status: 200 }
  )

  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore<MarkAbsentResponse>(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('[attendance/mark-absent-by-occurrence] unexpected error:', error)
    }

    return jsonNoStore<MarkAbsentResponse>(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}