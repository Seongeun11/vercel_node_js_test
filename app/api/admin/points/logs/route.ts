// app/api/admin/points/logs/route.ts
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const authResult = await requireRole(['admin'])
    if (!authResult.ok) return jsonNoStore({ error: authResult.error }, { status: 401 })

    // 💡 [추가] URL 검색 파라미터에서 날짜 추출
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Base Query 선언
    let query = supabaseAdmin
      .from('point_logs')
      .select(`
        id, user_id, amount, action, attendance_id, actor_id, reason, balance_after_action, created_at,
        profiles!point_logs_user_id_fkey ( full_name )
      `)

    // 💡 [조건별 가변 쿼리 빌더 논리]
    if (startDate) {
      // 시작일의 00시 00분 00초 이상
      query = query.gte('created_at', `${startDate}T00:00:00+09:00`)
    }
    if (endDate) {
      // 종료일의 23시 59분 59초 이하
      query = query.lte('created_at', `${endDate}T23:59:59+09:00`)
    }

    const { data: logsData, error: dbError } = await query
      .order('created_at', { ascending: false })
      .limit(300)

    if (dbError) throw dbError

    const flattenedLogs = (logsData ?? []).map((log: any) => ({
      id: log.id,
      user_id: log.user_id,
      user_name: log.profiles?.full_name || '미확인 회원',
      amount: log.amount,
      action: log.action,
      reason: log.reason || '사유 미기입',
      balance_after_action: log.balance_after_action,
      created_at: log.created_at,
    }))

    return jsonNoStore({ success: true, data: flattenedLogs })
  } catch (error: any) {
    return jsonNoStore({ error: error.message || '서버 에러' }, { status: 500 })
  }
}