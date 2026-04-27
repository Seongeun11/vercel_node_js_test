// app/api/qr/create/route.ts

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'
import {
  generateQrToken,
  hashQrToken,
  encryptQrToken,
  maskQrToken,
} from '@/lib/security/qr-token'

type ExpireUnit = 'hours' | 'days' | 'unlimited'

type CreateQrBody = {
  occurrence_id?: string
  expire_unit?: ExpireUnit
  expire_value?: number
  
}
type CreatedQrRow = {
  id: string
  event_id: string
  occurrence_id: string | null
  expires_at: string | null
  used_count: number
  created_at: string
}

type CreateQrResponse = {
message?: string
  qr_token?: CreatedQrRow & {
    token_preview: string
  }
  qr_url?: string
  error?: string
}

function validateExpireSetting(expireUnit: ExpireUnit, expireValue: number): string {
  if (expireUnit === 'unlimited') {
    return ''
  }
  if (expireUnit === 'hours') {
    if (!Number.isInteger(expireValue) || expireValue < 1 ||  expireValue >6) {
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
  const baseMs = new Date(baseTime).getTime()
  if (expireUnit === 'unlimited') {
    return null
  }
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
      return jsonNoStore<CreateQrResponse>(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = (await request.json()) as CreateQrBody

    const occurrenceId = String(body.occurrence_id ?? '').trim()
    const expireUnit = (body.expire_unit ?? 'hours') as ExpireUnit
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
      .select('id, event_id, occurrence_date,start_time, status')
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
/*
    // ✅ 새 QR 생성 전에 기존 활성 QR 자동 만료
    const { error: expirePreviousError } = await supabaseAdmin
      .from('qr_tokens')
      .update({ expires_at: nowIso })
      .eq('occurrence_id', occurrenceId)
      .or(`expires_at.gt.${nowIso},expires_at.is.null`)

    if (expirePreviousError) {
      return jsonNoStore<CreateQrResponse>(
        { error: expirePreviousError.message || '기존 QR 만료 처리에 실패했습니다.' },
        { status: 500 }
      )
    }
      */

    //const token = crypto.randomBytes(24).toString('hex')
    const rawToken = generateQrToken()
    const tokenHash = hashQrToken(rawToken)
    const tokenEncrypted = encryptQrToken(rawToken)

    const expiresAt = buildExpiresAt(occurrence.start_time, expireUnit, expireValue)

    const { data: createdQr, error: createError } = await supabaseAdmin
  .from('qr_tokens')
  .insert({
    event_id: occurrence.event_id,
    occurrence_id: occurrenceId,
    token_hash: tokenHash,
    token_encrypted: tokenEncrypted,
    expires_at: expiresAt,
    used_count: 0,
  })
      // token 컬럼 조회 금지
      .select('id, event_id, occurrence_id, expires_at, used_count, created_at')
      .single<CreatedQrRow>()
    
    if (createError || !createdQr) {
      return jsonNoStore<CreateQrResponse>(
        { error: createError?.message || 'QR 생성에 실패했습니다.' },
        { status: 500 }
      )
    }
    const qrUrl = `${request.nextUrl.origin}/attendance/scan?token=${rawToken}`
    return jsonNoStore<CreateQrResponse>(
      {
        message: 'QR이 생성되었습니다.',
    qr_token: {
      ...createdQr,
      token_preview: maskQrToken(rawToken),
    },
    qr_url: qrUrl,
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
    if (error instanceof Error && error.message === 'INVALID_OCCURRENCE_START_TIME') {
  return jsonNoStore<CreateQrResponse>(
    { error: '회차 시작 시간이 올바르지 않습니다.' },
    { status: 500 }
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