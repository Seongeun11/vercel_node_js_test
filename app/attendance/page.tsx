// app/attendance/page.tsx
import { redirect } from 'next/navigation'

export default function AttendancePage() {
  // 현재 구조상 실제 출석 진입점은 scan 이므로 임시 리다이렉트
  redirect('/attendance/scan')
}