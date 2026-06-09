'use client'

import React from 'react'
import { EventItem, AffiliationItem } from '../types'
import {
  tableStyle,
  thStyle,
  tdStyle,
  emptyBoxStyle,
  secondaryButtonStyle,
  dangerButtonStyle,
} from '../styles'
import { formatRecurrenceDays } from '../utils'

interface Props {
  events: EventItem[]
  affiliations: AffiliationItem[]
  submitting: boolean
  onEdit: (event: EventItem) => void
  onDelete: (id: string) => Promise<void>
}

function EventList({
  events,
  affiliations,
  submitting,
  onEdit,
  onDelete,
}: Props) {
  if (events.length === 0) {
    return <div style={emptyBoxStyle}>등록된 행사가 없습니다.</div>
  }

  // ID 매핑용 Map 브릿지 오브젝트 생성
  const affiliationMap = React.useMemo(() => {
    return new Map(affiliations.map(a => [Number(a.id), a.name]))
  }, [affiliations])

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={thStyle}>이름</th>
            <th style={thStyle}>소속</th>
            <th style={thStyle}>기본 시작 시간</th>
            <th style={thStyle}>반복 규칙</th>
            <th style={thStyle}>지각 기준</th>
            <th style={thStyle}>아카데미 포인트 지급</th>
            <th style={thStyle}>중복 허용</th>
            <th style={thStyle}>활성화</th>
            <th style={thStyle}>관리</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            // [방어 코드]: 변수 타입 불일치 방지를 위해 Number 캐스팅 매핑 조회 처리
            const hasAffiliation = event.affiliations_id !== null && event.affiliations_id !== ''
            const matchedName = hasAffiliation
              ? affiliationMap.get(Number(event.affiliations_id))
              : '전체'

            return (
              <tr key={event.id}>
                <td style={tdStyle}>{event.name}</td>
                <td style={{ ...tdStyle, fontWeight: 500, color: '#2563eb' }}>
                  {matchedName ?? '소속 없음'}
                </td>
                <td style={tdStyle}>
                  {event.start_time ? new Date(event.start_time).toLocaleString() : '-'}
                </td>
                <td style={tdStyle}>
                  {formatRecurrenceDays(event.recurrence_days)}
                </td>
                <td style={tdStyle}>{event.late_threshold_min}분</td>
                <td style={tdStyle}>
                  {event.is_special_event ? '예' : '아니오'}
                </td>
                <td style={tdStyle}>
                  {event.allow_duplicate_check ? '허용' : '불가'}
                </td>
                <td style={tdStyle}>
                  {event.is_active ? '활성' : '비활성'}
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => onEdit(event)}
                      disabled={submitting}
                      style={secondaryButtonStyle}
                    >
                      수정
                    </button>
                    <button
                      onClick={() => void onDelete(event.id)}
                      disabled={submitting}
                      style={dangerButtonStyle}
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default React.memo(EventList)