/**
 * PUT /api/projects/:id/wbs - WBS 트리 저장
 * Task: TSK-03-02
 * FR-002
 * C-001: 입력 검증 추가
 */

import { saveWbsTree } from '../../../utils/wbs/wbsService';
import { createBadRequestError } from '../../../utils/errors/standardError';
import type { WbsNode, WbsMetadata } from '../../../../types';

export default defineEventHandler(async (event): Promise<{
  success: boolean;
  updated: string;
}> => {
  const projectId = getRouterParam(event, 'id') as string;

  // C-001: 입력 검증
  if (!projectId || typeof projectId !== 'string') {
    throw createBadRequestError('INVALID_PROJECT_ID', '유효한 프로젝트 ID가 필요합니다');
  }

  const body = await readBody<{
    metadata: WbsMetadata;
    tree: WbsNode[];
  }>(event);

  // C-001: body 검증
  if (!body || typeof body !== 'object') {
    throw createBadRequestError('INVALID_REQUEST_BODY', '요청 본문이 필요합니다');
  }

  if (!body.metadata || typeof body.metadata !== 'object') {
    throw createBadRequestError('INVALID_METADATA', 'metadata 필드가 필요합니다');
  }

  if (!Array.isArray(body.tree)) {
    throw createBadRequestError('INVALID_TREE', 'tree 필드는 배열이어야 합니다');
  }

  const result = await saveWbsTree(projectId, body.metadata, body.tree);
  return result;
});
