import { complexWbsTree } from './wbs-nodes';

/**
 * GET /api/projects/:id/wbs 성공 응답
 */
export const wbsApiSuccessResponse = {
  metadata: {
    version: '1.0',
    depth: 4,
    updated: '2025-12-15',
    start: '2025-12-01'
  },
  tree: [complexWbsTree]
};

/**
 * PUT /api/projects/:id/wbs 성공 응답
 */
export const wbsSaveSuccessResponse = {
  success: true,
  message: 'WBS saved successfully'
};

/**
 * API 오류 응답 (404)
 */
export const wbsNotFoundResponse = {
  error: 'Project not found',
  statusCode: 404
};

/**
 * API 오류 응답 (500)
 */
export const wbsServerErrorResponse = {
  error: 'Internal server error',
  statusCode: 500
};

/**
 * 빈 WBS 응답
 */
export const wbsEmptyResponse = {
  metadata: {
    version: '1.0',
    depth: 3,
    updated: '2025-12-15',
    start: '2025-12-01'
  },
  tree: []
};
