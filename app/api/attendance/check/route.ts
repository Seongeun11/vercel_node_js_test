// app/api/attendance/check/route.ts
import { supabase } from '../../../../lib/supabaseClient'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/serverAuth'

function getKSTDateString(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date) // ex) 2026-03-31
}

function getKSTDateTimeString(date = new Date()) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

export async function POST(request: Request) {
  try {
    const { event_id, user_id } = await request.json()

    if (!user_id) {
      return NextResponse.json({ error: 'user_id 없음' }, { status: 400 })
    }
    const authResult = await requireRole(user_id, ['admin', 'captain', 'trainee'])

    //서버에서 DB에 없으면 막음
    if (!authResult.ok) { 
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: '이벤트 없음' }, { status: 400 })
    }

    const now = new Date()

    // DB에는 event.start_time을 timestamptz로 저장하는 걸 권장
    // 예: 2026-03-31T10:00:00+09:00 또는 2026-03-31T01:00:00Z
    const startTime = new Date(event.start_time)

    if (Number.isNaN(startTime.getTime())) {
      return NextResponse.json(
        { error: '이벤트 시간이 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    const lateLimit = new Date(
      startTime.getTime() + Number(event.late_threshold_min || 0) * 60 * 1000
    )

    const status = now > lateLimit ? 'late' : 'present'

    const attendanceDateKST = getKSTDateString(now)

    const { error: insertError } = await supabase
      .from('attendance')
      .insert({
        user_id,
        event_id,
        date: attendanceDateKST,     // 한국 날짜 기준
        status,
        check_time: now.toISOString(), // UTC 저장
        method: 'qr',
      })

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: '이미 출석하셨습니다.' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status,
      message: status === 'late' ? '지각입니다 ⏰' : '출석 완료 ✅',
      recorded_at_utc: now.toISOString(),
      recorded_at_kst: getKSTDateTimeString(now),
      attendance_date_kst: attendanceDateKST,
    })
  } catch (err) {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}