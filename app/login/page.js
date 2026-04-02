import { Suspense } from 'react'
import LoginClient from './loginClient'

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 20 }}>
          <h2>출석 로그인</h2>
          <p>로딩 중...</p>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  )
}