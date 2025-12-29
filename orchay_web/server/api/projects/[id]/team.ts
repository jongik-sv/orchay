/**
 * GET/PUT /api/projects/:id/team - 팀원 관리
 * Task: TSK-02-03-03
 * FR-005, BR-003
 */

import { getTeam, updateTeam } from '../../../utils/projects/teamService';
import { updateTeamSchema } from '../../../utils/validators/projectValidators';
import { createBadRequestError } from '../../../utils/errors/standardError';
import type { TeamResponse } from '../../../utils/projects/types';

/**
 * GET /api/projects/:id/team
 */
export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id') as string;
  const method = event.method;

  if (method === 'GET') {
    const members = await getTeam(projectId);
    return {
      members,
      total: members.length,
    } as TeamResponse;
  }

  if (method === 'PUT') {
    const body = await readBody(event);

    // Zod 검증
    const validation = updateTeamSchema.safeParse(body);
    if (!validation.success) {
      // Zod v4: .issues 사용
      const firstError = validation.error.issues?.[0];
      throw createBadRequestError('VALIDATION_ERROR', firstError?.message || '유효성 검증 실패');
    }

    const members = await updateTeam(projectId, validation.data.members);
    return {
      members,
      total: members.length,
    } as TeamResponse;
  }

  throw createBadRequestError('METHOD_NOT_ALLOWED', '지원하지 않는 HTTP 메서드입니다');
});
