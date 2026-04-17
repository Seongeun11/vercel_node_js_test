// app/api/attendance-change-requests/my/route.ts
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  const authResult = await requireRole(['trainee'])

  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('attendance_change_requests')
    .select(`
      id,
      attendance_id,
      requested_status,
      reason,
      status,
      review_comment,
      reviewed_at,
      created_at
    `)
    .eq('requester_user_id', authResult.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: '내 요청 목록을 불러오지 못했습니다.' },
      { status: 400 }
    )
  }

  return NextResponse.json({ items: data ?? [] }, { status: 200 })
}