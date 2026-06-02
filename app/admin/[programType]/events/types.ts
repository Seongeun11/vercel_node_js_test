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
}