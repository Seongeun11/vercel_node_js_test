// app/api/profiles/list/route.ts
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const authResult = await requireRole(['admin', 'captain'])

    if (!authResult.ok) {
      return jsonNoStore(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, student_id, role')
      .order('full_name', { ascending: true })

    if (error) {
      return jsonNoStore(
        { error: error.message },
        { status: 500 }
      )
    }

    return jsonNoStore({ users: data ?? [] }, { status: 200 })
  } catch (error) {
    console.error('profiles/list POST error:', error)
    return jsonNoStore(
      { error: '사용자 목록 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}