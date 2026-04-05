// app/api/profiles/list/route.ts
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST() {
  try {
    const authResult = await requireRole(['admin', 'captain'])

    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, student_id, role')
      .order('full_name', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ users: data ?? [] }, { status: 200 })
  } catch (error) {
    console.error('profiles/list POST error:', error)
    return NextResponse.json(
      { error: '사용자 목록 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}