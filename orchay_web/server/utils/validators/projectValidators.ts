/**
 * 프로젝트 입력 검증 스키마
 * Task: TSK-02-03-03
 * 상세설계: 020-detail-design.md 섹션 7
 * DR-003: 검증 로직 집중화 (Zod)
 */

import { z } from 'zod';

/**
 * 프로젝트 ID 검증 스키마
 * BR-001: 영소문자, 숫자, 한글, 하이픈, 언더스코어 허용
 */
const projectIdSchema = z
  .string()
  .regex(/^[a-z0-9가-힣_-]+$/, '프로젝트 ID는 영소문자, 숫자, 한글, 하이픈, 언더스코어만 허용됩니다')
  .min(1, '프로젝트 ID는 필수입니다')
  .max(100, '프로젝트 ID는 100자 이하여야 합니다');

/**
 * 프로젝트 생성 요청 검증 스키마
 */
export const createProjectSchema = z.object({
  id: projectIdSchema,
  name: z.string().min(1, '프로젝트명은 필수입니다').max(100, '프로젝트명은 100자 이하여야 합니다'),
  description: z.string().max(1000, '설명은 1000자 이하여야 합니다').optional(),
  wbsDepth: z.union([z.literal(3), z.literal(4)], {
    message: 'WBS 깊이는 3 또는 4여야 합니다'
  }).default(4),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
});

/**
 * 프로젝트 수정 요청 검증 스키마
 * BR-002: ID 변경 불가 (id 필드 포함 시 에러)
 */
export const updateProjectSchema = z.object({
  id: z.undefined({
    message: '프로젝트 ID는 변경할 수 없습니다'
  }).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  version: z.string().optional(),
  status: z.enum(['active', 'archived'], {
    message: '상태는 active 또는 archived여야 합니다'
  }).optional(),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
});

/**
 * 팀원 검증 스키마
 */
const teamMemberSchema = z.object({
  id: z.string().min(1, '팀원 ID는 필수입니다').max(50, '팀원 ID는 50자 이하여야 합니다'),
  name: z.string().min(1, '팀원 이름은 필수입니다').max(50, '팀원 이름은 50자 이하여야 합니다'),
  email: z.string().email('올바른 이메일 형식이 아닙니다').optional(),
  role: z.string().optional(),
  avatar: z.string().optional(),
  active: z.boolean().default(true),
});

/**
 * 팀원 수정 요청 검증 스키마
 */
export const updateTeamSchema = z.object({
  members: z.array(teamMemberSchema),
});

// Type inference
export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
export type UpdateTeamDto = z.infer<typeof updateTeamSchema>;
