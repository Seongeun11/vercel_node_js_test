// app/attendance/layout.tsx
import { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

// QR 스캔 페이지는 비로그인 접근이 가능해야 하므로
// attendance 전체 layout에서 인증을 강제하지 않는다.
// 인증이 필요한 하위 페이지는 각 page.tsx에서 개별 처리한다.
export default function AttendanceLayout({ children }: Props) {
  return <>{children}</>
}