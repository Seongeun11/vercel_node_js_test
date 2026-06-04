//app\admin\admin-only\events\types.ts
export type RecurrenceType = 'none' | 'daily'

export type WeekdayCode =
  | 'sun'
  | 'mon'
  | 'tue'
  | 'wed'
  | 'thu'
  | 'fri'
  | 'sat'


export interface AffiliationItem {
  id: number
  name: string
}
export interface EventItem {
  id: string
  name: string
  start_time: string
  late_threshold_min: number
  allow_duplicate_check: boolean
  is_special_event: boolean
  recurrence_type: RecurrenceType
  recurrence_days: WeekdayCode[]
  is_active: boolean
  affiliations_id: number | string | null
}

export interface EventFormState {
  name: string
  start_time: string
  late_threshold_min: string
  allow_duplicate_check: boolean
  is_special_event: boolean
  recurrence_type: RecurrenceType
  recurrence_days: WeekdayCode[]
  is_active: boolean
  affiliations_id: string // select 요소 바인딩을 위해 string으로 관리 (공백은 null 의미)
}