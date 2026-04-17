// app/api/attendance-change-requests/approve/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/serverAuth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const approveSchema = z.object({
  request_id: z.number().int().positive(),
  review_comment: z.string().trim().max(500).optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireRole(['captain', 'admin'])

    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await req.json()
    const parsed = approveSchema.safeParse(body)

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? '잘못된 요청입니다.'

      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.rpc(
      'approve_attendance_change_request',
      {
        p_request_id: parsed.data.request_id,
        p_review_comment: parsed.data.review_comment ?? null,
      }
    )

    if (error) {
      const message = error.message || ''

      if (message.includes('FORBIDDEN')) {
        return NextResponse.json(
          { error: '권한이 없습니다.' },
          { status: 403 }
        )
      }

      if (message.includes('REQUEST_NOT_FOUND_OR_ALREADY_PROCESSED')) {
        return NextResponse.json(
          { error: '이미 처리되었거나 존재하지 않는 요청입니다.' },
          { status: 404 }
        )
      }

      if (message.includes('ATTENDANCE_NOT_FOUND')) {
        return NextResponse.json(
          { error: '대상 출석 기록을 찾을 수 없습니다.' },
          { status: 404 }
        )
      }

      if (message.includes('TARGET_NOT_TRAINEE')) {
        return NextResponse.json(
          { error: '수련생의 요청만 처리할 수 있습니다.' },
          { status: 403 }
        )
      }

      if (message.includes('STATUS_IS_SAME')) {
        return NextResponse.json(
          { error: '이미 동일한 상태로 반영되어 있습니다.' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        {
          error: '변경 요청 승인에 실패했습니다.',
          detail: error.message,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { message: '변경 요청이 승인되었습니다.' },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}