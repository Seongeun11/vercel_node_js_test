//app\admin\[programType]\attendance-today\occurrence-card.tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { 
  TodayOccurrenceItem, QrItem, AttendanceSummary, AttendanceItem, MissingItem, 
  ExpireUnit, QrCreateResponse, AttendanceByOccurrenceResponse, MissingByOccurrenceResponse 
} from './types';
import { AttendanceDetailTable, MissingDetailTable } from './attendance-tables';

interface OccurrenceCardProps {
  item: TodayOccurrenceItem;
  onQrCountChange: (id: string, total: number, active: number) => void;
}

export function OccurrenceCard({ item, onQrCountChange }: OccurrenceCardProps) {
  const [qrs, setQrs] = useState<QrItem[]>([]);
  const [attendance, setAttendance] = useState<{ summary: AttendanceSummary; items: AttendanceItem[] }>({
    summary: { total_checked_count: 0, present_count: 0, late_count: 0, absent_count: 0 },
    items: []
  });
  const [missing, setMissing] = useState<{ count: number; items: MissingItem[] }>({ count: 0, items: [] });

  // 로컬 알림 상태 격리 (독립 운영 보장)
  const [cardError, setCardError] = useState('');
  const [cardSuccess, setCardSuccess] = useState('');

  const [expanded, setExpanded] = useState(false);
  const [expandedMissing, setExpandedMissing] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [missingLoading, setMissingLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [expireUnit, setExpireUnit] = useState<ExpireUnit>('unlimited');
  const [expireValue, setExpireValue] = useState('0');

  const fetchQr = useCallback(async () => {
    try {
      const res = await fetch('/api/qr/list', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occurrence_id: item.id }),
      });
      const data = await res.json();
      if (res.ok) {
        const tokens = Array.isArray(data.qr_tokens) ? (data.qr_tokens as QrItem[]) : [];
        setQrs(tokens);
        const activeCount = tokens.filter(q => !q.is_expired).length;
        // 개별 ID 단위 갱신 매핑 요청
        onQrCountChange(item.id, tokens.length, activeCount);
      }
    } catch (e) { console.error(e); }
  }, [item.id, onQrCountChange]);

  const fetchAttendance = useCallback(async () => {
    setAttendanceLoading(true);
    try {
      const res = await fetch('/api/attendance/by-occurrence', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occurrence_id: item.id }),
      });
      const data = (await res.json()) as AttendanceByOccurrenceResponse;
      if (res.ok) {
        setAttendance({
          summary: data.summary ?? { total_checked_count: 0, present_count: 0, late_count: 0, absent_count: 0 },
          items: Array.isArray(data.items) ? data.items : []
        });
      }
    } catch (e) { console.error(e); } finally {
      setAttendanceLoading(false);
    }
  }, [item.id]);

  const fetchMissing = useCallback(async () => {
    setMissingLoading(true);
    try {
      const res = await fetch('/api/attendance/missing-by-occurrence', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occurrence_id: item.id }),
      });
      const data = (await res.json()) as MissingByOccurrenceResponse;
      if (res.ok) {
        setMissing({
          count: Number(data.count ?? 0),
          items: Array.isArray(data.items) ? data.items : []
        });
      }
    } catch (e) { console.error(e); } finally {
      setMissingLoading(false);
    }
  }, [item.id]);

  useEffect(() => {
    void fetchQr();
    void fetchAttendance();
    void fetchMissing();
  }, [fetchQr, fetchAttendance, fetchMissing]);

  function validateQrExpireSetting(unit: ExpireUnit, val: number) {
    if (unit === 'unlimited') return '';
    if (unit === 'hours') {
      if (!Number.isInteger(val) || val < 1 || val > 6) {
        return '시간 단위 QR 유효시간은 1~6시간 사이 정수입니다. (예: 1, 2, 3)';
      }
      return '';
    }
    if (!Number.isInteger(val) || val < 1 || val > 1) {
      return '일 단위 QR 유효시간은 1일 입니다.';
    }
    return '';
  }

  const handleCreateQr = async () => {
    const valNum = Number(expireValue);
    const validationError = validateQrExpireSetting(expireUnit, valNum);
    if (validationError) {
      setCardError(validationError);
      return;
    }

    try {
      setSubmitting(true);
      setCardError('');
      setCardSuccess('');

      const res = await fetch('/api/qr/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occurrence_id: item.id, expire_unit: expireUnit, expire_value: valNum }),
      });
      const data = (await res.json()) as QrCreateResponse;

      if (!res.ok) throw new Error(data.error || 'QR 생성에 실패했습니다.');
      if (!data.qr_url || !data.qr_token) throw new Error('QR 링크가 응답에 없습니다.');

      const nextQr: QrItem = {
        id: data.qr_token.id,
        event_id: data.qr_token.event_id,
        occurrence_id: data.qr_token.occurrence_id,
        token_preview: data.qr_token.token_preview ?? null,
        qr_url: data.qr_url,
        expires_at: data.qr_token.expires_at,
        used_count: data.qr_token.used_count,
        created_at: data.qr_token.created_at,
        is_expired: false,
      };

      setQrs(prev => [nextQr, ...prev]);
      setCardSuccess(data.message || 'QR이 생성되었습니다.');
      void fetchQr(); // 개수 동기화 업데이트 트리거
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'QR 생성 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyQrLink = async (qrUrl?: string | null) => {
    if (!qrUrl) {
      setCardError('이 QR은 원본 링크를 복원할 수 없습니다. 새 QR을 발급해주세요.');
      return;
    }
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCardSuccess('QR 링크가 복사되었습니다.');
    } catch {
      setCardError('QR 링크 복사에 실패했습니다.');
    }
  };

  const handleReissueQr = async (qrId: string) => {
    const valNum = Number(expireValue);
    const validationError = validateQrExpireSetting(expireUnit, valNum);
    if (validationError) {
      setCardError(validationError);
      return;
    }

    try {
      setSubmitting(true);
      setCardError('');
      setCardSuccess('');

      const res = await fetch('/api/qr/update', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: qrId, expire_unit: expireUnit, expire_value: valNum }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'QR 시간 연장에 실패했습니다.');

      setCardSuccess(data.message || 'QR 유효 시간이 수정되었습니다.');
      void fetchQr();
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'QR 시간 연장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQr = async (qrId: string) => {
    if (!window.confirm('정말 이 QR을 삭제하시겠습니까?')) return;
    try {
      setSubmitting(true);
      setCardError('');
      setCardSuccess('');

      const res = await fetch('/api/qr/delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: qrId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'QR 삭제에 실패했습니다.');

      setCardSuccess(data.message || 'QR이 삭제되었습니다.');
      void fetchQr();
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'QR 삭제 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkAbsent = async () => {
    if (!window.confirm('아직 출석 기록이 없는 수련생들을 결석 처리하시겠습니까?')) return;
    try {
      setSubmitting(true);
      setCardError('');
      setCardSuccess('');

      const res = await fetch('/api/attendance/mark-absent-by-occurrence', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occurrence_id: item.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '결석 처리에 실패했습니다.');

      await Promise.all([fetchAttendance(), fetchMissing()]);
      setCardSuccess(data.message || `결석 처리 완료: ${Number(data.marked_absent_count ?? 0)}명 처리`);
    } catch (err) {
      setCardError(err instanceof Error ? err.message : '결석 처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const createQrDataUrl = async (qrUrl: string): Promise<string> => {
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, qrUrl, { width: 900, margin: 2, errorCorrectionLevel: 'H' });
    return canvas.toDataURL('image/png');
  };

  const handleOpenQrWindow = async (qrUrl: string) => {
    if (!qrUrl) {
      setCardError('QR 링크가 없습니다. 새 QR을 발급해주세요.');
      return;
    }
    const popup = window.open('', '_blank', 'width=760,height=860');
    if (!popup) {
      setCardError('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.');
      return;
    }

    try {
      const qrDataUrl = await createQrDataUrl(qrUrl);
      popup.document.write(`
        <!doctype html>
        <html lang="ko">
          <head><meta charset="UTF-8" /><title>출석 QR 크게보기</title></head>
          <body style="margin:0;padding:24px;background:#111827;color:white;text-align:center;font-family:sans-serif;">
            <h1>출석 QR 크게보기</h1>
            <div style="background:white;padding:16px;border-radius:20px;margin:20px auto;width:min(80vw,600px);height:min(80vw,600px);box-sizing:border-box;">
              <img src="${qrDataUrl}" alt="출석 QR" style="width:100%;height:100%;object-fit:contain;" />
            </div>
            <div style="word-break:break-all;font-size:14px;">${qrUrl}</div>
            <div style="margin-top:20px;">
              <button onclick="navigator.clipboard.writeText('${qrUrl}').then(() => alert('복사되었습니다.'))">링크 복사</button>
              <button onclick="window.close()">닫기</button>
            </div>
          </body>
        </html>
      `);
      popup.document.close();
    } catch {
      setCardError('QR 크게보기에 실패했습니다.');
    }
  };

  function formatOccurrenceStatus(status: string) {
    if (status === 'scheduled') return '대기 중';
    if (status === 'open') return '진행 중';
    if (status === 'closed') return '종료됨';
    if (status === 'archived') return '기록 보관됨';
    return status;
  }

  function formatRecurrenceDays(days?: string[], type?: 'none' | 'daily') {
    if (type === 'none' || !days || days.length === 0) return '없음(단발성)';
    const koMap: Record<string, string> = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' };
    return days.map((d) => koMap[d] ?? d).join(', ');
  }

  return (
    <article style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{item.events?.name ?? '알 수 없는 행사'}</div>
          <div style={{ color: '#666', marginTop: 6 }}>회차 날짜: {item.occurrence_date}</div>
          <div style={{ color: '#666', marginTop: 4 }}>시작 시간: {new Date(item.start_time).toLocaleString()}</div>
          <div style={{ color: '#666', marginTop: 4 }}>상태: {formatOccurrenceStatus(item.status)}</div>
          <div style={{ color: '#666', marginTop: 4 }}>
            반복 요일: {formatRecurrenceDays(item.events?.recurrence_days, item.events?.recurrence_type)}
          </div>
          <div style={{ color: '#666', marginTop: 4 }}>
            특별 행사: {item.events?.is_special_event ? '예' : '아니오'} / 지각 기준: {item.events?.late_threshold_min ?? 5}분
          </div>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          {missing.count > 0 && (
            <div style={{ color: '#b91c1c', fontSize: 13 }}>미출석 인원 {missing.count}명이 남아 있습니다.</div>
          )}
          <button onClick={() => void handleMarkAbsent()} disabled={submitting || item.status === 'archived'} style={secondaryButtonStyle}>
            결석 처리
          </button>
        </div>
      </div>

      <section style={attendanceSummarySectionStyle}>
        <div style={attendanceSummaryGridStyle}>
          <MiniSummaryCard title="출석 인원" value={String(attendance.summary.present_count)} />
          <MiniSummaryCard title="지각 인원" value={String(attendance.summary.late_count)} />
          <MiniSummaryCard title="결석 인원" value={String(attendance.summary.absent_count)} />
          <MiniSummaryCard title="미출석 인원" value={String(missing.count)} />
          <MiniSummaryCard title="전체 체크 인원" value={String(attendance.summary.total_checked_count)} />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button onClick={() => void fetchAttendance()} disabled={attendanceLoading || submitting} style={secondaryButtonStyle}>
            {attendanceLoading ? '조회 중...' : '출석 현황 새로고침'}
          </button>
          <button onClick={() => setExpanded(!expanded)} disabled={attendanceLoading} style={secondaryButtonStyle}>
            {expanded ? '출석 상세 닫기' : '출석 상세 보기'}
          </button>
          <button onClick={() => void fetchMissing()} disabled={missingLoading || submitting} style={secondaryButtonStyle}>
            {missingLoading ? '조회 중...' : '미출석 목록 새로고침'}
          </button>
          <button onClick={() => setExpandedMissing(!expandedMissing)} disabled={missingLoading} style={secondaryButtonStyle}>
            {expandedMissing ? '미출석 목록 닫기' : '미출석 목록 보기'}
          </button>
        </div>

        {cardError && <div style={{...errorBoxStyle, marginTop: 10}}>{cardError}</div>}
        {cardSuccess && <div style={{...successBoxStyle, marginTop: 10}}>{cardSuccess}</div>}

        {expanded && <div style={{ marginTop: 14 }}><AttendanceDetailTable items={attendance.items} /></div>}
        {expandedMissing && <div style={{ marginTop: 14 }}><MissingDetailTable items={missing.items} /></div>}
      </section>

      <div style={qrPanelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <h4 style={{ margin: 0 }}>오늘 회차 QR 관리</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {(item.status === 'closed' || item.status === 'archived') && (
              <div style={{ color: '#b91c1c', fontSize: 13 }}>종료된 회차는 QR 발급/시간 연장이 제한됩니다.</div>
            )}

            <select
              value={expireUnit}
              onChange={(e) => {
                const nextUnit = e.target.value as ExpireUnit;
                setExpireUnit(nextUnit);
                setExpireValue(nextUnit === 'unlimited' ? '0' : '1');
              }}
              style={{ ...inputStyle, width: 140 }}
              disabled={submitting || item.status === 'closed' || item.status === 'archived'}
            >
              <option value="hours">시 단위</option>
              <option value="days">일 단위</option>
              <option value="unlimited">무제한</option>
            </select>

            {expireUnit !== 'unlimited' && (
              <input
                type="number"
                min={1}
                step={1}
                value={expireValue}
                onChange={(e) => setExpireValue(e.target.value)}
                style={{ ...inputStyle, width: 80 }}
                disabled={submitting || item.status === 'closed' || item.status === 'archived'}
              />
            )}

            <button
              onClick={() => void handleCreateQr()}
              disabled={submitting || item.status === 'closed' || item.status === 'archived'}
              style={primaryButtonStyle}
            >
              QR 신규 발급
            </button>
          </div>
        </div>

        {qrs.length === 0 ? (
          <div style={{ ...emptyBoxStyle, background: 'none', border: '1px dashed #e2e8f0' }}>생성된 QR 토큰이 없습니다.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {qrs.map((qr) => (
              <div key={qr.id} style={qrItemRowStyle}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={qr.is_expired ? expiredBadgeStyle : activeBadgeStyle}>
                    {qr.is_expired ? '만료됨' : '유효함'}
                  </span>
                  <code style={{ fontSize: 13, color: '#333' }}>
                    {qr.token_preview ? `${qr.token_preview}...` : qr.id.substring(0, 8)}
                  </code>
                  <span style={{ fontSize: 12, color: '#666' }}>
                    만료시각: {qr.expires_at ? new Date(qr.expires_at).toLocaleString() : '무제한'}
                  </span>
                  <span style={{ fontSize: 12, color: '#666' }}>사용횟수: {qr.used_count}회</span>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => void handleOpenQrWindow(qr.qr_url ?? '')} disabled={qr.is_expired} style={actionButtonStyle}>크게보기</button>
                  <button onClick={() => void handleCopyQrLink(qr.qr_url)} style={actionButtonStyle}>リンク복사</button>
                  <button onClick={() => void handleReissueQr(qr.id)} disabled={submitting || item.status === 'closed' || item.status === 'archived'} style={actionButtonStyle}>시간 변경</button>
                  <button onClick={() => void handleDeleteQr(qr.id)} disabled={submitting} style={{ ...actionButtonStyle, color: '#b91c1c' }}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function MiniSummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={miniSummaryCardStyle}>
      <div style={{ fontSize: 12, color: '#666' }}>{title}</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// 레이아웃 스타일 객체 공유
const panelStyle = { background: 'white', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };
const attendanceSummarySectionStyle = { background: '#f8fafc', padding: 16, borderRadius: 12, marginTop: 14 };
const attendanceSummaryGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 };
const miniSummaryCardStyle = { background: 'white', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' as const };
const qrPanelStyle = { marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0' };
const qrItemRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 10, background: '#f8fafc', borderRadius: 8, flexWrap: 'wrap' as const };
const inputStyle = { padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 };
const emptyBoxStyle = { padding: 20, textAlign: 'center' as const, color: '#94a3b8', background: '#f8fafc', borderRadius: 8, fontSize: 14 };
const errorBoxStyle = { padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 8, border: '1px solid #fee2e2', fontSize: 14 };
const successBoxStyle = { padding: 12, background: '#f0fdf4', color: '#16a34a', borderRadius: 8, border: '1px solid #dcfce7', fontSize: 14 };
const primaryButtonStyle = { padding: '8px 14px', background: '#1e293b', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' };
const secondaryButtonStyle = { padding: '8px 14px', background: 'white', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 6, fontWeight: 500, cursor: 'pointer' };
const actionButtonStyle = { padding: '4px 8px', background: 'white', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 12, cursor: 'pointer' };
const activeBadgeStyle = { padding: '2px 6px', background: '#dcfce7', color: '#15803d', borderRadius: 4, fontSize: 12, fontWeight: 600 };
const expiredBadgeStyle = { padding: '2px 6px', background: '#fef2f2', color: '#b91c1c', borderRadius: 4, fontSize: 12, fontWeight: 600 };