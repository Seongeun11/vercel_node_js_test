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
}

interface AttendanceRow {
  attendance_date: string | null
  status: AttendanceStatus
  user_id: string
  event_id: string // 논리오류 보완: 복합 매핑을 위해 event_id 필드 추가 필수
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

export async function GET(request: NextRequest): Promise<Response> {
  const authResult = await requireRole(['admin'])
  if (!authResult.ok) {
    return Response.json({ error: authResult.error }, { status: authResult.status })
  }

  const { searchParams } = request.nextUrl
  
  //다중 쿼리 파라미터를 유실 없이 배열 전체로 수집합니다.
  const eventIds = searchParams.getAll('event_id')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')

  if (!eventIds || eventIds.length === 0) {
    return Response.json({ error: '행사를 최소 하나 이상 선택해주세요.' }, { status: 400 })
  }

  // 1. 선택된 모든 행사 정보(ID, 이름) 한 번에 가져오기
  const { data: eventList, error: eventError } = await supabaseAdmin
    .from('events')
    .select('id, name')
    .in('id', eventIds)

  if (eventError || !eventList || eventList.length === 0) {
    return Response.json({ error: '선택한 행사 정보를 찾을 수 없습니다.' }, { status: 404 })
  }

  // 빠른 이름 매핑 조회를 위한 Event Map 생성 (Key: event_id, Value: event_name)
  const eventMap = new Map<string, string>()
  eventList.forEach(e => eventMap.set(e.id, e.name))

  // 2. active 상태의 trainee 등급 유저만 조회
  const { data: trainees, error: userError } = await supabaseAdmin
    .from('profiles')
    .select('id, student_id, full_name, cohort_no, enrollment_status, roles!inner(name)')
    .eq('roles.name', 'trainee')
    .eq('enrollment_status', 'active')

  if (userError || !trainees) {
    return Response.json({ error: '교육생 정보를 불러오지 못했습니다.' }, { status: 500 })
  }

  // 3. 해당 복수 행사들의 출석 데이터 통합 조회
  // .eq에서 복수 바인딩이 가능한 .in 조건절로 교체
  let attendanceQuery = supabaseAdmin
    .from('attendance')
    .select('user_id, event_id, attendance_date, status')
    .in('event_id', eventIds)

  if (dateFrom) attendanceQuery = attendanceQuery.gte('attendance_date', dateFrom)
  if (dateTo) attendanceQuery = attendanceQuery.lte('attendance_date', dateTo)

  const { data: attendanceData } = await attendanceQuery

  // 4. 데이터 가공 단계
  // 유니크한 조합 컬럼 헤더 생성을 위한 셋 구조 설정
  const columnsSet = new Set<string>()
  const userMap = new Map<string, {
    student_id: string
    full_name: string
    cohort_no: number | null
    // 복합 키 구조 대응 매핑 컨테이너 (Key: "날짜 (행사명)", Value: 출석상태)
    statuses: Record<string, string>
  }>()

  // 모든 trainee 기본 셋팅
  for (const t of trainees) {
    userMap.set(t.id, {
      student_id: t.student_id || '',
      full_name: t.full_name || '',
      cohort_no: t.cohort_no,
      statuses: {},
    })
  }

  // 복합 다중 데이터 매핑 연산 진행
  if (attendanceData) {
    for (const row of attendanceData) {
      if (!row.attendance_date || !row.event_id) continue

      if (userMap.has(row.user_id)) {
        const eventName = eventMap.get(row.event_id) || '알 수 없는 행사'
        const formattedDate = formatExcelDate(row.attendance_date)
        
        //  열 헤더 명칭을 "날짜 (이벤트명)" 구조로 동적 빌드
        const columnHeader = `${formattedDate} (${eventName})`
        
        columnsSet.add(columnHeader)
        userMap.get(row.user_id)!.statuses[columnHeader] = formatStatus(row.status as AttendanceStatus)
      }
    }
  }

  // 날짜 역순 및 이벤트명 기준으로 열(Column) 정렬 규칙 구성
  const sortedColumns = Array.from(columnsSet).sort((a, b) => b.localeCompare(a))

  // 5. 최종 엑셀 행 배열 빌드
  const excelRows = Array.from(userMap.values())
    .sort((a, b) => (a.student_id || '').localeCompare(b.student_id || ''))
    .map((user) => {
      const row: Record<string, string> = {
        출석번호: user.student_id,
        이름: user.full_name,
        기수: user.cohort_no != null ? String(user.cohort_no) : '',
      }

      // 동적으로 생성된 모든 "날짜 (이벤트명)" 컬럼을 순회하며 데이터 배치
      for (const column of sortedColumns) {
        row[column] = user.statuses[column] || '-'
      }

      return row
    })

  // 6. 엑셀 바이너리 데이터 인코딩 및 출력 반환
  const worksheet = XLSX.utils.json_to_sheet(excelRows)
  
  // 고정폭(출석번호, 이름, 기수) 지정을 포함하여 동적 날짜 컬럼 폭 자동 최적화 조율
  worksheet['!cols'] = [
    { wch: 14 }, 
    { wch: 12 }, 
    { wch: 8 }, 
    ...sortedColumns.map(() => ({ wch: 26 })) // 이벤트명이 들어가므로 넓이를 26으로 상향 조정
  ]

  const workbook = XLSX.utils.book_new()
  
  // 대표 타이틀 텍스트 설정
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