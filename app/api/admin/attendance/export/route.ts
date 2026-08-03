// app/api/admin/attendance/export/route.ts
import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

type AttendanceStatus = 'present' | 'late' | 'absent'

interface Profile {
  id: string
  student_id: string | null
  full_name: string | null
  cohort_no: number | null
  enrollment_status: 'active' | 'completed'
  affiliation_id: string | null
}

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
 * ✨ [1안 적용] 익일 새벽(00:00 ~ 04:59) 출석 체크 건을 전날 날짜로 보정하는 함수
 */
function getAdjustedAttendanceDate(attendanceDate: string | null, checkTime: string | null): string | null {
  if (!checkTime) return attendanceDate;

  const dateObj = new Date(checkTime);
  const hours = dateObj.getHours();

  // 새벽 00:00 ~ 04:59 사이 찍힌 출석은 전날(D-1) 날짜로 통합
  if (hours >= 0 && hours < 5) {
    dateObj.setDate(dateObj.getDate() - 1);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return attendanceDate;
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

  // 2. 소속 필터가 걸린 active 상태의 trainee 유저 조회
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

  // 3. 복수 행사들의 출석 데이터 통합 조회 (check_time 함께 조회)
  let attendanceQuery = supabaseAdmin
    .from('attendance')
    .select('user_id, event_id, attendance_date, status, check_time')
    .in('event_id', eventIds)

  if (dateFrom) attendanceQuery = attendanceQuery.gte('attendance_date', dateFrom)
  if (dateTo) attendanceQuery = attendanceQuery.lte('attendance_date', dateTo)

  const { data: attendanceData } = await attendanceQuery

  // 4. 데이터 구조화 및 매핑 가공
  const columnsSet = new Set<string>()
  const userMap = new Map<string, {
    student_id: string
    full_name: string
    cohort_no: number | null
    statuses: Record<string, string>
    attendedCount: number // 순수 출석 + 지각 합산 카운트
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
      if (!row.attendance_date || !row.event_id) continue

      // ✨ 익일 새벽 출석건 날짜 보정 로직 수행
      const adjustedDate = getAdjustedAttendanceDate(row.attendance_date, row.check_time)
      if (!adjustedDate) continue

      if (userMap.has(row.user_id)) {
        const eventName = eventMap.get(row.event_id) || '알 수 없는 행사'
        const formattedDate = formatExcelDate(adjustedDate)
        const columnHeader = `${formattedDate} (${eventName})`
        
        columnsSet.add(columnHeader)
        userMap.get(row.user_id)!.statuses[columnHeader] = formatStatus(row.status as AttendanceStatus)

        if (row.status === 'present' || row.status === 'late') {
          userMap.get(row.user_id)!.attendedCount += 1
        }
      }
    }
  }

  // 날짜 역순 및 이벤트명 기준 정렬
  const sortedColumns = Array.from(columnsSet).sort((a, b) => b.localeCompare(a))

  // 5. 최종 엑셀 Row 딕셔너리 빌드
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

  // 6. SheetJS 파일 변환 및 전송
  const worksheet = XLSX.utils.json_to_sheet(excelRows)
  
  worksheet['!cols'] = [
    { wch: 14 }, // 출석번호
    { wch: 12 }, // 이름
    { wch: 8 },  // 기수
    { wch: 14 }, // 평균 출석률
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