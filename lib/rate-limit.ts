/*
// lib/rate-limit.ts
import { Redis } from '@upstash/redis'

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null

export type RateLimitResult = {
  ok: boolean
  remaining: number
  resetInSeconds: number
  configured: boolean
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  // 개발 환경에서는 로컬 테스트 편의를 위해 열어둠
  if (!redis && process.env.NODE_ENV !== 'production') {
    return {
      ok: true,
      remaining: limit,
      resetInSeconds: windowSeconds,
      configured: false,
    }
  }

  // 운영에서는 rate limit 저장소 미설정 상태를 안전하게 처리
  if (!redis && process.env.NODE_ENV === 'production') {
    return {
      ok: false,
      remaining: 0,
      resetInSeconds: windowSeconds,
      configured: false,
    }
  }

  const current = await redis!.incr(key)

  if (current === 1) {
    await redis!.expire(key, windowSeconds)
  }

  const ttl = await redis!.ttl(key)
  const remaining = Math.max(0, limit - current)

  return {
    ok: current <= limit,
    remaining,
    resetInSeconds: ttl > 0 ? ttl : windowSeconds,
    configured: true,
  }
}
  */


import { Redis } from '@upstash/redis'

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null

export type RateLimitResult = {
  ok: boolean
  remaining: number
  resetInSeconds: number
  configured: boolean
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  if (!redis) {
    return {
      ok: process.env.NODE_ENV !== 'production',
      remaining: limit,
      resetInSeconds: windowSeconds,
      configured: false,
    }
  }

  try {
    const [current, ttl] = (await redis
      .pipeline()
      .incr(key)
      .ttl(key)
      .exec()) as [number, number]

    let resetInSeconds = ttl

    // ttl === -1: 만료 없음
    // ttl === -2: 키 없음, pipeline 비원자성 방어
    if (current === 1 || ttl <= 0) {
      await redis.expire(key, windowSeconds)
      resetInSeconds = windowSeconds
    }

    return {
      ok: current <= limit,
      remaining: Math.max(0, limit - current),
      resetInSeconds,
      configured: true,
    }
  } catch (error) {
    console.error('Rate limit error:', error)

    return {
      ok: process.env.NODE_ENV !== 'production',
      remaining: 0,
      resetInSeconds: windowSeconds,
      configured: true,
    }
  }
}