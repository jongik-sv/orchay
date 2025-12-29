/**
 * GET /api/projects/:id/files
 * Task: TSK-09-01
 * 상세설계: 020-detail-design.md 섹션 1.3
 *
 * 프로젝트 폴더 내 파일 목록 조회
 */

import { defineEventHandler, getRouterParam } from 'h3';
import type { ProjectFilesResponse } from '../../../../types';
import { getProjectFiles } from '../../../utils/projects/projectFilesService';
import { createInternalError } from '../../../utils/errors/standardError';

export default defineEventHandler(async (event): Promise<ProjectFilesResponse> => {
  const projectId = getRouterParam(event, 'id') as string;

  try {
    const files = await getProjectFiles(projectId);
    return { files };
  } catch (error) {
    // 표준 에러는 그대로 throw
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }
    throw createInternalError(
      'FILE_LIST_ERROR',
      `파일 목록 조회 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});
