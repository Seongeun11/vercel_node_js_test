import { Suspense } from 'react'
import AdminQrViewClient from './adminQrViewClient'

type PageProps = {
  searchParams: Promise<{
    url?: string
    qrId?: string
    fullscreen?: string
  }>
}

export default async function AdminQrViewPage({ searchParams }: PageProps) {
  const params = await searchParams

  return (
    <Suspense fallback={<div style={{ padding: '20px' }}>로딩중...</div>}>
      <AdminQrViewClient
        qrUrl={params.url ?? ''}
        qrId={params.qrId ?? ''}
        fullscreen={params.fullscreen === '1'}
      />
    </Suspense>
  )
}