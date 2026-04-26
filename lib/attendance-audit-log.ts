// lib/attendance-audit-log.ts

import { supabaseAdmin } from '@/lib/supabase/admin'

type AttendanceLogAction =
  | 'create'
  | 'update'
  | 'correct'
  | 'mark_absent'
  | 'delete'

type WriteAttendanceAuditLogInput = {
  attendanceId?: string | null
  changedBy?: string | null
  targetUserId?: string | null
  eventId?: string | null
  date: string
  action: AttendanceLogAction
  reason?: string | null
  beforeValue?: Record<string, unknown>
  afterValue?: Record<string, unknown>
}

export async function writeAttendanceAuditLog({
  attendanceId = null,
  changedBy = null,
  targetUserId = null,
  eventId = null,
  date,
  action,
  reason = null,
  beforeValue = {},
  afterValue = {},
}: WriteAttendanceAuditLogInput): Promise<void> {
  const { error } = await supabaseAdmin.from('attendance_logs').insert({
    attendance_id: attendanceId,
    changed_by: changedBy,
    target_user_id: targetUserId,
    event_id: eventId,
    date,
    action,
    reason,
    before_value: beforeValue,
    after_value: afterValue,
  })

  if (error) {
    console.error('[attendance-audit-log] insert error:', error)
  }
}