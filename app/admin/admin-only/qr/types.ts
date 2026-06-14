export type WeekdayCode = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
export type RecurrenceType = 'none' | 'daily';
export type OccurrenceStatus = 'scheduled' | 'open' | 'closed' | 'archived';

export interface AffiliationItem {
  id: number;
  name: string;
}

export interface QrTokenItem {
  id: string;
  event_id: string;
  occurrence_id: string | null;
  expires_at: string;
  used_count: number;
  created_at: string;
  qr_url: string | null;
  token_preview: string;
}

export interface EventItem {
  id: string;
  name: string;
  start_time: string;
  late_threshold_min: number;
  allow_duplicate_check: boolean;
  is_special_event: boolean;
  recurrence_type: RecurrenceType;
  recurrence_days: WeekdayCode[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  affiliations_id: string | number | null;
  affiliation_name: string;
}

export interface EventFormState {
  name: string;
  start_time: string;
  late_threshold_min: string | number;
  allow_duplicate_check: boolean;
  is_special_event: boolean;
  recurrence_type: RecurrenceType;
  recurrence_days: WeekdayCode[];
  is_active: boolean;
  affiliations_id: string | number | null;
  pre_generate_qr: boolean;
  qr_valid_duration_min: string | number;
}

export const WEEKDAY_OPTIONS: { label: string; value: WeekdayCode }[] = [
  { label: '일', value: 'sun' },
  { label: '월', value: 'mon' },
  { label: '화', value: 'tue' },
  { label: '수', value: 'wed' },
  { label: '목', value: 'thu' },
  { label: '금', value: 'fri' },
  { label: '토', value: 'sat' },
];

export const WEEKDAY_ORDER: Record<WeekdayCode, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
};