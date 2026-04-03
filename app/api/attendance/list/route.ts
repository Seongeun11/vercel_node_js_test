import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { requireRole } from '@/lib/serverAuth'

type AttendanceListBody = {
  event_id?: string
}

export async function POST(request: Request) {
  try {
    const authResult = await requireRole(['admin'])

    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = (await request.json().catch(() => ({}))) as AttendanceListBody
    const { event_id } = body

    if (!event_id) {
      return NextResponse.json(
        { error: 'event_id가 필요합니다.' },
        { status: 400 }
      )
    }

    // attendance 테이블 예시 컬럼:
    // id, event_id, user_id, status, checked_at, created_at
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        id,
        event_id,
        user_id,
        status,
        checked_at,
        created_at,
        users (
          id,
          full_name,
          student_id,
          role
        )
      `)
      .eq('event_id', event_id)
      .order('checked_at', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    const rows = data ?? []

    const summary = {
      total: rows.length,
      present: rows.filter((row) => row.status === 'present').length,
      late: rows.filter((row) => row.status === 'late').length,
    }

    return NextResponse.json(
      {
        attendances: rows,
        summary,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('attendance/list POST error:', error)

    return NextResponse.json(
      { error: '출석 현황 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}