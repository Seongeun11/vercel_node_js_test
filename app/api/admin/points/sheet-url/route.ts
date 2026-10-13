// app/api/admin/points/sheet-url/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

// 1. GET 핸들러 (링크 조회 또는 크론용)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(['admin']).catch(() => ({ ok: false }))
    const authHeader = request.headers.get('authorization')
    
    // 관리자 권한 혹은 크론 시크릿 인증 통과 허용
    if (!authResult.ok && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return jsonNoStore({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'google_sheet_sync_url')
      .maybeSingle()

    if (error) {
      return jsonNoStore({ success: true, sheetUrl: '' })
    }

    return jsonNoStore({ success: true, sheetUrl: data?.value || '' })
  } catch (err: any) {
    return jsonNoStore({ error: err.message || '서버 오류' }, { status: 500 })
  }
}

// 2. POST 핸들러 (구글 시트 링크 저장용)
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json().catch(() => ({}))
    const { sheetUrl } = body

    if (!sheetUrl || typeof sheetUrl !== 'string') {
      return jsonNoStore({ error: '유효한 링크를 입력해주세요.' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('system_settings')
      .upsert({ 
        key: 'google_sheet_sync_url', 
        value: sheetUrl.trim(), 
        updated_at: new Date().toISOString() 
      })

    if (error) {
      console.error('Sheet URL Save DB Error:', error)
      return jsonNoStore({ error: '데이터베이스 저장에 실패했습니다.' }, { status: 500 })
    }

    return jsonNoStore({ success: true, message: '구글 시트 링크가 성공적으로 저장되었습니다.' })
  } catch (err: any) {
    if (err.message === 'CSRF_BLOCKED') {
      return jsonNoStore({ error: '허용되지 않은 요청입니다.' }, { status: 403 })
    }
    console.error('Sheet URL Save Unexpected Error:', err)
    return jsonNoStore({ error: err.message || '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}