-- 1) profiles 테이블에 비밀번호 해시 컬럼 추가
alter table profiles
add column if not exists password_hash text;

-- 2) 예시 비밀번호 해시는 앱의 hashPassword() 결과값으로 넣어주세요.
-- 아래는 형식 예시입니다. 실제 운영 전 반드시 각 사용자 비밀번호를 개별 해시로 갱신하세요.
-- update profiles
-- set password_hash = '<salt>:<hash>'
-- where full_name = '홍길동';

-- 3) 아직 비밀번호가 없는 계정 확인
select id, full_name, student_id, role
from profiles
where password_hash is null or password_hash = '';
