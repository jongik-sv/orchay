/**
 * GET /api/tasks/:id/documents/[...path]
 * TSK-05-04: Document Viewer
 *
 * Task 문서 및 이미지 조회 API (서브폴더 지원)
 * 예: /api/tasks/TSK-05-02/documents/manual-images/screenshot.png
 */

import { safeDecodePathSegment } from '~~/app/utils/urlPath';

export default defineEventHandler(async (event) => {
  const taskIdRaw = getRouterParam(event, 'id');
  const pathSegments = getRouterParam(event, 'path');

  if (!taskIdRaw || !pathSegments) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Task ID와 파일 경로가 필요합니다',
      data: { code: 'MISSING_PARAMETERS' }
    });
  }

  // URL 인코딩된 파라미터 디코딩
  const taskId = safeDecodePathSegment(taskIdRaw);

  // catch-all 라우트에서 경로가 문자열로 올 수 있음
  // 예: 'manual-images/file.png' 또는 ['manual-images', 'file.png']
  let pathArray: string[];
  if (Array.isArray(pathSegments)) {
    pathArray = pathSegments;
  } else {
    // 문자열인 경우 '/'로 분리
    pathArray = pathSegments.split('/').filter(s => s);
  }

  // 각 세그먼트를 개별적으로 디코딩 (경로 구분자 검사 없이)
  const decodedSegments = pathArray.map(seg => {
    try {
      return decodeURIComponent(seg);
    } catch {
      return seg;
    }
  });
  const decodedPath = decodedSegments.join('/');

  if (!taskId || !decodedPath) {
    throw createError({
      statusCode: 400,
      statusMessage: '잘못된 경로 형식입니다',
      data: { code: 'INVALID_PATH_SEGMENT' }
    });
  }

  // 경로 탐색 공격 방지
  if (decodedPath.includes('..') || decodedPath.includes('\\')) {
    throw createError({
      statusCode: 400,
      statusMessage: '잘못된 경로입니다',
      data: { code: 'INVALID_PATH' }
    });
  }

  // projectId: 쿼리 파라미터로 받거나 기본값 'orchay' 사용
  const query = getQuery(event);
  const projectId = typeof query.project === 'string' ? query.project : 'orchay';

  // 이미지 파일인지 확인
  if (isImageFile(decodedPath)) {
    try {
      const { buffer, size, lastModified } = await readTaskBinaryDocument(projectId, taskId, decodedPath);
      const mimeType = getMimeType(decodedPath);

      // 바이너리 응답
      setHeader(event, 'Content-Type', mimeType);
      setHeader(event, 'Content-Length', size.toString());
      setHeader(event, 'Last-Modified', lastModified);
      setHeader(event, 'Cache-Control', 'public, max-age=86400'); // 24시간 캐시

      return buffer;
    } catch (error: any) {
      if (error.message === 'DOCUMENT_NOT_FOUND') {
        throw createError({
          statusCode: 404,
          statusMessage: '요청한 파일을 찾을 수 없습니다',
          data: { code: 'FILE_NOT_FOUND' }
        });
      }

      throw createError({
        statusCode: 500,
        statusMessage: '파일을 불러올 수 없습니다',
        data: { code: 'FILE_READ_ERROR' }
      });
    }
  }

  // 텍스트 문서
  try {
    const document = await readTaskDocument(projectId, taskId, decodedPath);

    return {
      content: document.content,
      filename: document.filename,
      size: document.size,
      lastModified: document.lastModified
    };
  } catch (error: any) {
    if (error.message === 'DOCUMENT_NOT_FOUND') {
      throw createError({
        statusCode: 404,
        statusMessage: '요청한 문서를 찾을 수 없습니다',
        data: { code: 'DOCUMENT_NOT_FOUND' }
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: '서버 오류가 발생했습니다',
      data: { code: 'INTERNAL_ERROR' }
    });
  }
});
