import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { requireRole } from '@/lib/serverAuth'

type AttendanceSnapshot = {
  id?: string
  user_id?: string
  event_id?: string
  date?: string
  status?: string
  check_time?: string | null
  method?: string | null
}

type AttendanceLogRow = {
  id: string
  attendance_id: string | null
  changed_by: string | null
  before_value: AttendanceSnapshot | null
  after_value: AttendanceSnapshot | null
  changed_at: string | null
}

export async function POST(request: Request) {
  try {
    const { actor_user_id } = await request.json()

    if (!actor_user_id) {
      return NextResponse.json(
        { error: 'actor_user_id가 필요합니다.' },
        { status: 400 }
      )
    }

    const authResult = await requireRole(actor_user_id, ['admin', 'captain'])

    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { data, error } = await supabase
      .from('attendance_logs')
      .select(`
        id,
        attendance_id,
        changed_by,
        before_value,
        after_value,
        changed_at
      `)
      .order('changed_at', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    const logs = (data ?? []) as AttendanceLogRow[]

    // UUID 수집
    const userIdSet = new Set<string>()
    const eventIdSet = new Set<string>()

    for (const log of logs) {
      if (log.changed_by) userIdSet.add(log.changed_by)
      if (log.before_value?.user_id) userIdSet.add(log.before_value.user_id)
      if (log.after_value?.user_id) userIdSet.add(log.after_value.user_id)

      if (log.before_value?.event_id) eventIdSet.add(log.before_value.event_id)
      if (log.after_value?.event_id) eventIdSet.add(log.after_value.event_id)
    }

    const userIds = Array.from(userIdSet)
    const eventIds = Array.from(eventIdSet)

    // profiles 조회
    let userMap: Record<string, { full_name: string; student_id: string; role: string }> = {}

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, student_id, role')
        .in('id', userIds)

      if (profilesError) {
        return NextResponse.json(
          { error: profilesError.message },
          { status: 500 }
        )
      }

      userMap = Object.fromEntries(
        (profiles ?? []).map((profile) => [
          profile.id,
          {
            full_name: profile.full_name,
            student_id: profile.student_id,
            role: profile.role,
          },
        ])
      )
    }

    // events 조회
    let eventMap: Record<string, { name: string; start_time: string }> = {}

    if (eventIds.length > 0) {
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, name, start_time')
        .in('id', eventIds)

      if (eventsError) {
        return NextResponse.json(
          { error: eventsError.message },
          { status: 500 }
        )
      }

      eventMap = Object.fromEntries(
        (events ?? []).map((event) => [
          event.id,
          {
            name: event.name,
            start_time: event.start_time,
          },
        ])
      )
    }

    // 로그에 표시용 이름 붙이기
    const enrichedLogs = logs.map((log) => {
      const beforeUserId = log.before_value?.user_id ?? null
      const afterUserId = log.after_value?.user_id ?? null
      const beforeEventId = log.before_value?.event_id ?? null
      const afterEventId = log.after_value?.event_id ?? null

      return {
        ...log,
        changed_by_profile: log.changed_by ? userMap[log.changed_by] ?? null : null,
        before_user_profile: beforeUserId ? userMap[beforeUserId] ?? null : null,
        after_user_profile: afterUserId ? userMap[afterUserId] ?? null : null,
        before_event_info: beforeEventId ? eventMap[beforeEventId] ?? null : null,
        after_event_info: afterEventId ? eventMap[afterEventId] ?? null : null,
      }
    })

    return NextResponse.json({ logs: enrichedLogs }, { status: 200 })
  } catch (error) {
    console.error('logs POST error:', error)
    return NextResponse.json(
      { error: '로그 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}