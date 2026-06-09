next.js으로 만든 출석체크 웹

비영리목적으로 제작

Vercel + supabase + upstash 사용

기능

---
추가된 기능
1. 
affiliations 테이블

아카데미, 영성 수련, 모심수련, 효진정, 성화영성, 3일 공명기도 소속 확장

2. 출석 로그, 월별 출석 조회 소속별로 필터링 

공용 컴포넌트 사용
components\common\affiliation-select.tsx

3. 아카데미 포인트 기능 추가

fn_sync_attendance_to_points 함수 트리거

[방안 A: 파이썬 키오스크] ───>  NFC 카드 태그  ───┐                                             │
[방안 B: Next.js 웹 앱]   ───>  QR 코드 스캔   ───┼─> [public.attendance] ──> [포인트 통합 트리거](데이터 변동)(자동 정산)
[방안 C: 수련생 대시보드] ───>  어드민 수동 정정 ──┘

---
추가할 기능

1. 도서 대출 시스템 연동
2. 수련 현장 접수기능 별도 구현
