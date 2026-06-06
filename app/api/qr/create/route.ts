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
  event_id?: string
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
    if (!Number.isInteger(expireValue) || expireValue < 1 || expireValue > 6) {
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
      return jsonNoStore<CreateQrResponse>(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = (await request.json()) as CreateQrBody
    const occurrenceId = String(body.occurrence_id ?? '').trim() || null
    const eventId = String(body.event_id ?? '').trim() || null
    const expireUnit = (body.expire_unit ?? 'hours') as ExpireUnit
    const expireValue = Number(body.expire_value ?? 1) // 기본값 수치를 스펙 통과 범위인 1로 조정

    // 💡 논리 체크 1: 최소한 둘 중 하나의 식별값은 존재해야 타겟팅이 가능함
    if (!occurrenceId && !eventId) {
      return jsonNoStore<CreateQrResponse>({ error: '회차 ID 또는 이벤트 ID 정보가 누락되었습니다.' }, { status: 400 })
    }

    // 💡 논리 체크 2: 회차 ID가 없는 전역/미래예약 이벤트는 무제한 고정형(unlimited)으로만 생성을 강제 허용
    if (!occurrenceId && expireUnit !== 'unlimited') {
      return jsonNoStore<CreateQrResponse>({ error: '회차가 확정되지 않은 예약 행사는 무제한(unlimited) 유형의 고정 QR만 발행할 수 있습니다.' }, { status: 400 })
    }

    const validationError = validateExpireSetting(expireUnit, expireValue)
    if (validationError) {
      return jsonNoStore<CreateQrResponse>({ error: validationError }, { status: 400 })
    }

    let targetEventId = eventId
    let expiresAt: string | null = null

    // 💡 분기 로직: 회차 ID가 존재하는 당일/일반 활성 행사 처리 시
    if (occurrenceId) {
      const { data: occurrence, error: occurrenceError } = await supabaseAdmin
        .from('event_occurrences')
        .select('id, event_id, occurrence_date, start_time, status')
        .eq('id', occurrenceId)
        .single()

      if (occurrenceError || !occurrence) {
        return jsonNoStore<CreateQrResponse>({ error: '지정된 회차를 찾을 수 없습니다.' }, { status: 404 })
      }

      if (occurrence.status === 'closed' || occurrence.status === 'archived') {
        return jsonNoStore<CreateQrResponse>({ error: '종료되었거나 아카이브된 회차에는 QR을 발급할 수 없습니다.' }, { status: 400 })
      }

      targetEventId = occurrence.event_id
      expiresAt = buildExpiresAt(occurrence.start_time, expireUnit, expireValue)
    } else {
      // 회차가 존재하지 않는 미래 예약형 건은 기준 시각이 없으므로 무제한(null) 매핑
      expiresAt = null
    }

    if (!targetEventId) {
      return jsonNoStore<CreateQrResponse>({ error: '바인딩할 이벤트 식별자(event_id)를 확인할 수 없습니다.' }, { status: 400 })
    }

    const nowIso = new Date().toISOString()

    // 💡 개선 사항: 새 QR을 만들기 전에, 해당 도메인(같은 회차 혹은 같은 이벤트의 고정 QR)의 기존 활성 QR을 영리하게 만료 처리
    let expireQuery = supabaseAdmin
      .from('qr_tokens')
      .update({ expires_at: nowIso })
      .is('deleted_at', null)
      .or(`expires_at.gt.${nowIso},expires_at.is.null`)

    if (occurrenceId) {
      expireQuery = expireQuery.eq('occurrence_id', occurrenceId)
    } else {
      expireQuery = expireQuery.eq('event_id', targetEventId).is('occurrence_id', null)
    }

    const { error: expirePreviousError } = await expireQuery

    if (expirePreviousError) {
      console.error('[qr/create] expire previous qr error:', expirePreviousError)
      return jsonNoStore<CreateQrResponse>({ error: '기존 동기화된 QR 만료 처리에 실패했습니다.' }, { status: 500 })
    }

    // 보안 토큰 유틸 암호화 적용
    const rawToken = generateQrToken()
    const tokenHash = hashQrToken(rawToken)
    const tokenEncrypted = encryptQrToken(rawToken)
    const isUnlimited = expireUnit === 'unlimited'

    // 최종 테이블 인서트 (예약건은 occurrence_id가 깔끔하게 null로 적재됨)
    const { data: createdQr, error: createError } = await supabaseAdmin
      .from('qr_tokens')
      .insert({
        event_id: targetEventId,
        occurrence_id: isUnlimited ? null : occurrenceId,
        token_hash: tokenHash,
        token_encrypted: tokenEncrypted,
        expires_at: expiresAt,
        used_count: 0,
      })
      .select('id, event_id, occurrence_id, expires_at, used_count, created_at')
      .single<CreatedQrRow>()

    if (createError || !createdQr) {
      return jsonNoStore<CreateQrResponse>(
        { error: createError?.message || '새로운 QR 레코드 생성 도중 원격 저장소 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    const qrUrl = `${request.nextUrl.origin}/attendance/scan?token=${rawToken}`

    return jsonNoStore<CreateQrResponse>(
      {
        message: 'QR 코드가 성공적으로 생성되었습니다. 기존의 활성 QR 코드는 자동 만료 및 교체되었습니다.',
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
      return jsonNoStore<CreateQrResponse>({ error: '허용되지 않은 접근 요청입니다 (CSRF 차단).' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'INVALID_OCCURRENCE_START_TIME') {
      return jsonNoStore<CreateQrResponse>({ error: '회차 시작 시간 포맷이 올바르지 않습니다.' }, { status: 500 })
    }
    if (process.env.NODE_ENV !== 'production') {
      console.error('[qr/create] unexpected error:', error)
    }
    return jsonNoStore<CreateQrResponse>({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}