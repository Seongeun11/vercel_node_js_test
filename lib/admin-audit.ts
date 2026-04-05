import { supabaseAdmin } from '@/lib/supabase/admin'

type WriteAdminAuditLogParams = {
  actorUserId?: string | null
  action: string
  targetUserId?: string | null
  metadata?: Record<string, unknown>
}

/**
 * 감사 로그 실패가 본 요청까지 깨지게 만들 필요는 없음
 */
export async function writeAdminAuditLog({
  actorUserId,
  action,
  targetUserId,
  metadata = {},
}: WriteAdminAuditLogParams): Promise<void> {
  try {
    await supabaseAdmin.from('admin_audit_logs').insert({
      actor_user_id: actorUserId ?? null,
      action,
      target_user_id: targetUserId ?? null,
      metadata,
    })
  } catch (error) {
    console.error('[ADMIN_AUDIT_LOG_ERROR]', error)
  }
}