// app/api/admin/users/bulk-create/route.ts
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

type UserRole = 'admin' | 'captain' | 'trainee'
type EnrollmentStatus = 'active' | 'completed'

type BulkUserRow = {
  student_id?: string
  full_name?: string
  password?: string
  role?: UserRole | string
  cohort_no?: number | string
  enrollment_status?: string
}

type NormalizedBulkUserRow = {
  student_id: string
  full_name: string
  password: string
  role: UserRole
  cohort_no: number | null
  enrollment_status: EnrollmentStatus
}

type BulkCreateResultItem = {
  row: number
  student_id?: string
  success: boolean
  message: string
}

const MAX_FILE_SIZE_BYTES = 100 * 1024 //100kb
const MAX_ROWS = 400
const MAX_SHEETS = 1

const REQUIRED_COLUMNS = ['student_id', 'full_name', 'password', 'role'] as const
const OPTIONAL_COLUMNS = ['cohort_no', 'enrollment_status'] as const

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls']
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
  '',
]

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

  // Supabase 원본 에러를 그대로 노출하지 않음
  return '사용자 생성에 실패했습니다.'
}

function hasAllowedExtension(fileName: string): boolean {
  const lowerName = fileName.toLowerCase()
  return ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
}

function validateUploadFile(file: File): string {
  if (!file.name || !hasAllowedExtension(file.name)) {
    return '엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다.'
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return '허용되지 않은 파일 형식입니다.'
  }

  if (file.size <= 0) {
    return '빈 파일은 업로드할 수 없습니다.'
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return '파일 크기는 최대 2MB까지 허용됩니다.'
  }

  return ''
}

function validateColumns(headers: string[]): string {
  const normalizedHeaders = headers.map((header) => header.trim()).filter(Boolean)
  const allowedColumns = new Set<string>([...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS])

  for (const requiredColumn of REQUIRED_COLUMNS) {
    if (!normalizedHeaders.includes(requiredColumn)) {
      return `필수 컬럼이 없습니다: ${requiredColumn}`
    }
  }

  const unknownColumns = normalizedHeaders.filter((header) => !allowedColumns.has(header))

  if (unknownColumns.length > 0) {
    return `허용되지 않은 컬럼이 있습니다: ${unknownColumns.join(', ')}`
  }

  return ''
}

/**
 * DB 저장/검증용 문자열 정규화
 * - 값 자체를 변조하지 않음
 * - Formula Injection 방어용 홑따옴표를 여기서 붙이면 안 됨
 */
function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

/**
 * 기수 정규화
 * - 빈 값은 null
 * - 숫자가 아니거나 1 미만이면 NaN 반환
 * - validateRow에서 차단
 */
function normalizeCohortNo(value: unknown): number | null {
  const text = normalizeText(value)

  if (text === '') return null

  const cohortNo = Number(text)

  if (!Number.isInteger(cohortNo) || cohortNo < 1) {
    return NaN
  }

  return cohortNo
}

function normalizeEnrollmentStatus(value: unknown): EnrollmentStatus {
  const text = String(value ?? '').trim().toLowerCase()

  if (text === 'completed') return 'completed'
  return 'active'
}

function normalizeRow(row: BulkUserRow): NormalizedBulkUserRow {
  return {
    student_id: normalizeText(row.student_id),
    full_name: normalizeText(row.full_name),
    password: normalizeText(row.password),
    role: normalizeText(row.role) as UserRole,
    cohort_no: normalizeCohortNo(row.cohort_no),
    enrollment_status: normalizeEnrollmentStatus(row.enrollment_status),
  }
}

function validateRow(row: NormalizedBulkUserRow): string {
  if (!row.student_id) return '출석번호가 비어 있습니다.'

  if (!/^\d{10}$/.test(row.student_id)) {
    return '출석번호는 10자리 숫자여야 합니다.'
  }

  if (!row.full_name) return '이름이 비어 있습니다.'

  if (row.full_name.length > 50) {
    return '이름은 최대 50자까지 허용됩니다.'
  }

if (row.password.length < 8 || row.password.length > 72) {
  return '비밀번호는 8~72자 사이여야 합니다.'
}

  if (/\s/.test(row.password)) {
    return '비밀번호에는 공백을 사용할 수 없습니다.'
  }

  if (!/[a-z]/.test(row.password)) {
    return '비밀번호에는 소문자가 최소 1개 포함되어야 합니다.'
  }

  if (!/\d/.test(row.password)) {
    return '비밀번호에는 숫자가 최소 1개 포함되어야 합니다.'
  }

  if (!['admin', 'captain', 'trainee'].includes(row.role)) {
    return '역할(role)은 admin, captain, trainee 중 하나여야 합니다.'
  }

  if (
    row.cohort_no !== null &&
    (!Number.isInteger(row.cohort_no) || row.cohort_no < 1)
  ) {
    return '기수(cohort_no)는 1 이상의 정수여야 합니다.'
  }

  return ''
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request)

  try {
    //CSRF 방어
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
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
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

    const fileValidationError = validateUploadFile(file)

    if (fileValidationError) {
      return jsonNoStore(
        { error: fileValidationError },
        { status: 400 }
      )
    }

    const buffer = await file.arrayBuffer()

    const workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: false,
      cellHTML: false,
      cellNF: false,
      cellStyles: false,
      WTF: false,
    })

    if (workbook.SheetNames.length === 0) {
      return jsonNoStore(
        { error: '엑셀 시트를 찾을 수 없습니다.' },
        { status: 400 }
      )
    }

    if (workbook.SheetNames.length > MAX_SHEETS) {
      return jsonNoStore(
        { error: '엑셀 시트는 1개만 허용됩니다.' },
        { status: 400 }
      )
    }

    const firstSheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[firstSheetName]

    const headerRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    })

    const headers = (headerRows[0] ?? []).map((value) =>
      String(value ?? '').trim()
    )

    const columnValidationError = validateColumns(headers)

    if (columnValidationError) {
      return jsonNoStore(
        { error: columnValidationError },
        { status: 400 }
      )
    }

    const rows = XLSX.utils.sheet_to_json<BulkUserRow>(sheet, {
      defval: '',
      raw: false,
      blankrows: false,
    })

    if (!rows.length) {
      return jsonNoStore(
        { error: '엑셀 데이터가 비어 있습니다.' },
        { status: 400 }
      )
    }

    if (rows.length > MAX_ROWS) {
      return jsonNoStore(
        { error: `한 번에 최대 ${MAX_ROWS}명까지만 등록할 수 있습니다.` },
        { status: 400 }
      )
    }

    const results: BulkCreateResultItem[] = []
    const seenStudentIds = new Set<string>()

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

      if (seenStudentIds.has(normalized.student_id)) {
        results.push({
          row: rowNumber,
          student_id: normalized.student_id,
          success: false,
          message: '엑셀 파일 안에 중복된 학번이 있습니다.',
        })
        continue
      }

      seenStudentIds.add(normalized.student_id)

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
          enrollment_status: normalized.enrollment_status,
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
          .select('id, student_id, full_name, role, cohort_no, enrollment_status, created_at')
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
        file_name: file.name,
        file_size: file.size,
        total_count: results.length,
        success_count: successCount,
        failed_count: failedCount,

        // 원본 row, password, Supabase 원본 에러 메시지는 기록하지 않음
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

    console.error('[admin/users/bulk-create] unexpected error:', error)

    return jsonNoStore(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}