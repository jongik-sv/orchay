/**
 * GET /api/projects/:id/wbs - WBS 트리 조회
 * Task: TSK-03-02
 * FR-001
 */

import { getWbsTree } from '../../../utils/wbs/wbsService';
import type { WbsNode, WbsMetadata } from '../../../../types';

export default defineEventHandler(async (event): Promise<{
  metadata: WbsMetadata;
  tree: WbsNode[];
}> => {
  const projectId = getRouterParam(event, 'id') as string;

  const result = await getWbsTree(projectId);
  return result;
});
