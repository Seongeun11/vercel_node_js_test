//app\admin\admin-only\attendance-today\types.ts
export type ExpireUnit = 'hours' | 'days' | 'unlimited';
export type WeekdayCode = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
export type AttendanceStatus = 'present' | 'late' | 'absent';

export type UserRole = {
  id: number;
  name: 'admin' | 'captain' | 'trainee';
};
export interface AffiliationItem {
  id: number;     // 소속 고유 ID (DB 및 필터링 매핑용)
  name: string;   // 화면에 표시될 소속 명칭 (예: '아카데미', '영성 40일')
}
export type TodayOccurrenceItem = {
  id: string;
  event_id: string;
  occurrence_date: string;
  start_time: string;
  end_time: string | null;
  status: 'scheduled' | 'open' | 'closed' | 'archived';
  created_at: string;
  updated_at: string;
  events: {
    id: string;
    name: string;
    start_time: string;
    late_threshold_min: number;
    allow_duplicate_check: boolean;
    is_special_event: boolean;
    recurrence_type: 'none' | 'daily';
    recurrence_days: WeekdayCode[];
    is_active: boolean;
    affiliations_id?: number | null; // ◀ 이 부분도 함께 확인하여 매핑이 잘 되도록 합니다.
  } | null;
};

export type QrItem = {
  id: string;
  event_id: string;
  occurrence_id: string | null;
  token_preview?: string | null;
  qr_url?: string | null;
  expires_at: string | null;
  used_count: number;
  created_at: string;
  is_expired: boolean;
  occurrence_date?: string | null;
  occurrence_status?: string | null;
};

export type QrCreateResponse = {
  message?: string;
  qr_token?: {
    id: string;
    event_id: string;
    occurrence_id: string | null;
    expires_at: string | null;
    used_count: number;
    created_at: string;
    token_preview?: string | null;
  };
  qr_url?: string;
  error?: string;
};

export type AttendanceSummary = {
  total_checked_count: number;
  present_count: number;
  late_count: number;
  absent_count: number;
};

export type AttendanceItem = {
  id: string;
  user_id: string;
  full_name: string;
  student_id: string;
  profiles: {
    roles: UserRole;
  };
  status: AttendanceStatus;
  method: string | null;
  check_time: string | null;
  attendance_date: string | null;
};

export type AttendanceByOccurrenceResponse = {
  occurrence?: {
    id: string;
    event_id: string;
    occurrence_date: string;
    start_time: string;
    end_time: string | null;
    status: string;
    event: {
      id: string;
      name: string;
      late_threshold_min: number;
      is_special_event: boolean;
      recurrence_type: 'none' | 'daily';
    } | null;
  };
  summary?: AttendanceSummary;
  items?: AttendanceItem[];
  error?: string;
};

export type MissingItem = {
  id: string;
  full_name: string;
  student_id: string;
  profiles: {
    roles: UserRole;
  };
};

export type MissingByOccurrenceResponse = {
  occurrence?: {
    id: string;
    event_id: string;
    occurrence_date: string;
    start_time: string;
    end_time: string | null;
    status: 'scheduled' | 'open' | 'closed' | 'archived';
    event: {
      id: string;
      name: string;
      late_threshold_min: number;
      is_special_event: boolean;
      recurrence_type: 'none' | 'daily';
      is_active: boolean;
    } | null;
  };
  count?: number;
  items?: MissingItem[];
  error?: string;
};