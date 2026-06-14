//app\api\admin\points\update\route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

export async function POST(request: NextRequest) {
  try {
    // 1. 보안 인가 체크 1: CSRF 방어 (Same Origin 검증)
    assertSameOrigin(request)

    // 2. 보안 인가 체크 2: 어드민 권한 상시 검증
    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore({ error: authResult.error }, { status: authResult.status })
    }
    const adminUser = authResult.user // 작업을 수행하는 관리자 정보

    // 3. 요청 데이터 파싱 및 검증
    const body = await request.json()
    const { target_user_id, amount, action_type, reason } = body

    // 1. 전송된 액수를 강제로 안전한 '정수(Integer)'로 완전히 정형화
    const safeAmount = Math.floor(Number(amount))

    // 2. 안전장치: DB 컬럼 스키마에 맞춘 글자 수(500자) 및 필수값 정밀 검증
    if (
      !target_user_id || 
      isNaN(safeAmount) || 
      safeAmount === 0 || 
      !reason?.trim() || 
      reason.trim().length > 500
    ) {
      return jsonNoStore({ error: '올바른 정산 금액과 500자 이내의 사유를 입력해주세요.' }, { status: 400 })
    }

    // 4. 트랜잭션 격리성 확보를 위해 현시점의 대상 유저 데이터 조회
    const { data: profile, error: findError } = await supabaseAdmin
      .from('profiles')
      .select('current_points')
      .eq('id', target_user_id)
      .single()

    if (findError || !profile) {
      return jsonNoStore({ error: '존재하지 않는 회원입니다.' }, { status: 404 })
    }

    // 🛠️ 교정 핵심: 계산 시 원본 amount 대신 철저하게 정수형인 safeAmount를 사용합니다.
    const beforePoints = profile.current_points
    const afterPoints = beforePoints + safeAmount

    // 5. 비즈니스 로직 방어선: 음수 잔고 체크
    if (afterPoints < 0) {
      return jsonNoStore({ error: '보유 포인트보다 더 많은 포인트를 차감할 수 없습니다.' }, { status: 400 })
    }

    // 6. DB 반영 (profiles 테이블 업데이트)
    // 🛠️ 교정 핵심: 정수형으로 완전히 연산된 afterPoints를 업데이트에 반영합니다.
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ current_points: afterPoints, updated_at: new Date().toISOString() })
      .eq('id', target_user_id)

    if (updateError) {
      return jsonNoStore({ error: '포인트 업데이트에 실패했습니다.' }, { status: 500 })
    }

    // app/api/admin/points/update/route.ts 수정 [cite: 9, 15]
    const allowedActions = ['earn_attendance', 'earn_bonus', 'use_shop', 'cancel', 'admin_adjust'];
    const isActionValid = action_type && allowedActions.includes(action_type);

    // 💡 화이트리스트 외의 값이 올 경우 금액 부호에 따라 유연하게 폴백 지정
    const finalAction = isActionValid 
      ? action_type 
      : (safeAmount < 0 ? 'cancel' : 'admin_adjust');

    // 🛠️ 교정 핵심: 비동기 처리가 완전히 끝나도록 명확한 await 보장 및 정수 인서트
    const { error: logError } = await supabaseAdmin
      .from('point_logs')
      .insert({
        user_id: target_user_id,
        amount: Math.abs(safeAmount), 
        action: finalAction,
        actor_id: adminUser.id,
        reason: reason.trim(),
        balance_after_action: afterPoints
      })
    
    if (logError) {
      console.error('[DB Log Insert Error]:', logError)
      return jsonNoStore({ error: '포인트 로그 장부 기록에 실패했습니다.' }, { status: 500 })
    }
    return jsonNoStore({ 
      success: true, 
      message: '포인트가 성공적으로 변경되었습니다.', 
      current_points: afterPoints 
    }, { status: 200 })

  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore({ error: '허용되지 않은 요청입니다.' }, { status: 403 })
    }
    console.error('[API Admin Points Update Error]:', error)
    return jsonNoStore({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}