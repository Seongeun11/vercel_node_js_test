// app/admin/admin-only/attendance/attendance-page-client.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AdminHeader from '@/components/admin/AdminHeader'

import AttendanceFilterBar from './attendance-filterbar'
import AttendanceTable from './attendance-table'
import AttendanceEditModal from './attendance-edit-modal'
// 상단에 생성한 컴포넌트 import 유지
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
  const [selectedAffiliationId, setSelectedAffiliationId] = useState<string>('')

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [activeItem, setActiveItem] = useState<AttendanceManageItem | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  // 1. 데이터 로드 엔진 (단일 API 컴포넌트 부분 리프레시 기능 탑재)
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

  // 2. ✨ [신규 논리 추가] 수동 출석 입력 완료 시 부분 새로고침 핸들러
  const handleAddFormSuccess = useCallback((addedDate: string) => {
    // 관리자가 추가한 출석 날짜와 대시보드가 현재 바라보고 있는 필터 날짜가 일치할 때만 리스트 부분 로딩
    if (currentDate === addedDate) {
      void loadAttendanceData(currentDate)
    } else {
      // 다른 날짜에 소급 적용한 경우 필터가 틀어지지 않게 안내 후, 관리자가 원하면 이동할 수 있도록 처리
      if (confirm(`성공적으로 저장되었습니다.\n추가된 날짜(${addedDate})의 출석부 화면으로 이동하시겠습니까?`)) {
        router.push(`?date=${addedDate}`)
      }
    }
  }, [currentDate, loadAttendanceData, router])

  // 3. 통합 수정 실행부 (모달 및 테이블 공용 API 허브)
  const handleUpdateAttendance = async (id: string, nextStatus: AttendanceStatus, checkTime: string, reason: string) => {
    setSubmittingId(id)
    try {
      const res = await fetch('/api/attendance/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          attendance_id: id,
          status: nextStatus, 
          check_time: checkTime ? new Date(checkTime).toISOString() : null,
          reason: reason.trim()
        })
      })
      
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || '인증 오류 혹은 수정 권한이 거부되었습니다.')
      }
      
      // 로컬 상태 부분 업데이트
      setAttendances(prev => prev.map(item => 
        item.id === id 
          ? { 
              ...item, 
              status: nextStatus, 
              check_time: checkTime ? new Date(checkTime).toISOString() : item.check_time, 
              updated_at: new Date().toISOString() 
            } 
          : item
      ))
    } catch (err: any) {
      alert(err.message || '업데이트에 실패했습니다.')
      throw err
    } finally {
      setSubmittingId(null)
    }
  }

  const filteredAttendances = useMemo(() => {
    if (!selectedAffiliationId) return attendances
    return attendances.filter(item => item.event?.affiliations_id && String(item.event.affiliations_id) === selectedAffiliationId)
  }, [attendances, selectedAffiliationId])

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif', color: '#1e293b' }}>
      <AdminHeader title="실시간 출석 상태 대시보드" />

      <AttendanceFilterBar 
        currentDate={currentDate}
        onDateChange={(d) => router.push(`?date=${d}`)}
        selectedAffiliationId={selectedAffiliationId}
        onAffiliationChange={setSelectedAffiliationId}
        totalCount={filteredAttendances.length}
      />
      
      {/* 💡 변경 완료: 단순 갱신이 아닌 추가된 날짜 매핑 기반의 부분 로딩 트리거 적용 */}
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

      <AttendanceEditModal 
        isOpen={isModalOpen}
        item={activeItem}
        onClose={() => {
          setIsModalOpen(false)
          setActiveItem(null)
        }}
        onSave={(id, status, time, reas) => handleUpdateAttendance(id, status, time, reas)}
      />
    </div>
  )
}