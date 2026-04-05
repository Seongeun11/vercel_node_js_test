// app/api/attendance/list/route.ts
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

type AttendanceListBody = {
  event_id?: string
  date?: string
}

export async function POST(request: Request) {
  try {
    // 1) 권한 체크
    const authResult = await requireRole(['admin', 'captain'])

    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    // 2) 요청 파싱
    const body = (await request.json()) as AttendanceListBody

    const eventId = String(body.event_id || '').trim()
    const date = String(body.date || '').trim()

    // 3) 입력값 검증
    if (!eventId || !date) {
      return NextResponse.json(
        { error: 'event_id와 date는 필수입니다.' },
        { status: 400 }
      )
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'date 형식이 올바르지 않습니다. (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    // 4) 이벤트 존재 확인
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, name, start_time, late_threshold_min')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: '이벤트를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 5) 출석 목록 조회
    const { data, error } = await supabaseAdmin
      .from('attendance')
      .select(`
        id,
        user_id,
        event_id,
        date,
        status,
        method,
        check_time,
        profiles!attendance_user_id_fkey (
          id,
          full_name,
          student_id,
          role
        ),
        events!attendance_event_id_fkey (
          id,
          name
        )
      `)
      .eq('event_id', eventId)
      .eq('date', date)
      .order('check_time', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // 6) 프론트에서 바로 쓰기 좋게 shape 정리
    const attendance = (data ?? []).map((item: any) => ({
      id: item.id,
      user_id: item.user_id,
      event_id: item.event_id,
      date: item.date,
      status: item.status,
      method: item.method,
      check_time: item.check_time,
      user: item.profiles
        ? {
            id: item.profiles.id,
            full_name: item.profiles.full_name,
            student_id: item.profiles.student_id,
            role: item.profiles.role,
          }
        : null,
      event: item.events
        ? {
            id: item.events.id,
            name: item.events.name,
          }
        : null,
    }))

    return NextResponse.json(
      {
        event,
        attendance,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('attendance/list POST error:', error)
    return NextResponse.json(
      { error: '출석 목록 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}