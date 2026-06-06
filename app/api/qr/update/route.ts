// app/api/qr/update/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type ExpireUnit = 'hours' | 'days' | 'unlimited'

type UpdateQrBody = {
  id?: string
  expire_unit?: ExpireUnit
  expire_value?: number
}

type UpdateQrResponse = {
  message?: string
  qr_token?: {
    id: string
    event_id: string
    occurrence_id: string | null
    expires_at: string | null
    used_count: number
    created_at: string
  }
  error?: string
}

function validateExpireSetting(
  expireUnit: ExpireUnit,
  expireValue: number
): string {
  if (expireUnit === 'unlimited') {
    return ''
  }

  if (expireUnit === 'hours') {
    if (
      !Number.isInteger(expireValue) ||
      expireValue < 1 ||
      expireValue > 6
    ) {
      return '시간 단위 QR 유효시간은 1~6시간 사이 정수입니다. (예: 1, 2, 3)'
    }
    return ''
  }

  if (expireUnit === 'days') {
    if (!Number.isInteger(expireValue) || expireValue < 1 || expireValue > 1) {
      return '일 단위 QR 유효시간은 1일 입니다.'
    }
    return ''
  }

  return '유효시간 단위가 올바르지 않습니다.'
}

function buildExpiresAt(
  baseTime: string,
  expireUnit: ExpireUnit,
  expireValue: number
): string | null {
  if (expireUnit === 'unlimited') {
    return null
  }
  const baseMs = new Date(baseTime).getTime()
  if (Number.isNaN(baseMs)) {
    throw new Error('INVALID_OCCURRENCE_START_TIME')
  }

  if (expireUnit === 'hours') {
    return new Date(baseMs + expireValue * 60 * 60 * 1000).toISOString()
  }

  return new Date(baseMs + expireValue * 24 * 60 * 60 * 1000).toISOString()
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore<UpdateQrResponse>(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = (await request.json()) as UpdateQrBody
    const id = String(body.id ?? '').trim()
    const expireUnit = (body.expire_unit ?? 'hours') as ExpireUnit
    const expireValue = Number(body.expire_value ?? 1)

    if (!id) {
      return jsonNoStore<UpdateQrResponse>(
        { error: 'QR ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const validationError = validateExpireSetting(expireUnit, expireValue)
    if (validationError) {
      return jsonNoStore<UpdateQrResponse>(
        { error: validationError },
        { status: 400 }
      )
    }

    // 1. 수정할 대상 QR 정보 가져오기
    const { data: existingQr, error: existingError } = await supabaseAdmin
      .from('qr_tokens')
      .select('id, event_id, occurrence_id, expires_at, used_count, created_at')
      .eq('id', id)
      .single()

    if (existingError || !existingQr) {
      return jsonNoStore<UpdateQrResponse>(
        { error: '수정할 QR을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    let expiresAt: string | null = null

    // 💡 논리 개선: 하이브리드 만료 연산 분기 처리
    if (existingQr.occurrence_id) {
      // 분기 A: 특정 회차에 명확히 종속되어 있는 일반 QR인 경우
      const { data: occurrence, error: occurrenceError } = await supabaseAdmin
        .from('event_occurrences')
        .select('id, start_time, status')
        .eq('id', existingQr.occurrence_id)
        .single()

      if (occurrenceError || !occurrence) {
        return jsonNoStore<UpdateQrResponse>(
          { error: '연장 대상 회차 정보를 찾을 수 없습니다.' },
          { status: 404 }
        )
      }

      if (occurrence.status === 'closed' || occurrence.status === 'archived') {
        return jsonNoStore<UpdateQrResponse>(
          { error: '종료되었거나 아카이브된 회차의 QR은 연장할 수 없습니다.' },
          { status: 400 }
        )
      }

      expiresAt = buildExpiresAt(occurrence.start_time, expireUnit, expireValue)
    } else {
      // 분기 B: 회차가 지정되지 않은 미래 예약형/고정형 QR인 경우
      if (expireUnit === 'unlimited') {
        expiresAt = null
      } else {
        // 미래 예약 건에 수동으로 만료 제한을 두는 경우, 현재 서버 요청 시각을 베이스로 연산 처리 유도
        expiresAt = buildExpiresAt(new Date().toISOString(), expireUnit, expireValue)
      }
    }

    // 2. 최종 만료 날짜 반영
    const { data: updatedQr, error: updateError } = await supabaseAdmin
      .from('qr_tokens')
      .update({ expires_at: expiresAt })
      .eq('id', id)
      .select('id, event_id, occurrence_id, expires_at, used_count, created_at')
      .single()

    if (updateError || !updatedQr) {
      return jsonNoStore<UpdateQrResponse>(
        { error: updateError?.message || 'QR 수정에 실패했습니다.' },
        { status: 500 }
      )
    }

    return jsonNoStore<UpdateQrResponse>(
      {
        message: 'QR 코드의 유효 시간이 성공적으로 수정 동기화되었습니다.',
        qr_token: {
          id: updatedQr.id,
          event_id: updatedQr.event_id,
          occurrence_id: updatedQr.occurrence_id,
          expires_at: updatedQr.expires_at,
          used_count: updatedQr.used_count,
          created_at: updatedQr.created_at,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore<UpdateQrResponse>(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }
    if (error instanceof Error && error.message === 'INVALID_OCCURRENCE_START_TIME') {
      return jsonNoStore<UpdateQrResponse>(
        { error: '회차 시작 시간이 올바르지 않습니다.' },
        { status: 500 }
      )
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('[qr/update] unexpected error:', error)
    }

    return jsonNoStore<UpdateQrResponse>(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}