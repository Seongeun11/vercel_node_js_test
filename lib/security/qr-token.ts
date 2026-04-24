// lib/security/qr-token.ts
import crypto from 'crypto'

const QR_TOKEN_BYTE_LENGTH = 32

// QR URL에 들어갈 원본 토큰 생성
export function generateQrToken(): string {
  return crypto.randomBytes(QR_TOKEN_BYTE_LENGTH).toString('base64url')
}

// DB에는 원본 토큰 대신 이 해시만 저장
export function hashQrToken(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token, 'utf8')
    .digest('hex')
}

// 관리자 응답/로그 표시용 마스킹
export function maskQrToken(token: string): string {
  if (!token) return '***'
  if (token.length <= 10) return '***'

  return `${token.slice(0, 6)}…${token.slice(-4)}`
}