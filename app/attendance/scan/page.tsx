import { Suspense } from 'react'
import AttendanceScanClient from './attendanceScanClient'

export default function AttendanceScanPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            padding: '20px',
            maxWidth: '480px',
            margin: '0 auto',
            textAlign: 'center',
          }}
        >
          <h2>QR 출석</h2>
          <p>처리중...</p>
        </main>
      }
    >
      <AttendanceScanClient />
    </Suspense>
  )
}