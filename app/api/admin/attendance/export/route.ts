// app/api/admin/attendance/export/route.ts
import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

//GET 다운로드 
//assertSameOrigin(request)없는게 맞음
type AttendanceStatus = 'present' | 'late' | 'absent'

type AttendanceUser =
  | {
      student_id: string
      full_name: string
    }
  | {
      student_id: string
      full_name: string
    }[]
  | null

type AttendanceRow = {
  id: string
  user_id: string
  event_id: string
  attendance_date: string | null
  date: string | null
  status: AttendanceStatus
  user: AttendanceUser
}

function getJoinedUser(user: AttendanceUser) {
  return Array.isArray(user) ? user[0] ?? null : user
}

function formatStatus(status: AttendanceStatus): string {
  switch (status) {
    case 'present':
      return '출석'
    case 'late':
      return '지각'
    case 'absent':
      return '결석'
    default:
      return ''
  }
}

function formatExcelDate(dateText: string): string {
  return dateText.replaceAll('-', '.')
}

function sanitizeSheetName(name: string): string {
  // Excel 시트명 제한: \ / ? * [ ] : 사용 불가, 최대 31자
  return name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || '출석현황'
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, ' ').trim() || '출석현황'
}

export async function GET(request: NextRequest): Promise<Response> {
  const authResult = await requireRole(['admin'])

  if (!authResult.ok) {
    return Response.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  const { searchParams } = request.nextUrl
  const eventId = searchParams.get('event_id')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')

  if (!eventId) {
    return Response.json(
      { error: '이벤트를 선택해주세요.' },
      { status: 400 }
    )
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from('events')
    .select('id, name')
    .eq('id', eventId)
    .maybeSingle()

  if (eventError || !event) {
    return Response.json(
      { error: '이벤트를 찾을 수 없습니다.' },
      { status: 404 }
    )
  }

  let query = supabaseAdmin
    .from('attendance')
    .select(`
      id,
      user_id,
      event_id,
      attendance_date,
      date,
      status,
      user:profiles (
        student_id,
        full_name
      )
    `)
    .eq('event_id', eventId)
    .order('attendance_date', { ascending: false })

  if (dateFrom) query = query.gte('attendance_date', dateFrom)
  if (dateTo) query = query.lte('attendance_date', dateTo)

  const { data, error } = await query

  if (error) {
    console.error('[attendance/export] query error:', error)

    return Response.json(
      { error: '출석 데이터를 불러오지 못했습니다.' },
      { status: 500 }
    )
  }

  const rows = (data ?? []) as unknown as AttendanceRow[]

  const dateSet = new Set<string>()
  const userMap = new Map<
    string,
    {
      student_id: string
      full_name: string
      statuses: Record<string, string>
    }
  >()

  for (const row of rows) {
    const attendanceDate = row.attendance_date ?? row.date
    const user = getJoinedUser(row.user)

    if (!attendanceDate || !user) continue

    dateSet.add(attendanceDate)

    const key = user.student_id

    if (!userMap.has(key)) {
      userMap.set(key, {
        student_id: user.student_id,
        full_name: user.full_name,
        statuses: {},
      })
    }

    userMap.get(key)!.statuses[attendanceDate] = formatStatus(row.status)
  }

  const sortedDates = Array.from(dateSet).sort((a, b) => b.localeCompare(a))

  const excelRows = Array.from(userMap.values())
    .sort((a, b) => a.student_id.localeCompare(b.student_id))
    .map((user) => {
      const row: Record<string, string> = {
        출석번호: user.student_id,
        이름: user.full_name,
      }

      for (const date of sortedDates) {
        row[formatExcelDate(date)] = user.statuses[date] ?? ''
      }

      return row
    })

  const worksheet = XLSX.utils.json_to_sheet(excelRows)

  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 12 },
    ...sortedDates.map(() => ({ wch: 12 })),
  ]

  const workbook = XLSX.utils.book_new()
  const sheetName = sanitizeSheetName(event.name)
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  const buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })

  const safeFileName = sanitizeFileName(event.name)
  const fileName = encodeURIComponent(`${safeFileName}_출석현황.xlsx`)

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
      'Cache-Control': 'no-store',
    },
  })
}