// app/components/admin/AdminHeader.tsx
import { getCurrentUser } from '@/lib/serverAuth'

type Props = {
  title: string
  description?: string
}

export default async function AdminHeader({ title, description }: Props) {
  const user = await getCurrentUser()

  if (!user) return null

  return (
    <div style={{ marginBottom: '20px' }}>
      <h2 style={{ marginBottom: '8px' }}>{title}</h2>
      <p style={{ margin: 0 }}>
        관리자: {user.full_name} ({user.student_id})
      </p>
      {description ? (
        <p style={{ marginTop: '8px', color: '#666' }}>{description}</p>
      ) : null}
    </div>
  )
}