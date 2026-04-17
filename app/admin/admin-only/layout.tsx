// app/admin/(admin-only)/layout.tsx
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

type Props = {
  children: ReactNode
}

export default async function AdminOnlyLayout({ children }: Props) {
  const authResult = await requireRole(['admin'])

 if (!authResult.ok) {
    if (authResult.status === 401) redirect('/login')
    if (authResult.status === 403) redirect('/forbidden')
    redirect('/')
  }

  return <>{children}</>
}