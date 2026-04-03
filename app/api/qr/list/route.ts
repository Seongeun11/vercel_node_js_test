import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { requireRole } from '@/lib/serverAuth'

export async function POST() {
  try {
    const authResult = await requireRole(['admin'])

    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { data, error } = await supabase
      .from('qr_tokens')
      .select(`
        id,
        event_id,
        token,
        expires_at,
        used_count,
        created_at,
        created_by,
        events (
          id,
          name,
          start_time
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ qrTokens: data ?? [] }, { status: 200 })
  } catch (error) {
    console.error('qr/list POST error:', error)

    return NextResponse.json(
      { error: 'QR 목록 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}