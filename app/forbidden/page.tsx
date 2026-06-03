// app/forbidden/page.tsx
import Link from 'next/link'

export default function ForbiddenPage() {
  return (
    <main style={{ maxWidth: 720, margin: '80px auto', padding: '24px' }}>
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '16px',
          padding: '24px',
          background: '#fff',
        }}
      >
        <h1 style={{ marginTop: 0 }}>권한이 없습니다</h1>
        <p style={{ lineHeight: 1.6, color: '#4b5563' }}>
          이 페이지는 관리자만 접근할 수 있습니다.
        </p>

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <Link href="/">메인으로 이동</Link>
        </div>
      </div>
    </main>
  )
}