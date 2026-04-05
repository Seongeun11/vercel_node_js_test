// app/logs/layout.tsx
import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/serverAuth'

type Props = {
  children: ReactNode
}

export default async function LogsLayout({ children }: Props) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!['admin', 'captain'].includes(user.role)) {
    redirect('/')
  }

  return <>{children}</>
}