/**
 * GET /api/projects/:id - 프로젝트 상세 조회
 * Task: TSK-02-03-03
 * FR-002
 */

import { getProject } from '../../utils/projects/projectService';
import { getTeam } from '../../utils/projects/teamService';
import type { ProjectDetail } from '../../utils/projects/types';

export default defineEventHandler(async (event): Promise<ProjectDetail> => {
  const projectId = getRouterParam(event, 'id') as string;

  const [project, team] = await Promise.all([
    getProject(projectId),
    getTeam(projectId),
  ]);

  return { project, team };
});
