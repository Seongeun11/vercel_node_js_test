// app/admin/admin-only/events/constants.ts

import { WeekdayCode } from './types'

export const WEEKDAY_OPTIONS: {
  label: string
  value: WeekdayCode
}[] = [
  { label: '일', value: 'sun' },
  { label: '월', value: 'mon' },
  { label: '화', value: 'tue' },
  { label: '수', value: 'wed' },
  { label: '목', value: 'thu' },
  { label: '금', value: 'fri' },
  { label: '토', value: 'sat' },
]