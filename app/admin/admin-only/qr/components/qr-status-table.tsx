'use client'

import React from 'react'
import { EventItem, QrTokenItem } from '../types'
import { formatRecurrenceDays } from '../utils'
import { styles } from '../styles'

interface QrStatusTableProps {
  filteredEvents: EventItem[]
  activeQrTokens: Record<string, QrTokenItem>
  editingId: string | null
  onPreGenerate: (eventId: string, startTimeIso: string) => void
  onDeleteQr: (qrId: string, eventId: string) => void
  onOpenZoom: (eventName: string, qrUrl: string | null) => void
}

export default function QrStatusTable({
  filteredEvents,
  activeQrTokens,
  editingId,
  onPreGenerate,
  onDeleteQr,
  onOpenZoom
}: QrStatusTableProps) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={styles.tableStyle}>
        <thead>
          <tr>
            <th style={styles.thStyle}>행사 이름</th>
            <th style={styles.thStyle}>소속</th>
            <th style={styles.thStyle}>행사 시작 시각</th>
            <th style={styles.thStyle}>상태</th>
            <th style={styles.thStyle}>주기</th>
            <th style={styles.thStyle}>예약 QR 정보</th>
            <th style={styles.thStyle}>수정 및 관리</th>
          </tr>
        </thead>
        <tbody>
          {filteredEvents.map((event) => {
            const isFuture = new Date(event.start_time) > new Date()
            const attachedToken = activeQrTokens[event.id]

            return (
              <tr key={event.id} style={{ background: editingId === event.id ? '#f0f9ff' : 'transparent' }}>
                <td style={{ ...styles.tdStyle, fontWeight: 700 }}>{event.name}</td>
                <td style={{ ...styles.tdStyle, color: '#2563eb', fontWeight: 500 }}>
                  {event.affiliation_name}
                </td>
                <td style={styles.tdStyle}>{new Date(event.start_time).toLocaleString()}</td>
                <td style={styles.tdStyle}>
                  {isFuture ? (
                    <span style={styles.badgeScheduled}>예약 대기 (Scheduled)</span>
                  ) : (
                    <span style={styles.badgeOpen}>활성화 진행 (Open)</span>
                  )}
                </td>
                <td style={styles.tdStyle}>{formatRecurrenceDays(event.recurrence_days)}</td>
                <td style={styles.tdStyle}>
                  {attachedToken ? (
                    <div style={styles.qrPreviewBox}>
                      <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold', marginBottom: '2px' }}>
                        QR 연동됨 ({attachedToken.token_preview})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <button
                          onClick={() => onOpenZoom(event.name, attachedToken.qr_url)}
                          style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '4px' }}
                        >
                          🔍 QR 코드 크게보기
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>발행 내역 없음</div>
                      <button 
                        onClick={() => onPreGenerate(event.id, event.start_time)} 
                        style={{ padding: '4px 8px', fontSize: '11px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        qr 예약 하기
                      </button>
                    </div>
                  )}
                </td>
                <td style={styles.tdStyle}>
                  {attachedToken ? (
                    <button 
                      onClick={() => onDeleteQr(attachedToken.id, event.id)} 
                      style={styles.dangerButtonStyle}
                    >
                      QR 삭제
                    </button>
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>삭제 대상 없음</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}