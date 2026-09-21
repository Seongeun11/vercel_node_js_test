//app\api\notion-sync\route.ts
import { NextRequest } from 'next/server'
import { Client } from '@notionhq/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonNoStore } from '@/lib/security/api-response'

const NOTION_TOKEN = process.env.NOTION_TOKEN!
const NOTION_DATABASE_ID = process.env.NOTION_ATTENDANCE_DB_ID!

// Notion Client (페이지 생성/수정용)
const notion = new Client({ auth: NOTION_TOKEN })

type NotionSyncPayload = {
  user_id: string
  event_id: string
  attendance_id?: string
}

export async function POST(request: NextRequest) {
  try {
    // 1. Webhook 또는 외부 호출 보안 검증
    const secretHeader = request.headers.get('x-notion-sync-secret')
    if (NOTION_TOKEN && secretHeader !== NOTION_TOKEN) {
      return jsonNoStore({ error: '인증되지 않은 동기화 요청입니다.' }, { status: 401 })
    }

    const body = (await request.json()) as NotionSyncPayload
    const { user_id, event_id, attendance_id } = body

    if (!user_id || !event_id) {
      return jsonNoStore(
        { error: '필수 파라미터(user_id, event_id)가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 2. Supabase 쿼리: profiles.enrollment_status 가 'active' 인 건만 !inner 로 조인
    let attendanceQuery = supabaseAdmin
      .from('attendance')
      .select(`
        id,
        status,
        method,
        check_time,
        attendance_date,
        profiles!inner (
          id,
          full_name,
          student_id,
          cohort_no,
          enrollment_status,
          affiliations ( name )
        ),
        events!inner (
          id,
          name,
          is_active
        )
      `)
      .eq('user_id', user_id)
      .eq('event_id', event_id)
      .eq('profiles.enrollment_status', 'active')

    if (attendance_id) {
      attendanceQuery = attendanceQuery.eq('id', attendance_id)
    } else {
      attendanceQuery = attendanceQuery.order('check_time', { ascending: false }).limit(1)
    }

    const { data: attendanceList, error: dbError } = await attendanceQuery

    if (dbError) {
      console.error('[API Notion-Sync DB Error]:', dbError)
      return jsonNoStore({ error: dbError.message }, { status: 500 })
    }

    const attendanceData = attendanceList?.[0] as any

    if (!attendanceData) {
      return jsonNoStore(
        {
          success: true,
          synced: false,
          message: 'enrollment_status가 active인 사용자의 출석 데이터가 존재하지 않아 동기화를 스킵했습니다.',
        },
        { status: 200 }
      )
    }

    // 3. 데이터 매핑
    const user = attendanceData.profiles
    const event = attendanceData.events
    const affiliationName = user?.affiliations?.name ?? '미지정'

    // 4. Notion Properties 객체 작성
    const notionProperties: Record<string, any> = {
      '이름': {
        title: [{ text: { content: user.full_name } }],
      },
      '학번': {
        rich_text: [{ text: { content: user.student_id } }],
      },
      '소속': {
        select: { name: affiliationName },
      },
      '이벤트명': {
        select: { name: event.name },
      },
      '출석 상태': {
        select: { name: attendanceData.status },
      },
      '인증 방식': {
        select: { name: attendanceData.method },
      },
      '출석 시간': {
        date: { start: new Date(attendanceData.check_time).toISOString() },
      },
      '출석 ID': {
        rich_text: [{ text: { content: attendanceData.id } }],
      },
      '기수': {
        number: user.cohort_no ?? 0,
      },
    }

    // 5. Notion Direct HTTP REST API 호출 (버전 충돌/메소드 미존재 방지)
    const queryResponse = await fetch(
      `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: {
            property: '출석 ID',
            rich_text: { equals: attendanceData.id },
          },
        }),
      }
    )

    if (!queryResponse.ok) {
      const errorText = await queryResponse.text()
      throw new Error(`Notion DB Query HTTP Error: ${queryResponse.status} ${errorText}`)
    }

    const queryData = await queryResponse.json()
    const existingPages = queryData.results || []

    if (existingPages.length > 0) {
      // 이미 노션에 존재하면 Update
      const pageId = existingPages[0].id
      await notion.pages.update({
        page_id: pageId,
        properties: notionProperties,
      })
    } else {
      // 신규 등록이면 Create
      await notion.pages.create({
        parent: { database_id: NOTION_DATABASE_ID },
        properties: notionProperties,
      })
    }

    return jsonNoStore(
      {
        success: true,
        synced: true,
        attendance_id: attendanceData.id,
        student_name: user.full_name,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[API Notion-Sync Unexpected Error]:', error)
    return jsonNoStore(
      { error: error.message || '노션 동기화 처리 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}