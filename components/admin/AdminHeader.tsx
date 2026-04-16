// components/admin/AdminHeader.tsx
type Props = {
  title: string
  description?: string
  userLabel?: string
}

export default function AdminHeader({
  title,
  description,
  userLabel,
}: Props) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <h2 style={{ marginBottom: '8px' }}>{title}</h2>

      {userLabel ? (
        <p style={{ margin: 0 }}>{userLabel}</p>
      ) : null}

      {description ? (
        <p style={{ marginTop: '8px', color: '#666' }}>{description}</p>
      ) : null}
    </div>
  )
}