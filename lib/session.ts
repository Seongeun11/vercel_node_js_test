import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

const SESSION_COOKIE_NAME = 'attendance_session'
const SESSION_MAX_AGE = 60 * 60 * 8

type SessionUser = {
  id: string
  full_name: string
  student_id: string
  role: string
}

type SessionPayload = {
  user: SessionUser
  exp: number
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET

  if (!secret) {
    throw new Error('SESSION_SECRET 환경변수가 설정되지 않았습니다.')
  }

  return secret
}

function toBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function sign(value: string) {
  return createHmac('sha256', getSessionSecret()).update(value).digest('base64url')
}

export function createSessionToken(user: SessionUser) {
  const payload: SessionPayload = {
    user,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  }

  const encodedPayload = toBase64Url(JSON.stringify(payload))
  const signature = sign(encodedPayload)
  return `${encodedPayload}.${signature}`
}

export function verifySessionToken(token?: string | null): SessionUser | null {
  if (!token) return null

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null

  const expectedSignature = sign(encodedPayload)
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (actualBuffer.length !== expectedBuffer.length) return null
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload
    if (!payload?.user?.id || !payload?.exp) return null
    if (Date.now() > payload.exp) return null
    return payload.user
  } catch {
    return null
  }
}

export async function setSessionCookie(user: SessionUser) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}

export async function getSessionUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  return verifySessionToken(token)
}

export { SESSION_COOKIE_NAME }
export type { SessionUser }
