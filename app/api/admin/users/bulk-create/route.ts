import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { studentIdToEmail } from '@/lib/auth-email'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request-ip'
import { writeAdminAuditLog } from '@/lib/admin-audit'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type BulkUserRow = {
  student_id?: string
  full_name?: string
  password?: string
  role?: 'admin' | 'captain' | 'trainee'
  cohort_no?: number | string
}

type BulkCreateResultItem = {
  row: number
  student_id?: string
  success: boolean
  message: string
}

function normalizeSupabaseAuthError(message?: string): string {
  if (!message) return '사용자 생성 실패'

  if (
    message.includes('already been registered') ||
    message.includes('User already registered')
  ) {
    return '이미 생성된 계정입니다.'
  }

  if (message.includes('Password')) {
    return '비밀번호 정책에 맞지 않습니다.'
  }

  return message
}

function normalizeRow(row: BulkUserRow) {
  const studentId = String(row.student_id ?? '').trim()
  const fullName = String(row.full_name ?? '').trim()
  const password = String(row.password ?? '').trim()
  const role = String(row.role ?? '').trim() as 'admin' | 'captain' | 'trainee'
  const cohortRaw = String(row.cohort_no ?? '').trim()

  return {
    student_id: studentId,
    full_name: fullName,
    password,
    role,
    cohort_no: cohortRaw === '' ? null : Number(cohortRaw),
  }
}

function validateRow(row: ReturnType<typeof normalizeRow>): string {
  if (!row.student_id) return '학번이 비어 있습니다.'
  if (!row.full_name) return '이름이 비어 있습니다.'
  if (!row.password) return '비밀번호가 비어 있습니다.'

  if (!['admin', 'captain', 'trainee'].includes(row.role)) {
    return '역할(role)은 admin, captain, trainee 중 하나여야 합니다.'
  }

  if (row.cohort_no !== null) {
    if (!Number.isInteger(row.cohort_no) || row.cohort_no < 0) {
      return '기수(cohort_no)는 0 이상 정수여야 합니다.'
    }
  }

  return ''
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request)

  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])

    if (!authResult.ok || !authResult.user) {
      return jsonNoStore(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const ipRateLimit = await checkRateLimit(
      `admin:bulk-create-user:ip:${clientIp}`,
      3,
      300
    )

    if (!ipRateLimit.ok) {
      await writeAdminAuditLog({
        actorUserId: authResult.user.id,
        action: 'admin.user_bulk_create.blocked.rate_limit_ip',
        metadata: {
          client_ip: clientIp,
          retry_after_seconds: ipRateLimit.resetInSeconds,
        },
      })

      return jsonNoStore(
        {
          error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(ipRateLimit.resetInSeconds),
          },
        }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return jsonNoStore(
        { error: '엑셀 파일이 필요합니다.' },
        { status: 400 }
      )
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]

    if (!firstSheetName) {
      return jsonNoStore(
        { error: '엑셀 시트를 찾을 수 없습니다.' },
        { status: 400 }
      )
    }

    const sheet = workbook.Sheets[firstSheetName]
    const rows = XLSX.utils.sheet_to_json<BulkUserRow>(sheet, {
      defval: '',
    })

    if (!rows.length) {
      return jsonNoStore(
        { error: '엑셀 데이터가 비어 있습니다.' },
        { status: 400 }
      )
    }

    if (rows.length > 300) {
      return jsonNoStore(
        { error: '한 번에 최대 300명까지만 등록할 수 있습니다.' },
        { status: 400 }
      )
    }

    const results: BulkCreateResultItem[] = []

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2
      const normalized = normalizeRow(rows[index])

      const validationError = validateRow(normalized)
      if (validationError) {
        results.push({
          row: rowNumber,
          student_id: normalized.student_id,
          success: false,
          message: validationError,
        })
        continue
      }

      const email = studentIdToEmail(normalized.student_id)

      const { data: existingProfile, error: existingProfileError } =
        await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('student_id', normalized.student_id)
          .maybeSingle()

      if (existingProfileError) {
        results.push({
          row: rowNumber,
          student_id: normalized.student_id,
          success: false,
          message: '학번 중복 확인 중 오류가 발생했습니다.',
        })
        continue
      }

      if (existingProfile) {
        results.push({
          row: rowNumber,
          student_id: normalized.student_id,
          success: false,
          message: '이미 존재하는 학번입니다.',
        })
        continue
      }

      const { data: createdAuth, error: createAuthError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: normalized.password,
          email_confirm: true,
          user_metadata: {
            student_id: normalized.student_id,
            full_name: normalized.full_name,
            role: normalized.role,
            cohort_no: normalized.cohort_no,
          },
        })

      if (createAuthError || !createdAuth.user) {
        results.push({
          row: rowNumber,
          student_id: normalized.student_id,
          success: false,
          message: normalizeSupabaseAuthError(createAuthError?.message),
        })
        continue
      }

      const { data: createdProfile, error: createdProfileError } =
        await supabaseAdmin
          .from('profiles')
          .select('id, student_id, full_name, role, cohort_no, created_at')
          .eq('id', createdAuth.user.id)
          .maybeSingle()

      if (createdProfileError || !createdProfile) {
        await supabaseAdmin.auth.admin.deleteUser(createdAuth.user.id)

        results.push({
          row: rowNumber,
          student_id: normalized.student_id,
          success: false,
          message: '프로필 자동 생성에 실패했습니다. 트리거 설정을 확인해주세요.',
        })
        continue
      }

      results.push({
        row: rowNumber,
        student_id: normalized.student_id,
        success: true,
        message: '사용자 생성 완료',
      })
    }

    const successCount = results.filter((item) => item.success).length
    const failedCount = results.length - successCount

    await writeAdminAuditLog({
      actorUserId: authResult.user.id,
      action: 'admin.user_bulk_create.completed',
      metadata: {
        client_ip: clientIp,
        total_count: results.length,
        success_count: successCount,
        failed_count: failedCount,
      },
    })

    return jsonNoStore(
      {
        ok: true,
        summary: {
          total: results.length,
          success: successCount,
          failed: failedCount,
        },
        results,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    return jsonNoStore(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}