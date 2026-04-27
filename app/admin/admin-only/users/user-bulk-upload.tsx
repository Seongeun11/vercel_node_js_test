'use client'

import { useState } from 'react'

type BulkCreateResponse = {
  ok?: boolean
  summary?: {
    total: number
    success: number
    failed: number
  }
  results?: {
    row: number
    student_id?: string
    success: boolean
    message: string
  }[]
  error?: string
}

export default function UserBulkUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BulkCreateResponse | null>(null)

  async function handleUpload() {
    if (!file) {
      setError('엑셀 파일을 선택해주세요.')
      return
    }

    try {
      setLoading(true)
      setError('')
      setResult(null)

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/admin/users/bulk-create', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const data = (await response.json()) as BulkCreateResponse

      if (!response.ok) {
        throw new Error(data.error || '엑셀 일괄 등록에 실패했습니다.')
      }

      setResult(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '업로드 중 오류가 발생했습니다.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section style={panelStyle}>
      <h3 style={{ marginTop: 0 }}>엑셀 일괄 등록</h3>

      <div style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
        <div style={guideBoxStyle}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>엑셀 형식 안내</div>
          <div style={{ color: '#374151', fontSize: 14 }}>
            헤더 순서:
            <code style={codeStyle}>
              student_id | full_name | password | role | cohort_no | enrollment_status
            </code>
          </div>
          <div style={{ color: '#6b7280', fontSize: 13, marginTop: 6 }}>
            role 값은 admin, captain, trainee 중 하나여야 합니다.+
          </div>
        </div>

        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={loading}
            style={primaryButtonStyle}
          >
            {loading ? '처리중...' : '엑셀 업로드 및 등록'}
          </button>
        </div>

        {error && <div style={errorBoxStyle}>{error}</div>}

        {result?.summary && (
          <div style={summaryBoxStyle}>
            총 {result.summary.total}건 / 성공 {result.summary.success}건 / 실패{' '}
            {result.summary.failed}건
          </div>
        )}

        {result?.results && result.results.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>행</th>
                  <th style={thStyle}>학번</th>
                  <th style={thStyle}>결과</th>
                  <th style={thStyle}>메시지</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((item) => (
                  <tr key={`${item.row}-${item.student_id}`}>
                    <td style={tdStyle}>{item.row}</td>
                    <td style={tdStyle}>{item.student_id ?? '-'}</td>
                    <td style={tdStyle}>{item.success ? '성공' : '실패'}</td>
                    <td style={tdStyle}>{item.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

const panelStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
}

const guideBoxStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: '#f8fafc',
  border: '1px solid #e5e7eb',
}

const codeStyle: React.CSSProperties = {
  marginLeft: 6,
  padding: '2px 6px',
  borderRadius: 6,
  background: '#eef2ff',
  fontSize: 13,
}

const primaryButtonStyle: React.CSSProperties = {
  height: 40,
  padding: '0 14px',
  borderRadius: 8,
  border: 'none',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
}

const errorBoxStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: '#fff1f2',
  border: '1px solid #fecdd3',
  color: '#be123c',
}

const summaryBoxStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: '#f0fdf4',
  border: '1px solid #bbf7d0',
  color: '#166534',
  fontWeight: 600,
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#fff',
  border: '1px solid #ddd',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 14px',
  borderBottom: '1px solid #ddd',
  fontSize: 14,
  background: '#f8fafc',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderBottom: '1px solid #eee',
  fontSize: 14,
  verticalAlign: 'top',
}