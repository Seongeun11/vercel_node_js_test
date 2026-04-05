import { Redis } from '@upstash/redis'

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null

type RateLimitResult = {
  ok: boolean
  remaining: number
  resetInSeconds: number
}

/**
 * 고정 윈도우 기반 간단 rate limit
 * - production에서는 충분히 실용적
 * - Redis 미설정이면 fail-open
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  if (!redis) {
    return {
      ok: true,
      remaining: limit,
      resetInSeconds: windowSeconds,
    }
  }

  const current = await redis.incr(key)

  if (current === 1) {
    await redis.expire(key, windowSeconds)
  }

  const ttl = await redis.ttl(key)
  const remaining = Math.max(0, limit - current)

  return {
    ok: current <= limit,
    remaining,
    resetInSeconds: ttl > 0 ? ttl : windowSeconds,
  }
}