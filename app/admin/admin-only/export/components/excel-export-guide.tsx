//app\admin\admin-only\export\components\excel-export-guide.tsx
'use client'

export default function ExcelExportGuide() {
  return (
    <div style={{ marginTop: '20px', padding: '14px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', fontSize: '14px', lineHeight: '1.6' }}>
      <strong style={{ color: '#0f172a' }}>📊 엑셀 출력 가이드 (Multi-Event &amp; 통계 추가)</strong> 
      <br />
      선택한 소속의 유저만 필터링되어 출력되며, 출석(초록색)과 지각(노란색)이 반영된 <span style={{ color: '#2563eb', fontWeight: '600' }}>[출석 횟수]</span>가 제공됩니다. 
      <br></br>해외선교 및 장기외출 관리 페이지에세 스케쥴이 등록된 경우 엑셀 가장 하단에 사유가 표기됩니다.
      <div style={{ marginTop: '8px', padding: '8px', background: '#fff', borderRadius: '4px', fontFamily: 'monospace', border: '1px dashed #cbd5e1', overflowX: 'auto', whiteSpace: 'nowrap' }}> 
        [출석번호] | [이름] | [기수] | [출석 횟수] | [2026.06.14 (행사A)] | [2026.06.15 (행사A)] ...
      </div>
    </div>
  )
}