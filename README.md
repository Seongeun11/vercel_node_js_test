next.js으로 만든 출석체크 웹

비영리목적으로 제작

Vercel + supabase + upstash 사용

기능

---
추가된 기능<br>
1. <br>
affiliations 테이블<br>

아카데미, 영성 수련, 모심수련, 효진정, 성화영성, 3일 공명기도 소속 확장<br>

2. 출석 로그, 월별 출석 조회 소속별로 필터링 <br>

공용 컴포넌트 사용<br>
components\common\affiliation-select.tsx<br>

3. 아카데미 포인트 기능 추가<br>

fn_sync_attendance_to_points 함수 트리거<br>

[방안 A: 파이썬 키오스크] ───>  NFC 카드 태그  ───┐<br>
[방안 B: Next.js 웹 앱]   ───>  QR 코드 스캔   ── ┼─> [public.attendance] ──> [포인트 통합 트리거](데이터 변동)(자동 정산)<br>
[방안 C: 수련생 대시보드] ───>  어드민 수동 정정 ──┘<br>

아카데미 포스기 : pypointkiosk에서 아카데미 포인트 사용
supabase에서 process_point_payment RPC사용함

4. 월별 출석 조회 이벤트 필터링 방식을 단일에서 복수형으로 변경
5. 회원 이름변경 추가

6. supabase 자동오늘회차등록 - 실행시간 kst 03시 - 함수등록: cron_create_today_occurrences
== vercel웹사이트경로와 정확히 일치해야함
---
추가할 기능<br>

1. 도서 대출 시스템 연동<br>
2. 수련 현장 접수기능 별도 구현<br>
