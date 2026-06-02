// app/admin/admin-only/event/utils.ts

import { WeekdayCode } from './types'

export const WEEKDAY_ORDER: Record<
  WeekdayCode,
  number
> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

export function toDateTimeLocalValue(
  isoString: string
): string {
  const date = new Date(isoString)

  // 원본 timezone 처리 개선 버전
  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return ''
  }

  const pad = (v: number) =>
    String(v).padStart(2, '0')

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(
    date.getDate()
  )}T${pad(
    date.getHours()
  )}:${pad(
    date.getMinutes()
  )}`
}

export function normalizeRecurrenceDays(
  days:
    | WeekdayCode[]
    | null
    | undefined
): WeekdayCode[] {
  if (!Array.isArray(days)) {
    return []
  }

  const validDays = days.filter(
    (
      d
    ): d is WeekdayCode =>
      typeof d ===
        'string' &&
      d in WEEKDAY_ORDER
  )

  return Array.from(
    new Set(validDays)
  ).sort(
    (a, b) =>
      WEEKDAY_ORDER[a] -
      WEEKDAY_ORDER[b]
  )
}

export function formatRecurrenceDays(
  days:
    | WeekdayCode[]
    | null
    | undefined
): string {
  const normalizedDays =
    normalizeRecurrenceDays(
      days
    )

  if (
    normalizedDays.length === 0
  ) {
    return '반복 없음'
  }

  const labelMap: Record<
    WeekdayCode,
    string
  > = {
    sun: '일',
    mon: '월',
    tue: '화',
    wed: '수',
    thu: '목',
    fri: '금',
    sat: '토',
  }

  return normalizedDays
    .map(
      (day) => labelMap[day]
    )
    .join(', ')
}