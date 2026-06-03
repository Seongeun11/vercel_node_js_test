// app/attendance/scan/page.tsx
import { Suspense } from 'react'
import AttendanceScanClient from './attendance-scanclient'

export default function AttendanceScanPage() {
  return (
    <Suspense fallback={<div>출석 페이지를 불러오는 중입니다...</div>}>
      <AttendanceScanClient />
    </Suspense>
  )
}