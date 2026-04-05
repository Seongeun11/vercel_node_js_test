import { z } from 'zod'

export const adminUserCreateSchema = z.object({
  student_id: z
    .string()
    .trim()
    .regex(/^\d{4,20}$/, '학번 형식이 올바르지 않습니다.'),
  password: z
    .string()
    .min(8, '비밀번호는 최소 8자 이상이어야 합니다.')
    .max(72, '비밀번호는 최대 72자까지 허용됩니다.'),
  full_name: z
    .string()
    .trim()
    .min(2, '이름은 2자 이상이어야 합니다.')
    .max(50, '이름은 50자 이하여야 합니다.'),
  role: z.enum(['admin', 'captain', 'trainee']),
})

export type AdminUserCreateInput = z.infer<typeof adminUserCreateSchema>