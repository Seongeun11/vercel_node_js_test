import { WeekdayCode, WEEKDAY_OPTIONS, WEEKDAY_ORDER } from './types';

export function toDateTimeLocalValue(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function normalizeRecurrenceDays(days: WeekdayCode[] | null | undefined): WeekdayCode[] {
  if (!Array.isArray(days)) return [];
  const validDays = days.filter((d): d is WeekdayCode => typeof d === 'string' && d in WEEKDAY_ORDER);
  return Array.from(new Set(validDays)).sort((a, b) => WEEKDAY_ORDER[a] - WEEKDAY_ORDER[b]);
}

export function formatRecurrenceDays(days: WeekdayCode[]): string {
  if (!days || days.length === 0) return '단발성 행사';
  if (days.length === 7) return '매일 반복';
  return days.map(d => WEEKDAY_OPTIONS.find(o => o.value === d)?.label ?? '').join(', ');
}