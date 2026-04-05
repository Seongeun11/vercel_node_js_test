// app/api/events/list/route.ts
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST() {
  try {
    const authResult = await requireRole(['admin', 'captain', 'trainee'])

    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { data: events, error } = await supabaseAdmin
      .from('events')
      .select('id, name, start_time, late_threshold_min, allow_duplicate_check, created_at')
      .order('start_time', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        events: events ?? [],
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('events/list POST error:', error)
    return NextResponse.json(
      { error: '이벤트 목록 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}