//app\admin\[programType]\attendance-today\page.tsx
'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { TodayOccurrenceItem } from './types';
import { OccurrenceCard } from './occurrence-card';

export default function TodayOperationsClient() {
  const [date, setDate] = useState('');
  const [items, setItems] = useState<TodayOccurrenceItem[]>([]);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // 개별 ID 단위 상태 매핑을 통한 중복 합산 방지 (핵심 버그 수정부)
  const [qrCountsMap, setQrCountsMap] = useState<Record<string, { total: number; active: number }>>({});

  // Map의 value 데이터를 총합 연산
  const qrCounts = useMemo(() => {
    return Object.values(qrCountsMap).reduce(
      (acc, curr) => ({
        total: acc.total + curr.total,
        active: acc.active + curr.active,
      }),
      { total: 0, active: 0 }
    );
  }, [qrCountsMap]);

  const openCount = useMemo(() => items.filter((item) => item.status === 'open').length, [items]);
  const closedCount = useMemo(() => items.filter((item) => item.status === 'closed').length, [items]);

  async function ensureTodayOccurrences() {
    const res = await fetch('/api/event-occurrences/ensure-today', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '오늘 회차 생성에 실패했습니다.');
    return data;
  }

  async function fetchTodayOccurrences() {
    const res = await fetch('/api/event-occurrences/ensure-today/today', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '오늘 회차 조회에 실패했습니다.');
    return {
      date: String(data.date ?? ''),
      items: Array.isArray(data.items) ? (data.items as TodayOccurrenceItem[]) : [],
    };
  }

  const refreshToday = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      await ensureTodayOccurrences();
      const todayData = await fetchTodayOccurrences();
      setDate(todayData.date);
      setItems(todayData.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오늘 운영 화면을 불러오지 못했습니다.');
    } finally { // 문법 결함부 완전 교정
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshToday();
  }, [refreshToday]);

  const handleSyncToday = async () => {
    try {
      setSyncing(true);
      setError('');
      setSuccess('');

      const data = await ensureTodayOccurrences();
      await refreshToday();

      setSuccess(
        `오늘 회차 동기화가 완료되었습니다. 생성 ${Number(data.created_count ?? 0)}건, 실패 ${Number(data.failed_count ?? 0)}건`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '오늘 회차 동기화에 실패했습니다.');
    } finally {
      setSyncing(false);
    }
  };

  // 자식 컴포넌트 호출용 콜백 (안전한 매핑 업데이트 구조)
  const handleQrCountChange = useCallback((occurrenceId: string, total: number, active: number) => {
    setQrCountsMap(prev => ({
      ...prev,
      [occurrenceId]: { total, active }
    }));
  }, []);

  if (loading) {
    return <div style={{ padding: 20 }}>로딩중...</div>;
  }

  return (
    <div style={{ padding: 20, display: 'grid', gap: 24 }}>
      <div>
        <h2 style={{ marginBottom: 8 }}>오늘 출석 운영</h2>
        <p style={{ color: '#666', margin: 0 }}>
          오늘 날짜 기준 회차 생성, QR 발급/시간 연장/삭제, 출석 현황을 관리하는 운영 화면입니다.<br />
          매일 새벽 5시에 자동으로 오늘회차가 생성됩니다.<br />
          출석: 시작 1시간전 + 시작시간 + 지각 분 이내,<br/>
          지각: 시작시간 + 지각 분 이후,<br/>
          결석: 수동 결석처리를 권장합니다.<br/><br />
          결석 처리가 되면 출석체크가 불가능합니다.
        </p>
      </div>

      <section style={summaryGridStyle}>
        <SummaryCard title="운영 날짜" value={date || '-'} />
        <SummaryCard title="오늘 회차 수" value={String(items.length)} />
        <SummaryCard title="진행 중 회차" value={String(openCount)} />
        <SummaryCard title="종료 회차" value={String(closedCount)} />
        <SummaryCard title="전체 QR 수" value={String(qrCounts.total)} />
        <SummaryCard title="활성 QR 수" value={String(qrCounts.active)} />
      </section>

      <section style={panelStyle}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => void handleSyncToday()} disabled={syncing} style={primaryButtonStyle}>
            {syncing ? '동기화 중...' : '오늘 회차 동기화'}
          </button>
          <button onClick={() => void refreshToday()} disabled={syncing} style={secondaryButtonStyle}>
            새로고침
          </button>
        </div>
      </section>

      {error && <div style={errorBoxStyle}>{error}</div>}
      {success && <div style={successBoxStyle}>{success}</div>}

      <section style={{ display: 'grid', gap: 16 }}>
        <h3 style={{ margin: 0 }}>오늘 회차 목록</h3>
        {items.length === 0 ? (
          <div style={emptyBoxStyle}>오늘 생성된 회차가 없습니다.</div>
        ) : (
          items.map((item) => (
            <OccurrenceCard 
              key={item.id} 
              item={item} 
              onQrCountChange={handleQrCountChange}
            />
          ))
        )}
      </section>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={summaryCardStyle}>
      <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const summaryGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 };
const summaryCardStyle = { background: '#f8fafc', padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0' };
const panelStyle = { background: 'white', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };
const emptyBoxStyle = { padding: 20, textAlign: 'center' as const, color: '#94a3b8', background: '#f8fafc', borderRadius: 8, fontSize: 14 };
const errorBoxStyle = { padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 8, border: '1px solid #fee2e2', fontSize: 14 };
const successBoxStyle = { padding: 12, background: '#f0fdf4', color: '#16a34a', borderRadius: 8, border: '1px solid #dcfce7', fontSize: 14 };
const primaryButtonStyle = { padding: '8px 14px', background: '#1e293b', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' };
const secondaryButtonStyle = { padding: '8px 14px', background: 'white', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 6, fontWeight: 500, cursor: 'pointer' };