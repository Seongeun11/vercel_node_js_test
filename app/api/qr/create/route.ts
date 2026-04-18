// app/api/qr/create/route.ts
import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type ExpireUnit = 'minutes' | 'days'

type CreateQrBody = {
  occurrence_id?: string
  expire_unit?: ExpireUnit
  expire_value?: number
  
}

type CreateQrResponse = {
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

function validateExpireSetting(expireUnit: ExpireUnit, expireValue: number): string {
  if (expireUnit === 'minutes') {
    if (!Number.isInteger(expireValue) || expireValue < 10 || expireValue % 10 !== 0|| expireValue >1440) {
      return '분 단위 QR 유효시간은 10분 단위 최대 1440분(24시간)입니다.'
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
      return jsonNoStore<CreateQrResponse>(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = (await request.json()) as CreateQrBody

    const occurrenceId = String(body.occurrence_id ?? '').trim()
    const expireUnit = (body.expire_unit ?? 'minutes') as ExpireUnit
    const expireValue = Number(body.expire_value ?? 10)

    if (!occurrenceId) {
      return jsonNoStore<CreateQrResponse>(
        { error: '회차 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const validationError = validateExpireSetting(expireUnit, expireValue)
    if (validationError) {
      return jsonNoStore<CreateQrResponse>(
        { error: validationError },
        { status: 400 }
      )
    }

    const { data: occurrence, error: occurrenceError } = await supabaseAdmin
      .from('event_occurrences')
      .select('id, event_id, occurrence_date, status')
      .eq('id', occurrenceId)
      .single()
    
    if (occurrenceError || !occurrence) {
      return jsonNoStore<CreateQrResponse>(
        { error: '회차를 찾을 수 없습니다.' },
        { status: 404 }
      )
      
    }
    
    if (occurrence.status === 'closed' || occurrence.status === 'archived') {
      return jsonNoStore<CreateQrResponse>(
        { error: '종료된 회차에는 QR을 발급할 수 없습니다.' },
        { status: 400 }
      )
    }

    const nowIso = new Date().toISOString()

    // ✅ 새 QR 생성 전에 기존 활성 QR 자동 만료
    const { error: expirePreviousError } = await supabaseAdmin
      .from('qr_tokens')
      .update({ expires_at: nowIso })
      .eq('occurrence_id', occurrenceId)
      .gt('expires_at', nowIso)

    if (expirePreviousError) {
      return jsonNoStore<CreateQrResponse>(
        { error: expirePreviousError.message || '기존 QR 만료 처리에 실패했습니다.' },
        { status: 500 }
      )
    }

    const token = crypto.randomBytes(24).toString('hex')
    const expiresAt = buildExpiresAt(expireUnit, expireValue)

    const { data: createdQr, error: createError } = await supabaseAdmin
      .from('qr_tokens')
      .insert({
        event_id: occurrence.event_id,
        occurrence_id: occurrenceId,
        token,
        expires_at: expiresAt,
        used_count: 0,
      })
      .select('id, event_id, occurrence_id, token, expires_at, used_count, created_at')
      .single()

    if (createError || !createdQr) {
      return jsonNoStore<CreateQrResponse>(
        { error: createError?.message || 'QR 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    return jsonNoStore<CreateQrResponse>(
      {
        message: 'QR이 생성되었습니다. 기존 활성 QR은 자동 만료 처리되었습니다.',
        qr_token: createdQr,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore<CreateQrResponse>(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('[qr/create] unexpected error:', error)
    }

    return jsonNoStore<CreateQrResponse>(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}