// app/admin/admin-only/schedule/components/schedule-table-list.tsx
'use client'

import React, { useState } from 'react'
import { ScheduleItem, AbsenceType } from '../page'

type Props = {
  schedules: ScheduleItem[]
  setSchedules: React.Dispatch<React.SetStateAction<ScheduleItem[]>>
  absenceTypes: AbsenceType[]
  loading: boolean
  onRefresh: () => void
}

export default function ScheduleTableList({
  schedules,
  absenceTypes,
  loading,
  onRefresh,
}: Props) {
  const [selectedType, setSelectedType] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'active' | 'ended' | 'all'>('active') // 기본값: 진행 중
  const [searchTerm, setSearchTerm] = useState('')

  const filteredSchedules = schedules.filter((item) => {
    // 1. 진행중 / 종료됨 필터링
    if (statusFilter === 'active' && item.is_ended) return false
    if (statusFilter === 'ended' && !item.is_ended) return false

    // 2. 외출 유형 필터링
    if (selectedType !== 'all' && String(item.absence_type) !== selectedType) {
      return false
    }

    // 3. 이름/학번 검색 필터링
    if (searchTerm) {
      const name = item.profiles?.full_name || ''
      const studentId = item.profiles?.student_id || ''
      return name.includes(searchTerm) || studentId.includes(searchTerm)
    }

    return true
  })

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff', padding: '20px' }}>
      {/* 필터 및 컨트롤 바 */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          {/* 이름 / 학번 검색 */}
          <input
            type="text"
            placeholder="이름 또는 학번 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
          />

          {/* 스케쥴 상태 필터 (진행 중 / 종료됨) */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'active' | 'ended' | 'all')}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}
          >
            <option value="active">진행 중</option>
            <option value="ended">종료됨</option>
            <option value="all">전체 상태</option>
          </select>

          {/* 외출 유형 필터 */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
          >
            <option value="all">전체 결석 유형</option>
            {absenceTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.text}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
        >
          {loading ? '불러오는 중...' : '새로고침'}
        </button>
      </div>

      {/* 테이블 */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>학번</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>이름</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>소속</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>외출 유형</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>기간 (시작일 ~ 종료일)</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>상태</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>사유</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>등록일시</th>
            </tr>
          </thead>
          <tbody>
            {filteredSchedules.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                  조건에 맞는 스케쥴 내역이 없습니다.
                </td>
              </tr>
            ) : (
              filteredSchedules.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                  <td style={{ padding: '12px' }}>{item.profiles?.student_id || '-'}</td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{item.profiles?.full_name || '-'}</td>
                  <td style={{ padding: '12px' }}>{item.profiles?.affiliation?.name || '-'}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                      {item.absence_type_info?.text || `유형 ${item.absence_type}`}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px' }}>
                    {item.start_date || '-'} ~ {item.end_date || '-'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {item.is_ended ? (
                      <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#fc7b7b', fontSize: '12px' }}>
                        종료됨
                      </span>
                    ) : (
                      <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontSize: '12px', fontWeight: 600 }}>
                        진행 중
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px', color: '#475569' }}>{item.absence_reason || '-'}</td>
                  <td style={{ padding: '12px', color: '#94a3b8', fontSize: '13px' }}>
                    {new Date(item.created_at).toLocaleString('ko-KR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}