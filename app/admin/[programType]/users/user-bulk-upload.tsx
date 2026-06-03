'use client'

import { useRef, useState } from 'react'

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
  const fileRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] =
    useState<BulkCreateResponse | null>(null)

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

      formData.append(
        'file',
        file
      )

      const response = await fetch(
        '/api/admin/users/bulk-create',
        {
          method: 'POST',
          credentials: 'include',
          body: formData,
        }
      )

      const data =
        (await response.json()) as BulkCreateResponse

      if (!response.ok) {
        throw new Error(
          data.error ||
          '엑셀 등록 실패'
        )
      }

      setResult(data)

      // 업로드 성공 시 초기화
      setFile(null)

      if (fileRef.current) {
        fileRef.current.value = ''
      }

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : '업로드 중 오류'
      )

    } finally {

      setLoading(false)

    }
  }

  return (
    <section style={panelStyle}>
      <h3 style={{ marginTop: 0 }}>
        엑셀 사용자 일괄 등록
      </h3>

      <div
        style={{
          display: 'grid',
          gap: 14,
          maxWidth: 850,
        }}
      >
        <div style={guideBoxStyle}>
          <div
            style={{
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            엑셀 형식
          </div>

          <div
            style={{
              color: '#374151',
              fontSize: 14,
            }}
          >
            헤더:
          </div>

          <code style={codeStyle}>
            student_id | full_name |
            password | role |
            cohort_no |
            enrollment_status |
            affiliation
          </code>

          <div style={guideText}>
            role:
            admin | captain | trainee
          </div>

          <div style={guideText}>
            enrollment_status:
            active | completed
          </div>

          <div style={guideText}>
            affiliation:
            아카데미 | 영성 | 모심 |
            효진정 | 성화영성
          </div>

          <div style={guideText}>
            파일 제한:
            최대 100kb / 400명
          </div>

          <div style={guideText}>
            student_id:
            10자리 숫자
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          disabled={loading}
          onChange={(e) => {

            const selected =
              e.target.files?.[0]

            setError('')

            setFile(
              selected ?? null
            )
          }}
        />

        {file && (
          <div style={fileBox}>
            선택 파일:
            {' '}
            {file.name}
            {' '}
            (
            {Math.ceil(
              file.size/1024
            )}
            KB)
          </div>
        )}

        <div
          style={{
            display:'flex',
            gap:8,
          }}
        >
          <button
            type="button"
            onClick={() =>
              void handleUpload()
            }
            disabled={
              loading || !file
            }
            style={{
              ...primaryButtonStyle,

              opacity:
                loading || !file
                  ? .6
                  : 1,

              cursor:
                loading || !file
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {loading
              ? '등록 처리중...'
              : '엑셀 업로드'}
          </button>
        </div>

        {error && (
          <div style={errorBoxStyle}>
            {error}
          </div>
        )}

        {result?.summary && (
          <div style={summaryBoxStyle}>
            총
            {' '}
            {result.summary.total}
            건 /
            성공
            {' '}
            {result.summary.success}
            건 /
            실패
            {' '}
            {result.summary.failed}
            건
          </div>
        )}

        {result?.results &&
          result.results.length > 0 && (

          <div style={tableWrapper}>

            <table
              style={tableStyle}
            >

              <thead>

              <tr>
                <th style={thStyle}>
                  행
                </th>

                <th style={thStyle}>
                  학번
                </th>

                <th style={thStyle}>
                  상태
                </th>

                <th style={thStyle}>
                  메시지
                </th>
              </tr>

              </thead>

              <tbody>

              {result.results.map(
                item => (

                <tr
                  key={`${item.row}-${item.student_id}-${item.message}`}
                >
                  <td style={tdStyle}>
                    {item.row}
                  </td>

                  <td style={tdStyle}>
                    {item.student_id ?? '-'}
                  </td>

                  <td
                    style={{
                      ...tdStyle,

                      color:
                        item.success
                          ? '#166534'
                          : '#dc2626',

                      fontWeight:700
                    }}
                  >
                    {item.success
                      ? '성공'
                      : '실패'}
                  </td>

                  <td style={tdStyle}>
                    {item.message}
                  </td>

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

const panelStyle = {
  border:'1px solid #ddd',
  borderRadius:12,
  padding:16,
  background:'#fff'
}

const guideBoxStyle = {
  padding:12,
  borderRadius:10,
  background:'#f8fafc',
  border:'1px solid #e5e7eb'
}

const guideText = {
  color:'#6b7280',
  fontSize:13,
  marginTop:6
}

const fileBox = {
  padding:10,
  borderRadius:8,
  background:'#f8fafc',
  fontSize:14
}

const codeStyle = {
  display:'block',
  marginTop:8,
  padding:'10px',
  borderRadius:8,
  background:'#eef2ff',
  fontSize:13
}

const primaryButtonStyle = {
  height:40,
  padding:'0 14px',
  borderRadius:8,
  border:'none',
  background:'#111827',
  color:'#fff',
  fontWeight:600
}

const errorBoxStyle = {
  padding:12,
  borderRadius:10,
  background:'#fff1f2',
  border:'1px solid #fecdd3',
  color:'#be123c'
}

const summaryBoxStyle = {
  padding:12,
  borderRadius:10,
  background:'#f0fdf4',
  border:'1px solid #bbf7d0',
  color:'#166534',
  fontWeight:700
}

const tableWrapper = {
  overflow:'auto',
  maxHeight:500,
  border:'1px solid #ddd'
}

const tableStyle = {
  width:'100%',
  borderCollapse:'collapse' as const
}

const thStyle = {
  textAlign:'left' as const,
  padding:'12px',
  background:'#f8fafc',
  borderBottom:'1px solid #ddd'
}

const tdStyle = {
  padding:'12px',
  borderBottom:'1px solid #eee',
  fontSize:14
}