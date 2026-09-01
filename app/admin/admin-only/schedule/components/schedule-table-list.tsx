'use client'

import React, { useState } from 'react'
import { ScheduleItem, AbsenceType } from '../page'

type Props = {
  schedules: ScheduleItem[]
  absenceTypes: AbsenceType[]
  loading: boolean
  startDate: string
  endDate: string
  onDateChange: (start: string, end: string) => void
  onRefresh: () => void
  onEdit: (item: ScheduleItem) => void
  onDelete: (id: number) => void
}

export default function ScheduleTableList({
  schedules,
  absenceTypes,
  loading,
  startDate,
  endDate,
  onDateChange,
  onRefresh,
  onEdit,
  onDelete,
}: Props) {
  const [selectedType, setSelectedType] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'active' | 'ended' | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredSchedules = schedules.filter((item) => {
    if (statusFilter === 'active' && item.is_ended) return false
    if (statusFilter === 'ended' && !item.is_ended) return false

    if (selectedType !== 'all' && String(item.absence_type) !== selectedType) {
      return false
    }

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
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* 날짜 필터 (기본 일주일) */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>조회기간:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onDateChange(e.target.value, endDate)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
            />
            ~
            <input
              type="date"
              value={endDate}
              onChange={(e) => onDateChange(startDate, e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
            />
          </div>

          <input
            type="text"
            placeholder="이름 또는 학번 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'active' | 'ended' | 'all')}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600 }}
          >
            <option value="all">전체 상태</option>
            <option value="active">진행 중</option>
            <option value="ended">종료됨</option>
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          >
            <option value="all">전체 외출 유형</option>
            {absenceTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.text}</option>
            ))}
          </select>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontSize: '13px' }}
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
              <th style={{ padding: '12px', textAlign: 'center' }}>관리</th>
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
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button
                        onClick={() => onEdit(item)}
                        style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                      >
                        수정
                      </button>
                      <button
                        onClick={() => onDelete(Number(item.id))}
                        style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: 'none', background: '#fee2e2', color: '#b91c1c', cursor: 'pointer' }}
                      >
                        삭제
                      </button>
                    </div>
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