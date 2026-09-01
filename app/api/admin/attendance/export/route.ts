import { NextRequest } from 'next/server'
import ExcelJS from 'exceljs'
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

function getAdjustedKSTDate(checkTime: string): string | null {
  const dateObj = new Date(checkTime)
  if (isNaN(dateObj.getTime())) return null

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
  let month = parseInt(partMap.month, 10) - 1
  let day = parseInt(partMap.day, 10)
  const hours = parseInt(partMap.hour, 10)

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

  // 4. 수강생들의 스케쥴(외출/휴가 사유) 데이터 조회
  const traineeIds = trainees.map(t => t.id)
  let scheduleQuery = supabaseAdmin
  .from('user_schedules')
  .select(`
    id,
    user_id,
    start_date,
    end_date,
    absence_reason,
    absence_type_info:absence_type ( text ),
    profiles:user_id ( student_id, full_name )
  `)
  .in('user_id', traineeIds.length > 0 ? traineeIds : ['00000000-0000-0000-0000-000000000000'])
  .order('start_date', { ascending: true })

// ✨ 기간 지난 스케쥴 제외 조건 추가 (조회 기간과 겹치는 스케쥴만 필터링)
if (dateFrom) {
  scheduleQuery = scheduleQuery.gte('end_date', dateFrom)
}
if (dateTo) {
  scheduleQuery = scheduleQuery.lte('start_date', dateTo)
}

const { data: userSchedules } = await scheduleQuery.order('start_date', { ascending: true })
  // 5. 데이터 구조화 및 매핑
  const columnsSet = new Set<string>()
  const userMap = new Map<string, {
    student_id: string
    full_name: string
    cohort_no: number | null
    statuses: Record<string, string>
    attendedCount: number // 출석 + 지각 합산
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

      const adjustedDate = getAdjustedKSTDate(row.check_time)
      if (!adjustedDate) continue

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

        // 출석 + 지각인 경우 출석 횟수로 카운트
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

  // 6. ExcelJS 워크북 생성
  const workbook = new ExcelJS.Workbook()
  const representativeName = eventList.length > 1
    ? `${eventList[0].name}_외_${eventList.length - 1}건`
    : eventList[0].name

  const worksheet = workbook.addWorksheet(sanitizeSheetName(representativeName))

  // 헤더 컬럼 정의
  const baseHeaders = ['출석번호', '이름', '기수', '출석 횟수']
  const allHeaders = [...baseHeaders, ...sortedColumns]

  const headerRow = worksheet.addRow(allHeaders)
  headerRow.font = { bold: true, color: { argb: 'FF1E293B' } }
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    }
  })

  // 회원별 행 추가 및 스타일링 (출석: 초록, 지각: 노랑, 결석: 무색)
  const sortedUsers = Array.from(userMap.values())
    .sort((a, b) => (a.student_id || '').localeCompare(b.student_id || ''))

  sortedUsers.forEach((user) => {
    const rowValues = [
      user.student_id,
      user.full_name,
      user.cohort_no != null ? String(user.cohort_no) : '',
      user.attendedCount, // 평균 출석률 대신 출석+지각 합산 횟수
    ]

    for (const col of sortedColumns) {
      rowValues.push(user.statuses[col] || '-')
    }

    const row = worksheet.addRow(rowValues)

    row.eachCell((cell, colNumber) => {
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }

      // 출석일자 컬럼 색상 처리
      if (colNumber > baseHeaders.length) {
        const val = cell.value?.toString()
        if (val === '출석') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFDCFCE7' }, // Light Green
          }
          cell.font = { color: { argb: 'FF15803D' }, bold: true }
        } else if (val === '지각') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFEF9C3' }, // Light Yellow
          }
          cell.font = { color: { argb: 'FFA16207' }, bold: true }
        }
        // 결석/미출석은 기본 무색
      }
    })
  })

  // 7. 엑셀 가장 밑에 등록된 스케쥴 사유 표 추가
  if (userSchedules && userSchedules.length > 0) {
    worksheet.addRow([]) // 빈 행 추가

    const scheduleTitleRow = worksheet.addRow(['스케쥴 등록 회원 사유 목록'])
    scheduleTitleRow.font = { bold: true, size: 11, color: { argb: 'FF0F172A' } }

    const scheduleHeaderRow = worksheet.addRow(['학번', '이름', '외출 유형', '기간', '사유'])
    scheduleHeaderRow.font = { bold: true }
    scheduleHeaderRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } },
      }
    })

    userSchedules.forEach((sch: any) => {
      const studentId = sch.profiles?.student_id || '-'
      const name = sch.profiles?.full_name || '-'
      const typeText = sch.absence_type_info?.text || '-'
      const period = `${sch.start_date || ''} ~ ${sch.end_date || ''}`
      const reason = sch.absence_reason || '사유 없음'

      const schRow = worksheet.addRow([studentId, name, typeText, period, reason])
      schRow.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        }
      })
    })
  }

  // 컬럼 너비 설정
  worksheet.columns.forEach((col, idx) => {
    if (idx === 0) col.width = 14
    else if (idx === 1) col.width = 12
    else if (idx === 2) col.width = 8
    else if (idx === 3) col.width = 12
    else col.width = 24
  })

  // 8. Buffer 생성 및 Response 반환
  const uint8Array = await workbook.xlsx.writeBuffer()
  const buffer = Buffer.from(uint8Array)
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