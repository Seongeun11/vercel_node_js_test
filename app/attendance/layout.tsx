// app/attendance/layout.tsx
import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/serverAuth'

type Props = {
  children: ReactNode
}

export default async function AttendanceLayout({ children }: Props) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return <>{children}</>
}