// app/api/attendance-change-requests/queue/route.ts
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const authResult = await requireRole(['captain', 'admin'])

    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const supabase = await createSupabaseServerClient()

    const { data, error } = await supabase.rpc(
      'get_captain_attendance_change_request_queue'
    )

    if (error) {
      console.error('[attendance-change-requests/queue]', error)

      if (error.message.includes('FORBIDDEN')) {
        return NextResponse.json(
          { error: '권한이 없습니다.' },
          { status: 403 }
        )
      }

      return NextResponse.json(
        {
          error: '변경 요청 큐를 불러오지 못했습니다.'
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { items: data ?? [] },
      { status: 200 }
    )
  } catch (error) {
    console.error('[attendance-change-requests/queue][unexpected]', error)

    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}