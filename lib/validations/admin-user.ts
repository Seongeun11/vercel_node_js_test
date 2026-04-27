import { z } from 'zod'

const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 72

function validateStrongPassword(params: {
  password: string
  studentId: string
  fullName: string
}): string | null {
  const { password, studentId, fullName } = params

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `비밀번호는 최소 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `비밀번호는 최대 ${PASSWORD_MAX_LENGTH}자까지 허용됩니다.`
  }

  if (/\s/.test(password)) {
    return '비밀번호에는 공백을 사용할 수 없습니다.'
  }

  if (!/[a-z]/.test(password)) {
    return '비밀번호에는 소문자가 최소 1개 포함되어야 합니다.'
  }

  if (!/\d/.test(password)) {
    return '비밀번호에는 숫자가 최소 1개 포함되어야 합니다.'
  }

  if (password.includes(studentId)) {
    return '비밀번호에는 학번을 포함할 수 없습니다.'
  }

  const normalizedPassword = password.toLowerCase()
  const normalizedFullName = fullName.trim().toLowerCase()

  if (
    normalizedFullName.length >= 2 &&
    normalizedPassword.includes(normalizedFullName)
  ) {
    return '비밀번호에는 이름을 포함할 수 없습니다.'
  }

  return null
}

export const adminUserCreateSchema = z
  .object({
    student_id: z
      .string()
      .trim()
      .regex(/^\d{10}$/, '학번은 10자리 숫자여야 합니다.'),

    password: z.string(),

    full_name: z
      .string()
      .trim()
      .min(2, '이름은 2자 이상이어야 합니다.')
      .max(20, '이름은 20자 이하여야 합니다.'),

    role: z.enum(['admin', 'captain', 'trainee']),

    // DB 제약조건: cohort_no is null or cohort_no > 0
    cohort_no: z
      .union([z.string(), z.number(), z.null(), z.undefined()])
      .transform((value) => {
        if (value === null || value === undefined) return null

        const text = String(value).trim()
        if (text === '') return null

        return Number(text)
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