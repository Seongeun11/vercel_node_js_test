// app/api/admin/attendance/export/route.ts
import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

type AttendanceStatus = 'present' | 'late' | 'absent'

function formatStatus(status: AttendanceStatus): string {
  switch (status) {
    case 'present': return '출석'
    case 'late': return '지각'
    case 'absent': return '결석'
    default: return ''
  }
}

function formatExcelDate(dateText: string): string {
  return dateText.replaceAll('-', '.')
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || '통합출석현황'
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, ' ').trim() || '통합출석현황'
}

/**
 * ✨ check_time(UTC Timestamp)을 받아 KST 기준 날짜를 구하고,
 * KST 새벽 00:00 ~ 04:59 출석건인 경우 전날(D-1) YYYY-MM-DD 문자열로 반환합니다.
 */
function getAdjustedKSTDate(checkTime: string): string | null {
  const dateObj = new Date(checkTime)
  if (isNaN(dateObj.getTime())) return null

  // KST(Asia/Seoul) 타임존으로 파싱
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(dateObj)
  const partMap: Record<string, string> = {}
  parts.forEach(({ type, value }) => {
    partMap[type] = value
  })

  let year = parseInt(partMap.year, 10)
  let month = parseInt(partMap.month, 10) - 1 // JS Date Month는 0-indexed
  let day = parseInt(partMap.day, 10)
  const hours = parseInt(partMap.hour, 10)

  // KST 기준 00:00 ~ 04:59인 경우 전날(D-1)로 이동
  if (hours >= 0 && hours < 5) {
    const prevDate = new Date(Date.UTC(year, month, day - 1))
    year = prevDate.getUTCFullYear()
    month = prevDate.getUTCMonth()
    day = prevDate.getUTCDate()
  }

  const formattedMonth = String(month + 1).padStart(2, '0')
  const formattedDay = String(day).padStart(2, '0')

  return `${year}-${formattedMonth}-${formattedDay}`
}

