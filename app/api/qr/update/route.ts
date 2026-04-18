// app/api/qr/update/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type ExpireUnit = 'minutes' | 'days'

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
    occurrence_id: string
    token: string
    expires_at: string
    used_count: number
    created_at: string
  }
  error?: string
}

function validateExpireSetting(
  expireUnit: ExpireUnit,
  expireValue: number
): string {
  if (expireUnit === 'minutes') {
    if (
      !Number.isInteger(expireValue) ||
      expireValue < 10 ||
      expireValue % 10 !== 0
      || expireValue >1440
    ) {
      return '분 단위 QR 유효시간은 10분 단위 최대 1440분 (24시간)입니다. (예: 10, 20, 30)'
    }
    return ''
  }

  if (expireUnit === 'days') {
    if (!Number.isInteger(expireValue) || expireValue < 1 || expireValue > 365) {
      return '일 단위 QR 유효시간은 1~365일 사이 정수여야 합니다.'
    }
    return ''
  }

  return '유효시간 단위가 올바르지 않습니다.'
}

function buildExpiresAt(expireUnit: ExpireUnit, expireValue: number): string {
  const now = Date.now()

  if (expireUnit === 'minutes') {
    return new Date(now + expireValue * 60 * 1000).toISOString()
  }

  return new Date(now + expireValue * 24 * 60 * 60 * 1000).toISOString()
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
    const expireUnit = (body.expire_unit ?? 'minutes') as ExpireUnit
    const expireValue = Number(body.expire_value ?? 10)

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

    // ✅ 회차 기반 QR인지 확인
    const { data: existingQr, error: existingError } = await supabaseAdmin
      .from('qr_tokens')
      .select('id, event_id, occurrence_id, token, expires_at, used_count, created_at')
      .eq('id', id)
      .single()

    if (existingError || !existingQr) {
      return jsonNoStore<UpdateQrResponse>(
        { error: '수정할 QR을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (!existingQr.occurrence_id) {
      return jsonNoStore<UpdateQrResponse>(
        { error: '회차 기반 QR이 아닙니다. 마이그레이션이 필요합니다.' },
        { status: 400 }
      )
    }

    // ✅ 회차가 실제 존재하는지도 확인
    const { data: occurrence, error: occurrenceError } = await supabaseAdmin
      .from('event_occurrences')
      .select('id,status')
      .eq('id', existingQr.occurrence_id)
      .single()

    if (occurrenceError || !occurrence) {
      return jsonNoStore<UpdateQrResponse>(
        { error: '연결된 회차를 찾을 수 없습니다.' },
        { status: 404 }
      )
      
    }
    if (occurrence.status === 'closed' || occurrence.status === 'archived') {
      return jsonNoStore<UpdateQrResponse>(
        { error: '종료된 회차의 QR은 재발급할 수 없습니다.' },
        { status: 400 }
      )
    }
        
    const expiresAt = buildExpiresAt(expireUnit, expireValue)

    const { data: updatedQr, error: updateError } = await supabaseAdmin
      .from('qr_tokens')
      .update({ expires_at: expiresAt })
      .eq('id', id)
      .select('id, event_id, occurrence_id, token, expires_at, used_count, created_at')
      .single()

    if (updateError || !updatedQr) {
      return jsonNoStore<UpdateQrResponse>(
        { error: updateError?.message || 'QR 수정에 실패했습니다.' },
        { status: 500 }
      )
    }

    return jsonNoStore<UpdateQrResponse>(
      {
        message: 'QR 유효 시간이 수정되었습니다.',
        qr_token: {
          id: updatedQr.id,
          event_id: updatedQr.event_id,
          occurrence_id: updatedQr.occurrence_id,
          token: updatedQr.token,
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

    if (process.env.NODE_ENV !== 'production') {
      console.error('[qr/update] unexpected error:', error)
    }

    return jsonNoStore<UpdateQrResponse>(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}