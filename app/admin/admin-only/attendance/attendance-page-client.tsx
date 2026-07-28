// app/admin/admin-only/attendance/attendance-page-client.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AdminHeader from '@/components/admin/AdminHeader'

import AttendanceFilterBar from './attendance-filterbar'
import AttendanceTable from './attendance-table'
import AttendanceEditModal from './attendance-edit-modal'
import AttendanceAddForm from './attendance-add-form'

import { AttendanceManageItem, AttendanceStatus } from './types/attendance'

type AttendanceClientProps = {
  initialDate: string
}

export default function AttendanceManageClient({ initialDate }: AttendanceClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentDate = searchParams.get('date') || initialDate

  const [attendances, setAttendances] = useState<AttendanceManageItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  
  // 💡 [논리 점검 반영] 일괄 및 필터 관리를 위한 공통 상태 제어
  const [selectedAffiliationId, setSelectedAffiliationId] = useState<string>('')
  const [selectedEventId, setSelectedEventId] = useState<string>('') // 💡 행사 필터용 ID 추가

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [activeItem, setActiveItem] = useState<AttendanceManageItem | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  // 1. 데이터 로드 엔진
  const loadAttendanceData = useCallback(async (dateStr: string) => {
    try {
      setLoading(true)
      setError('')
      
      const params = new URLSearchParams()
      if (dateStr) {
        params.set('date_from', dateStr)
        params.set('date_to', dateStr)
      }

      const res = await fetch(`/api/attendance/manage/list?${params.toString()}`, { 
        method: 'GET', 
        cache: 'no-store',
        credentials: 'include'
      })
      const data = await res.json()
      
      if (res.ok && data.items) {
        setAttendances(data.items)
      } else {
        throw new Error(data.error || '출석 명단을 가져오지 못했습니다.')
      }
    } catch (err: any) {
      setError(err.message || '출석 데이터 서버 연동 중 오류 발생')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAttendanceData(currentDate)
  }, [currentDate, loadAttendanceData])

  // 2. 수동 출석 입력 완료 시 부분 새로고침 핸들러
  const handleAddFormSuccess = useCallback((addedDate: string) => {
    if (currentDate === addedDate) {
      void loadAttendanceData(currentDate)
    } else {
      if (confirm(`성공적으로 저장되었습니다.\n추가된 날짜(${addedDate})의 출석부 화면으로 이동하시겠습니까?`)) {
        router.push(`?date=${addedDate}`)
      }
    }
  }, [currentDate, loadAttendanceData, router])

  // 3. 통합 수정 실행부 (event_id 수용 및 재조회 연동)
  const handleUpdateAttendance = async (
    id: string,
    nextStatus: AttendanceStatus,
    checkTime: string,
    reason: string,
    nextEventId?: string
  ) => {
    setSubmittingId(id)
    try {
      const res = await fetch('/api/attendance/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          attendance_id: id,
          event_id: nextEventId,
          status: nextStatus, 
          check_time: checkTime ? new Date(checkTime).toISOString() : null,
          reason: reason.trim()
        })
      })
      
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || '인증 오류 혹은 수정 권한이 거부되었습니다.')
      }
      
      // 행사가 변경되었을 가능성이 있으므로 목록 재조회 수행
      await loadAttendanceData(currentDate)
    } catch (err: any) {
      alert(err.message || '업데이트에 실패했습니다.')
      throw err
    } finally {
      setSubmittingId(null)
    }
  }

  // 🎯 [논리 점검 핵심] 소속 및 행사 ID로 중첩 필터링 처리
  const filteredAttendances = useMemo(() => {
    return attendances.filter(item => {
      // 소속 필터가 지정되어 있다면 검사
      if (selectedAffiliationId) {
        const tableAffiliationId = item.event?.affiliations_id
        if (!tableAffiliationId || String(tableAffiliationId) !== String(selectedAffiliationId)) {
          return false
        }
      }
      
      // 행사 필터가 지정되어 있다면 검사
      if (selectedEventId) {
        if (!item.event_id || String(item.event_id) !== String(selectedEventId)) {
          return false
        }
      }

      return true
    })
  }, [attendances, selectedAffiliationId, selectedEventId])

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif', color: '#1e293b' }}>
      <AdminHeader title="실시간 출석 상태 대시보드" />

      {/* 상단 필터 바 영역 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', marginBottom: '8px' }}>
        <div style={{ flex: 1 }}>
          <AttendanceFilterBar 
            currentDate={currentDate}
            onDateChange={(d) => router.push(`?date=${d}`)}
            selectedAffiliationId={selectedAffiliationId}
            onAffiliationChange={setSelectedAffiliationId}
            selectedEventId={selectedEventId}
            onEventChange={setSelectedEventId} // 💡 추가 구현된 행사 필터 상태 연동
            totalCount={filteredAttendances.length}
          />
        </div>
      </div>
   
      <AttendanceAddForm onSuccess={handleAddFormSuccess} />
      
      {error && <div style={{ padding: '20px', background: '#fef2f2', color: '#ef4444', borderRadius: '12px', fontWeight: 600, marginBottom: '24px' }}>⚠️ {error}</div>}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '8px' }}>데이터 데이터베이스 동기화 중...</div>
      ) : filteredAttendances.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>지정한 조건에 부합하는 출석 데이터가 존재하지 않습니다.</div>
      ) : (
        <AttendanceTable 
          items={filteredAttendances}
          onOpenEditModal={(item) => {
            setActiveItem(item)
            setIsModalOpen(true)
          }}
        />
      )}

      {/* 렌더링부 바인딩 */}
      <AttendanceEditModal 
        isOpen={isModalOpen}
        item={activeItem}
        onClose={() => {
          setIsModalOpen(false)
          setActiveItem(null)
        }}
        onSave={(id, status, time, reas, evtId) => handleUpdateAttendance(id, status, time, reas, evtId)}
      />
    </div>
  )
}