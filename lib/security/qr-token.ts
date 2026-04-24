// lib/security/qr-token.ts
import crypto from 'crypto'

const QR_TOKEN_BYTE_LENGTH = 32
const ALGORITHM = 'aes-256-gcm'
const IV_BYTE_LENGTH = 12
const AUTH_TAG_BYTE_LENGTH = 16

function getEncryptionKey(): Buffer {
  const rawKey = process.env.QR_TOKEN_ENCRYPTION_KEY

  if (!rawKey) {
    throw new Error('QR_TOKEN_ENCRYPTION_KEY is required')
  }

  const key = Buffer.from(rawKey, 'base64')

  if (key.length !== 32) {
    throw new Error('QR_TOKEN_ENCRYPTION_KEY must be 32 bytes base64')
  }

  return key
}

// QR URL에 들어갈 원본 토큰 생성
export function generateQrToken(): string {
  return crypto.randomBytes(QR_TOKEN_BYTE_LENGTH).toString('base64url')
}

// 출석 검증용 해시
export function hashQrToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex')
}

// DB 저장용 암호화
export function encryptQrToken(token: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_BYTE_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ])

  const authTag = cipher.getAuthTag()

  return [
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.')
}

// DB 조회 후 복호화
export function decryptQrToken(payload: string): string {
  const key = getEncryptionKey()
  const [ivText, authTagText, encryptedText] = payload.split('.')

  if (!ivText || !authTagText || !encryptedText) {
    throw new Error('INVALID_ENCRYPTED_QR_TOKEN')
  }

  const iv = Buffer.from(ivText, 'base64url')
  const authTag = Buffer.from(authTagText, 'base64url')
  const encrypted = Buffer.from(encryptedText, 'base64url')

  if (iv.length !== IV_BYTE_LENGTH || authTag.length !== AUTH_TAG_BYTE_LENGTH) {
    throw new Error('INVALID_ENCRYPTED_QR_TOKEN')
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8')
}

// 화면 표시용 마스킹
export function maskQrToken(token: string): string {
  if (!token) return '***'
  if (token.length <= 10) return '***'

  return `${token.slice(0, 6)}…${token.slice(-4)}`
}