'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { TodayOccurrenceItem, AffiliationItem } from './types'; // AffiliationItem 타입 추가 필요
import { OccurrenceCard } from './occurrence-card';

export default function TodayOperationsClient() {
  const [date, setDate] = useState('');
  const [items, setItems] = useState<TodayOccurrenceItem[]>([]);
  const [affiliations, setAffiliations] = useState<AffiliationItem[]>([]); // ◀ 소속 목록 상태 추가
  const [selectedAffiliationId, setSelectedAffiliationId] = useState<string>('all'); // ◀ 필터 상태 추가
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // 개별 ID 단위 상태 매핑을 통한 중복 합산 방지
  const [qrCountsMap, setQrCountsMap] = useState<Record<string, { total: number; active: number }>>({});

  // 1. 소속 마스터 데이터 조회 (이벤트 훅 분석 내용 반영)
  const fetchAffiliations = useCallback(async (): Promise<AffiliationItem[]> => {
    try {
      const res = await fetch('/api/affiliations', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.items && Array.isArray(data.items)) {
          return data.items;
        }
      }
    } catch (e) {
      console.error('소속 목록을 불러오지 못해 폴백 기본값을 제공합니다.', e);
    }
    // API 조회 실패 시 기본 마스터 로컬 데이터 반환
    return [
      { id: 1, name: '아카데미' },
      { id: 2, name: '영성 40일' },
      { id: 3, name: '모심 40일' },
      { id: 4, name: '효진정' },
      { id: 5, name: '성화영성' },
      { id: 6, name: '3일 공명기도' },
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
  const filteredItems = useMemo(() => {
    if (selectedAffiliationId === 'all') {
      return items;
    }
    return items.filter((item) => {
      // DB의 affiliations_id가 number 형식이므로 엄격 일치 처리를 위해 형변환 매핑 후 필터링
      return item.events?.affiliations_id === Number(selectedAffiliationId);
    });
  }, [items, selectedAffiliationId]);

  // 필터링된 결과 기반으로 카운트 및 요약 재계산
  const qrCounts = useMemo(() => {
    return Object.entries(qrCountsMap).reduce(
      (acc, [id, curr]) => {
        // 현재 활성화된(필터링된) 회차의 QR 카운트만 합산 처리하도록 검증
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

        {/* 3. 소속 필터 UI 컴포넌트 탑재 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="affiliation-filter" style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>소속 필터:</label>
          <select
            id="affiliation-filter"
            value={selectedAffiliationId}
            onChange={(e) => setSelectedAffiliationId(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, background: 'white', minWidth: 160 }}
          >
            <option value="all">전체 보기</option>
            {affiliations.map((aff) => (
              <option key={aff.id} value={String(aff.id)}>
                {aff.name}
              </option>
            ))}
          </select>
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