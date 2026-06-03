// next.config.ts
import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'

/**
 * 운영 기본 CSP
 *
 * 주의:
 * - 현재 프로젝트에 외부 CDN, 외부 이미지, Google Fonts, 분석 스크립트가 있으면
 *   해당 도메인을 img-src / font-src / script-src / connect-src에 추가해야 합니다.
 * - Next.js 개발 모드(HMR) 때문에 dev에서는 unsafe-eval 허용이 필요할 수 있습니다.
 * - 운영에서는 가능한 한 'unsafe-eval' 제거를 권장합니다.
 */
const ContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline' ${isProd ? '' : "'unsafe-eval'"}`
    .replace(/\s+/g, ' ')
    .trim(),
  "connect-src 'self' https: wss:",
  "upgrade-insecure-requests",
]
  .join('; ')
  .replace(/\s{2,}/g, ' ')
  .trim()

const securityHeaders = [
  /**
   * XSS 완화 / 외부 리소스 제한
   */
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy,
  },

  /**
   * 클릭재킹 방지
   */
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },

  /**
   * 외부 요청 시 referrer 정보 최소화
   */
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },

  /**
   * 불필요한 브라우저 기능 차단
   * 필요 기능이 생기면 최소 범위로만 허용
   */
  {
    key: 'Permissions-Policy',
    value: [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'browsing-topics=()',
    ].join(', '),
  },

  /**
   * MIME 스니핑 방지
   */
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
]

/**
 * HSTS는 운영 HTTPS 도메인에서만 적용
 * - 로컬/개발 환경에는 넣지 않음
 * - 서브도메인까지 모두 HTTPS 준비가 끝난 경우 includeSubDomains 유지
 */
if (isProd) {
  securityHeaders.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  })
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        /**
         * 모든 응답에 전역 보안 헤더 적용
         */
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig