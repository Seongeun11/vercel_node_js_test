//app\admin\admin-only\points\components\google-sheet-sync.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSheetSync } from '../hooks/use-sheet-sync'

interface Props {
  onSuccess?: () => void
}

export default function GoogleSheetSync({ onSuccess }: Props) {
  const {
    sheetUrl,
    setSheetUrl,
    loading,
    resultMessage,
    errorDetails,
    syncSheet,
    saveSheetUrl,
    savingUrl
  } = useSheetSync(onSuccess)

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
        <input
          type="url"
          placeholder="구글 스프레드시트 링크 입력 (웹에 게시 또는 링크 공유 권한 필요)"
          value={sheetUrl}
          onChange={(e) => setSheetUrl(e.target.value)}
          style={inputStyle}
          disabled={loading}
        />
        <button onClick={saveSheetUrl} disabled={savingUrl || loading} style={saveButtonStyle}>
          {savingUrl ? '저장 중...' : '링크 저장'}
        </button>
        <button onClick={() => syncSheet()} disabled={loading} style={syncButtonStyle}>
          {loading ? '동기화 진행 중...' : '즉시 동기화'}
        </button>
      </div>
      <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
        * '링크 저장'을 누르면 매일 새벽 1시에 자동 동기화될 주소로 Supabase에 등록됩니다.
      </p>

      {resultMessage && <p style={{ color: '#16a34a', marginTop: '8px', fontSize: '14px' }}>✓ {resultMessage}</p>}

      {errorDetails.length > 0 && (
        <div style={errorContainerStyle}>
          <p style={{ fontWeight: 600, color: '#dc2626', marginBottom: '4px' }}>실패 내역:</p>
          <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '12px', color: '#b91c1c' }}>
            {errorDetails.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  background: '#f8fafc',
  padding: '16px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  marginBottom: '20px',
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  fontSize: '14px',
}

const saveButtonStyle: React.CSSProperties = {
  padding: '8px 14px',
  background: '#2563eb',
  color: '#ffffff',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 600,
  fontSize: '14px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const syncButtonStyle: React.CSSProperties = {
  padding: '8px 14px',
  background: '#16a34a',
  color: '#ffffff',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 600,
  fontSize: '14px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const errorContainerStyle: React.CSSProperties = {
  marginTop: '10px',
  padding: '10px',
  background: '#fef2f2',
  borderRadius: '6px',
  maxHeight: '120px',
  overflowY: 'auto',
}