export async function GET(request: NextRequest): Promise<Response> {
  const authResult = await requireRole(['admin'])
  if (!authResult.ok) {
    return Response.json({ error: authResult.error }, { status: authResult.status })
  }

  const { searchParams } = request.nextUrl
  const eventIds = searchParams.getAll('event_id')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const affiliationId = searchParams.get('affiliation_id')

  if (!eventIds || eventIds.length === 0) {
    return Response.json({ error: '행사를 최소 하나 이상 선택해주세요.' }, { status: 400 })
  }

  // 1. 행사 정보 조회
  const { data: eventList, error: eventError } = await supabaseAdmin
    .from('events')
    .select('id, name')
    .in('id', eventIds)

  if (eventError || !eventList || eventList.length === 0) {
    return Response.json({ error: '선택한 행사 정보를 찾을 수 없습니다.' }, { status: 404 })
  }

  const eventMap = new Map<string, string>()
  eventList.forEach(e => eventMap.set(e.id, e.name))

  // 2. 대상 수강생 목록 조회
  let userQuery = supabaseAdmin
    .from('profiles')
    .select('id, student_id, full_name, cohort_no, enrollment_status, affiliation_id, roles!inner(name)')
    .eq('roles.name', 'trainee')
    .eq('enrollment_status', 'active')

  if (affiliationId) {
    userQuery = userQuery.eq('affiliation_id', affiliationId)
  }

  const { data: trainees, error: userError } = await userQuery

  if (userError || !trainees) {
    return Response.json({ error: '교육생 정보를 불러오지 못했습니다.' }, { status: 500 })
  }

  // 3. 출석 데이터 조회
  let attendanceQuery = supabaseAdmin
    .from('attendance')
    .select('user_id, event_id, status, check_time')
    .in('event_id', eventIds)
    .order('check_time', { ascending: true })

  // KST 시차 및 새벽 보정 오차 방지를 위해 UTC 검색 범위 확장 (-1일 ~ +2일)
  if (dateFrom) {
    const [y, m, d] = dateFrom.split('-').map(Number)
    const gteDate = new Date(Date.UTC(y, m - 1, d - 1)).toISOString()
    attendanceQuery = attendanceQuery.gte('check_time', gteDate)
  }

  if (dateTo) {
    const [y, m, d] = dateTo.split('-').map(Number)
    const lteDate = new Date(Date.UTC(y, m - 1, d + 2)).toISOString()
    attendanceQuery = attendanceQuery.lte('check_time', lteDate)
  }

  const { data: attendanceData } = await attendanceQuery

  // 4. 데이터 구조화 및 매핑
  const columnsSet = new Set<string>()
  const userMap = new Map<string, {
    student_id: string
    full_name: string
    cohort_no: number | null
    statuses: Record<string, string>
    attendedCount: number
  }>()

  for (const t of trainees) {
    userMap.set(t.id, {
      student_id: t.student_id || '',
      full_name: t.full_name || '',
      cohort_no: t.cohort_no,
      statuses: {},
      attendedCount: 0
    })
  }

  if (attendanceData) {
    for (const row of attendanceData) {
      if (!row.check_time || !row.event_id) continue

      // ✨ KST 시각 변환 및 새벽 보정 날짜 산출
      const adjustedDate = getAdjustedKSTDate(row.check_time)
      if (!adjustedDate) continue

      // ✨ 요청 조건(dateFrom, dateTo) 메모리 정확 필터링
      if (dateFrom && adjustedDate < dateFrom) continue
      if (dateTo && adjustedDate > dateTo) continue

      if (userMap.has(row.user_id)) {
        const eventName = eventMap.get(row.event_id) || '알 수 없는 행사'
        const formattedDate = formatExcelDate(adjustedDate)
        const columnHeader = `${formattedDate} (${eventName})`

        columnsSet.add(columnHeader)
        const targetUser = userMap.get(row.user_id)!

        const prevStatusText = targetUser.statuses[columnHeader]
        const newStatusText = formatStatus(row.status as AttendanceStatus)

        const wasAttended = prevStatusText === '출석' || prevStatusText === '지각'
        const isAttended = row.status === 'present' || row.status === 'late'

        if (!wasAttended && isAttended) {
          targetUser.attendedCount += 1
        } else if (wasAttended && !isAttended) {
          targetUser.attendedCount = Math.max(0, targetUser.attendedCount - 1)
        }

        targetUser.statuses[columnHeader] = newStatusText
      }
    }
  }

  const sortedColumns = Array.from(columnsSet).sort((a, b) => b.localeCompare(a))

  // 5. Excel Row 생성
  const excelRows = Array.from(userMap.values())
    .sort((a, b) => (a.student_id || '').localeCompare(b.student_id || ''))
    .map((user) => {
      const totalColumns = sortedColumns.length
      const attendanceRate = totalColumns > 0
        ? Math.round((user.attendedCount / totalColumns) * 100)
        : 0

      const row: Record<string, string> = {
        출석번호: user.student_id,
        이름: user.full_name,
        기수: user.cohort_no != null ? String(user.cohort_no) : '',
        '평균 출석률': `${attendanceRate}%`,
      }

      for (const column of sortedColumns) {
        row[column] = user.statuses[column] || '-'
      }

      return row
    })

  // 6. Excel 파일 생성 및 Response 반환
  const worksheet = XLSX.utils.json_to_sheet(excelRows)

  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 8 },
    { wch: 14 },
    ...sortedColumns.map(() => ({ wch: 26 }))
  ]

  const workbook = XLSX.utils.book_new()
  const representativeName = eventList.length > 1
    ? `${eventList[0].name}_외_${eventList.length - 1}건`
    : eventList[0].name

  XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(representativeName))

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  const fileName = encodeURIComponent(`${sanitizeFileName(representativeName)}_통합출석현황.xlsx`)

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
      'Cache-Control': 'no-store',
    },
  })
}