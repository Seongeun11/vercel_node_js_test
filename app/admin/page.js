// app/admin/page.tsx
import Link from 'next/link'
import AdminHeader from '@/components/admin/AdminHeader'

export default async function AdminPage() {
  return (
    <div style={{ padding: '20px' }}>
      <AdminHeader title="관리자 페이지" />

      <div
        style={{
          display: 'flex',
          gap: '10px',
          marginTop: '20px',
          flexWrap: 'wrap',
        }}
      >
        <Link href="/"><button>메인으로</button></Link>
        <Link href="/admin/events"><button>이벤트 관리</button></Link>
        <Link href="/logs"><button>출석 로그 조회</button></Link>
        <Link href="/admin/qr"><button>QR 출석 생성</button></Link>
        <Link href="/admin/attendance"><button>출석 현황</button></Link>
        <Link href="/admin/user"><button>사용자 생성</button></Link>
      </div>
    </div>
  )
}