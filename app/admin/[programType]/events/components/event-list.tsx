'use client'

import React from 'react'

import {
  EventItem,
} from '../types'

import {
  tableStyle,
  thStyle,
  tdStyle,
  emptyBoxStyle,
  secondaryButtonStyle,
  dangerButtonStyle,
} from '../styles'

import {
  formatRecurrenceDays,
} from '../utils'

interface Props {
  event: EventItem[]

  submitting: boolean

  onEdit: (
    event: EventItem
  ) => void

  onDelete: (
    id: string
  ) => Promise<void>
}

function EventList({
  event,
  submitting,
  onEdit,
  onDelete,
}: Props) {
  if (event.length === 0) {
    return (
      <div style={emptyBoxStyle}>
        등록된 행사가 없습니다.
      </div>
    )
  }

  return (
    <div
      style={{
        overflowX: 'auto',
      }}
    >
      <table style={tableStyle}>
        <thead>
          <tr
            style={{
              background:
                '#f8fafc',
            }}
          >
            <th style={thStyle}>
              이름
            </th>

            <th style={thStyle}>
              기본 시작 시간
            </th>

            <th style={thStyle}>
              반복 규칙
            </th>

            <th style={thStyle}>
              지각 기준
            </th>

            <th style={thStyle}>
              특별 행사
            </th>

            <th style={thStyle}>
              중복 허용
            </th>

            <th style={thStyle}>
              활성화
            </th>

            <th style={thStyle}>
              관리
            </th>
          </tr>
        </thead>

        <tbody>
          {event.map(
            (event) => (
              <tr
                key={event.id}
              >
                <td style={tdStyle}>
                  {event.name}
                </td>

                <td style={tdStyle}>
                  {new Date(
                    event.start_time
                  ).toLocaleString()}
                </td>

                <td style={tdStyle}>
                  {formatRecurrenceDays(
                    event.recurrence_days
                  )}
                </td>

                <td style={tdStyle}>
                  {
                    event.late_threshold_min
                  }
                  분
                </td>

                <td style={tdStyle}>
                  {event.is_special_event
                    ? '예'
                    : '아니오'}
                </td>

                <td style={tdStyle}>
                  {event.allow_duplicate_check
                    ? '허용'
                    : '불가'}
                </td>

                <td style={tdStyle}>
                  {event.is_active
                    ? '활성'
                    : '비활성'}
                </td>

                <td style={tdStyle}>
                  <div
                    style={{
                      display:
                        'flex',
                      gap: 8,
                      flexWrap:
                        'wrap',
                    }}
                  >
                    <button
                      onClick={() =>
                        onEdit(
                          event
                        )
                      }
                      disabled={
                        submitting
                      }
                      style={
                        secondaryButtonStyle
                      }
                    >
                      수정
                    </button>

                    <button
                      onClick={() =>
                        void onDelete(
                          event.id
                        )
                      }
                      disabled={
                        submitting
                      }
                      style={
                        dangerButtonStyle
                      }
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  )
}

export default React.memo(
  EventList
)