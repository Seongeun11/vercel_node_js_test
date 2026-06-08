//app\admin\admin-only\attendance-today\page.tsx
'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { TodayOccurrenceItem, AffiliationItem } from './types'; // AffiliationItem 타입 추가 필요
import { OccurrenceCard } from './occurrence-card';
// 공용 컴포넌트 
import AffiliationSelect from '@/components/common/affiliation-select'

export default function TodayOperationsClient() {
  const [date, setDate] = useState('');
  const [items, setItems] = useState<TodayOccurrenceItem[]>([]);
  const [affiliations, setAffiliations] = useState<AffiliationItem[]>([]); // ◀ 소속 목록 상태 추가
  // 공용 컴포넌트 규격에 맞춰 초기값을 'all'에서 ''(빈 문자열)로 변경
  const [selectedAffiliationId, setSelectedAffiliationId] = useState<string>('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // 개별 ID 단위 상태 매핑을 통한 중복 합산 방지
  const [qrCountsMap, setQrCountsMap] = useState<Record<string, { total: number; active: number }>>({});

  // 1. 소속 마스터 데이터 조회 (OccurrenceCard 매핑 출력 용도 유지)
  const fetchAffiliations = useCallback(async (): Promise<AffiliationItem[]> => {
    try {
      const res = await fetch('/api/affiliations', {
        method: 'GET',
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        // 공용 컴포넌트의 데이터 포맷(data.data)과 기존 포맷(data.items)을 모두 방어적으로 지원
        const list = data.data || data.items;
        if (list && Array.isArray(list)) {
          return list;
        }
      }
    } catch (e) {
      console.error('소속 목록을 불러오지 못했습니다', e);
    }
    return [
      
    ];
  }, []);

  // 오늘 회차 데이터 로드
  const loadTodayData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      // 회차 데이터와 소속 데이터를 동시에 병렬 로드
      const [occurrencesRes, fetchedAffiliations] = await Promise.all([
        fetch('/api/event-occurrences/ensure-today/today', { credentials: 'include', cache: 'no-store' }),
        fetchAffiliations()
      ]);

      setAffiliations(fetchedAffiliations);

      if (!occurrencesRes.ok) {
        const errData = await occurrencesRes.json();
        throw new Error(errData.error || '오늘 회차를 조회하지 못했습니다.');
      }

      const occData = await occurrencesRes.json();
      setItems(Array.isArray(occData.items) ? occData.items : []);
      if (occData.date) setDate(occData.date);

    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로딩 중 오류 발생');
    } finally {
      setLoading(false);
    }
  }, [fetchAffiliations]);

  useEffect(() => {
    void loadTodayData();
  }, [loadTodayData]);

  // 2. [핵심] 선택된 소속 ID에 따른 행사 목록 필터링 계산 연산
  // 2. 선택된 소속 ID 기반 필터링 논리 수정 ('' 일 때 전체 보기)
  const filteredItems = useMemo(() => {
    if (selectedAffiliationId === '') {
      return items;
    }
    return items.filter((item) => {
      return item.events?.affiliations_id === Number(selectedAffiliationId);
    });
  }, [items, selectedAffiliationId]);

  // 필터링 결과 기반 요약 재계산
  const qrCounts = useMemo(() => {
    return Object.entries(qrCountsMap).reduce(
      (acc, [id, curr]) => {
        const isExistInFiltered = filteredItems.some(item => item.id === id);
        if (!isExistInFiltered) return acc;
        return {
          total: acc.total + curr.total,
          active: acc.active + curr.active,
        };
      },
      { total: 0, active: 0 }
    );
  }, [qrCountsMap, filteredItems]);

  const openCount = useMemo(() => filteredItems.filter((item) => item.status === 'open').length, [filteredItems]);
  const closedCount = useMemo(() => filteredItems.filter((item) => item.status === 'closed').length, [filteredItems]);

  const handleQrCountChange = useCallback((id: string, total: number, active: number) => {
    setQrCountsMap((prev) => ({
      ...prev,
      [id]: { total, active },
    }));
  }, []);

  if (loading) return <div style={{ padding: 20 }}>로딩중...</div>;

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      {/* 대시보드 헤더 영역 */}
      <header style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>오늘의 출석 및 QR 관리 ({date})</h2>
          <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: 14 }}>
            진행 중: {openCount}개 / 종료됨: {closedCount}개 | 총 발급 QR: {qrCounts.total}개 (유효: {qrCounts.active}개)
          </p>
        </div>

        {/* 3. 공용 소속 필터 UI 컴포넌트로 교체 완료 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="affiliation-filter" style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>소속 필터:</label>
          <AffiliationSelect 
            value={selectedAffiliationId}
            onChange={setSelectedAffiliationId}
            showAllOption={true}
            allOptionLabel="전체 보기"
          />
        </div>
      </header>

      {error && <div style={{ padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 8, marginBottom: 16 }}>{error}</div>}

      {/* 필터링된 결과 리스트 렌더링 */}
      <main style={{ display: 'grid', gap: 20 }}>
        {filteredItems.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: 12, border: '1px dashed #e2e8f0' }}>
            선택한 소속에 해당하는 오늘의 행사 회차가 없습니다.
          </div>
        ) : (
          filteredItems.map((item) => (
            <OccurrenceCard
              key={item.id}
              item={item}
              affiliations={affiliations} // ◀ 텍스트 매핑 출력을 위해 하위 카드로 전달
              onQrCountChange={handleQrCountChange}
            />
          ))
        )}
      </main>
    </div>
  );
}