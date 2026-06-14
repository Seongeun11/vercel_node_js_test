//app\admin\admin-only\export\page.tsx
'use client'

import AdminHeader from '@/components/admin/AdminHeader'
import AffiliationSelect from '@/components/common/affiliation-select'
import { useAttendanceExport } from './hooks/use-attendance-export'
import EventMultiSelect from './components/event-multi-select'
import DateRangeForm from './components/date-range-form'
import ExcelExportGuide from './components/excel-export-guide'

export default function AttendanceExportPage() {
  // 커스텀 훅으로부터 구조분해 할당하여 기존 핵심 도메인 로직 및 상태 수동 동기화
  const {
    events,
    eventIds,
    selectedAffiliationId,
    dateFrom,
    dateTo,
    pageLoading,
    eventsLoading,
    errorMessage,
    downloading,
    setDateFrom,
    setDateTo,
    handleAffiliationChange,
    handleSelectChange,
    handleDownloadExcel,
  } = useAttendanceExport()

  // 훅 내부에서 '1'(아카데미) 초기화 및 패치가 종료될 때까지 화면 깜빡임과 데이터 뒤섞임을 제어합니다.
  if (pageLoading) {
    return <div style={{ padding: '24px' }}>로딩중...</div> 
  }

  return (
    <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto' }}>
      <AdminHeader
        title="출석현황 엑셀 다운로드"
        description="복수의 행사와 날짜 범위를 선택해 통합 출석현황을 엑셀 파일로 다운로드합니다."
      />

      <div
        style={{
          border: '1px solid #ddd', 
          borderRadius: '12px',
          background: '#fff',
          padding: '20px',
        }}
      >
        <div style={{ display: 'grid', gap: '16px' }}>
          
          {/* 소속 필터 UI 컴포넌트 배치 */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
              소속 필터 
            </label>
            <AffiliationSelect
              value={selectedAffiliationId}
              onChange={handleAffiliationChange}
              showAllOption={true}
              allOptionLabel="전체 보기 (소속 전체)"
            />
          </div>

          {/* 분리된 하위 컴포넌트들 배치 및 데이터 전송 */}
          <EventMultiSelect
            events={events}
            eventIds={eventIds}
            eventsLoading={eventsLoading}
            onSelectChange={handleSelectChange}
          />

          <DateRangeForm
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
          />

          {/* 엑셀 파일 생성 버튼 */}
          <button 
            type="button" 
            onClick={handleDownloadExcel}
            disabled={downloading}
            style={{
              padding: '12px',
              background: downloading ? '#94a3b8' : '#2563eb', 
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: downloading ? 'not-allowed' : 'pointer', 
              fontWeight: 'bold'
            }}
          >
            {downloading ? '엑셀 파일 생성 중...' : '통합 엑셀 다운로드'} 
          </button>
        </div>

        {/* 에러 메시지 가이드 */}
        {errorMessage && (
          <p style={{ color: '#dc2626', marginTop: '16px', fontWeight: '500' }}>
            {errorMessage}
          </p>
        )}

        {/* 엑셀 포맷 도움말 가이드 안내 컴포넌트 */}
        <ExcelExportGuide />
      </div>
    </div>
  )
}