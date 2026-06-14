//app\admin\admin-only\export\components\excel-export-guide.tsx
'use client'

export default function ExcelExportGuide() {
  return (
    <div style={{ marginTop: '20px', padding: '14px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', fontSize: '14px', lineHeight: '1.6' }}>
      <strong style={{ color: '#0f172a' }}>📊 엑셀 출력 가이드 (Multi-Event &amp; 통계 추가)</strong> 
      <br />
      선택한 소속의 교육생만 필터링되어 출력되며, 기수 우측에 <span style={{ color: '#2563eb', fontWeight: '600' }}>[평균 출석률]</span> 컬럼이 새롭게 배치됩니다.
      <div style={{ marginTop: '8px', padding: '8px', background: '#fff', borderRadius: '4px', fontFamily: 'monospace', border: '1px dashed #cbd5e1', overflowX: 'auto', whiteSpace: 'nowrap' }}> 
        [출석번호] | [이름]  | [기수]| [평균 출석률] | [2026.06.14 (행사A)] | [2026.06.15 (행사A)] ...
      </div>
    </div>
  )
}