// types/attendance.ts

// 1. 출석 상태 및 인식 수단 리터럴 타입
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'unmarked';
export type AttendanceMethod = 'manual' | 'qr' | 'nfc'

// 2. 단일 출석 레코드에 대한 데이터 타입 명세 (JOIN 구조 포함)
export interface AttendanceManageItem {
  id: string
  user_id: string
  event_id: string
  attendance_date: string
  status: AttendanceStatus
  method: AttendanceMethod
  check_time: string
  created_at: string
  updated_at: string
  
  // 백엔드 데이터베이스 서브쿼리로 조인되어 전달되는 객체 스펙
  event: {
    id: string
    name: string
    start_time: string
    late_threshold_min: number
    affiliations_id?: string | number | null // 소속 필터링용 외래키 ID
    affiliation_name?: string                // 소속 필터링용 가공 명칭
  } | null
  
  user: {
    id: string
    student_id: string
    full_name: string
    role?: string
  } | null
}

// 3. API 통신용 리스폰스 타입 규격
export interface AttendanceManageListResponse {
  items?: AttendanceManageItem[]
  error?: string
}

export interface EditAttendanceResponse {
  message?: string
  item?: AttendanceManageItem
  error?: string
}