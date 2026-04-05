// app/api/qr/delete/route.ts
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

type DeleteQrBody = {
  id?: string
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

    const body = (await request.json()) as DeleteQrBody
    const id = String(body.id || '').trim()

    if (!id) {
      return NextResponse.json(
        { error: 'QR ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const { data: existingQr, error: existingError } = await supabaseAdmin
      .from('qr_tokens')
      .select('id')
      .eq('id', id)
      .single()

    if (existingError || !existingQr) {
      return NextResponse.json(
        { error: '삭제할 QR을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const { error: deleteError } = await supabaseAdmin
      .from('qr_tokens')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'QR이 삭제되었습니다.' },
      { status: 200 }
    )
  } catch (error) {
    console.error('qr/delete POST error:', error)
    return NextResponse.json(
      { error: 'QR 삭제 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}