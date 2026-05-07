import { z } from 'zod'

const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 72

export const AFFILIATION_VALUES = [
  '아카데미',
  '영성',
  '모심',
  '효진정',
  '성화영성',
] as const

const affiliationSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    const text = String(value ?? '').trim()
    return text === '' ? null : text
  })
  .refine(
    (value) => value === null || AFFILIATION_VALUES.includes(value as any),
    '소속 값이 올바르지 않습니다.'
  )

function validateStrongPassword(params: {
  password: string
  studentId: string
  fullName: string
}): string | null {
  const { password, studentId, fullName } = params

  if (password.length < PASSWORD_MIN_LENGTH) return '비밀번호는 최소 8자 이상이어야 합니다.'
  if (password.length > PASSWORD_MAX_LENGTH) return '비밀번호는 최대 72자까지 허용됩니다.'
  if (/\s/.test(password)) return '비밀번호에는 공백을 사용할 수 없습니다.'
  if (!/[a-z]/.test(password)) return '비밀번호에는 소문자가 최소 1개 포함되어야 합니다.'
  if (!/\d/.test(password)) return '비밀번호에는 숫자가 최소 1개 포함되어야 합니다.'
  if (password.includes(studentId)) return '비밀번호에는 학번을 포함할 수 없습니다.'

  if (password.toLowerCase().includes(fullName.trim().toLowerCase())) {
    return '비밀번호에는 이름을 포함할 수 없습니다.'
  }

  return null
}

export const adminUserCreateSchema = z
  .object({
    student_id: z.string().trim().regex(/^\d{10}$/, '학번은 10자리 숫자여야 합니다.'),
    password: z.string(),
    full_name: z.string().trim().min(2).max(20),
    role: z.enum(['admin', 'captain', 'trainee']),
    enrollment_status: z.enum(['active', 'completed']).default('active'),
    // 2. default(null) 제거 및 필수값으로 설정
    // 만약 기본값이 필요하다면 .default('아카데미') 처럼 지정하세요.
    affiliation: affiliationSchema,

    cohort_no: z
      .union([z.string(), z.number(), z.null(), z.undefined()])
      .transform((value) => {
        if (value === null || value === undefined) return null
        const text = String(value).trim()
        return text === '' ? null : Number(text)
      })
      .refine(
        (value) => value === null || (Number.isInteger(value) && value > 0),
        '기수는 1 이상 정수여야 합니다.'
      ),
  })
  .superRefine((data, ctx) => {
    const passwordError = validateStrongPassword({
      password: data.password,
      studentId: data.student_id,
      fullName: data.full_name,
    })

    if (passwordError) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: passwordError,
      })
    }
  })

export type AdminUserCreateInput = z.infer<typeof adminUserCreateSchema>