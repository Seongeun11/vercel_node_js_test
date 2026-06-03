// lib/security/excel-upload.ts
import * as XLSX from 'xlsx'

export type UserRole = 'admin' | 'captain' | 'trainee'

export type ParsedBulkUser = {
  student_id: string
  full_name: string
  password: string
  role: UserRole
  cohort_no: number | null
}

export type ExcelValidationResult =
  | {
      ok: true
      rows: ParsedBulkUser[]
    }
  | {
      ok: false
      error: string
    }

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024
const MAX_ROWS = 300
const MAX_SHEETS = 1

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls']

const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  // 일부 브라우저/Vercel 환경에서 xlsx가 이 MIME으로 들어올 수 있음
  'application/octet-stream',
]

const REQUIRED_COLUMNS = ['student_id', 'full_name', 'password', 'role'] as const
const OPTIONAL_COLUMNS = ['cohort_no'] as const

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeCell(value: unknown): string {
  return String(value ?? '').trim()
}

function hasAllowedExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function isAllowedMimeType(type: string): boolean {
  // type이 빈 문자열인 환경도 있어 확장자 검증과 함께 처리
  if (!type) return true
  return ALLOWED_MIME_TYPES.includes(type)
}

function parseCohortNo(value: unknown): number | null {
  const text = normalizeCell(value)
  if (!text) return null

  const numberValue = Number(text)

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error('cohort_no는 비어있거나 1 이상 정수여야 합니다.')
  }

  return numberValue
}

function parseRole(value: unknown): UserRole {
  const role = normalizeCell(value) as UserRole

  if (!['admin', 'captain', 'trainee'].includes(role)) {
    throw new Error('role은 admin, captain, trainee 중 하나여야 합니다.')
  }

  return role
}

function validateStringLength(label: string, value: string, max: number): void {
  if (value.length > max) {
    throw new Error(`${label} 길이가 너무 깁니다. 최대 ${max}자입니다.`)
  }
}

export async function parseBulkUserExcel(file: File): Promise<ExcelValidationResult> {
  try {
    if (!file) {
      return { ok: false, error: '엑셀 파일이 필요합니다.' }
    }

    if (file.size <= 0) {
      return { ok: false, error: '빈 파일은 업로드할 수 없습니다.' }
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { ok: false, error: '파일 크기는 최대 2MB까지 허용됩니다.' }
    }

    if (!hasAllowedExtension(file.name)) {
      return { ok: false, error: '엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다.' }
    }

    if (!isAllowedMimeType(file.type)) {
      return { ok: false, error: '허용되지 않은 파일 형식입니다.' }
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: false,
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      cellStyles: false,
      WTF: false,
    })

    if (workbook.SheetNames.length === 0) {
      return { ok: false, error: '엑셀 시트를 찾을 수 없습니다.' }
    }

    if (workbook.SheetNames.length > MAX_SHEETS) {
      return { ok: false, error: '엑셀 시트는 1개만 허용됩니다.' }
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    })

    if (rawRows.length === 0) {
      return { ok: false, error: '업로드할 사용자 데이터가 없습니다.' }
    }

    if (rawRows.length > MAX_ROWS) {
      return { ok: false, error: `한 번에 최대 ${MAX_ROWS}명까지만 업로드할 수 있습니다.` }
    }

    const firstRow = rawRows[0] ?? {}
    const headers = Object.keys(firstRow).map(normalizeHeader)

    for (const required of REQUIRED_COLUMNS) {
      if (!headers.includes(required)) {
        return { ok: false, error: `필수 컬럼이 없습니다: ${required}` }
      }
    }

    const allowedColumns = new Set<string>([...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS])
    const unknownColumns = headers.filter((header) => !allowedColumns.has(header))

    if (unknownColumns.length > 0) {
      return {
        ok: false,
        error: `허용되지 않은 컬럼이 있습니다: ${unknownColumns.join(', ')}`,
      }
    }

    const seenStudentIds = new Set<string>()
    const rows: ParsedBulkUser[] = []

    rawRows.forEach((row, index) => {
      const rowNumber = index + 2

      const studentId = normalizeCell(row.student_id)
      const fullName = normalizeCell(row.full_name)
      const password = normalizeCell(row.password)

      if (!studentId) throw new Error(`${rowNumber}행: student_id가 비어있습니다.`)
      if (!/^\d{8,8}$/.test(studentId)) {
        throw new Error(`${rowNumber}행: student_id는 8자리 숫자여야 합니다.`)
      }

      if (seenStudentIds.has(studentId)) {
        throw new Error(`${rowNumber}행: 중복된 student_id입니다. (${studentId})`)
      }
      seenStudentIds.add(studentId)

      if (!fullName) throw new Error(`${rowNumber}행: full_name이 비어있습니다.`)
      if (!password) throw new Error(`${rowNumber}행: password가 비어있습니다.`)

      validateStringLength(`${rowNumber}행 full_name`, fullName, 50)
      validateStringLength(`${rowNumber}행 password`, password, 20)

      if (password.length < 8) {
        throw new Error(`${rowNumber}행: password는 최소 8자 이상이어야 합니다.`)
      }

      const role = parseRole(row.role)
      const cohortNo = parseCohortNo(row.cohort_no)

      rows.push({
        student_id: studentId,
        full_name: fullName,
        password,
        role,
        cohort_no: cohortNo,
      })
    })

    return { ok: true, rows }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '엑셀 파일 검증에 실패했습니다.',
    }
  }
}