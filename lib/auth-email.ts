// lib/auth-email.ts

/**
 * 사용자가 입력한 학번을 Supabase Auth 내부 이메일로 변환한다.
 * 예: 20241234 -> 20241234@club.local
 */
export function studentIdToEmail(studentId: string): string {
  const normalized = String(studentId || '').trim()

  // 숫자/영문/하이픈/언더스코어 정도만 허용
  if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
    throw new Error('출석번호 형식이 올바르지 않습니다.')
  }

  return `${normalized}@club.local`
}