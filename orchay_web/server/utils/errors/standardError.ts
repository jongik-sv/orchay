/**
 * 표준 에러 헬퍼
 * Task: TSK-02-03-03
 * 상세설계: 020-detail-design.md 섹션 11.1
 * DR-004: 에러 응답 일관성 확보
 *
 * 모든 에러 응답은 다음 형식을 따릅니다:
 * {
 *   statusCode: number,
 *   statusMessage: string,    // 에러 코드
 *   message: string,           // 사용자 메시지
 *   data: { timestamp: string } // ISO 8601
 * }
 */

import { createError } from 'h3';

/**
 * 표준 에러 응답 생성
 * @param statusCode HTTP 상태 코드
 * @param statusMessage 에러 코드 (예: PROJECT_NOT_FOUND)
 * @param message 사용자 메시지
 * @returns H3Error
 */
export function createStandardError(
  statusCode: number,
  statusMessage: string,
  message: string
) {
  return createError({
    statusCode,
    statusMessage,
    message,
    data: {
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * 404 Not Found 에러
 */
export function createNotFoundError(message: string) {
  return createStandardError(404, 'PROJECT_NOT_FOUND', message);
}

/**
 * 400 Bad Request 에러
 */
export function createBadRequestError(statusMessage: string, message: string) {
  return createStandardError(400, statusMessage, message);
}

/**
 * 403 Forbidden 에러
 */
export function createForbiddenError(statusMessage: string, message: string) {
  return createStandardError(403, statusMessage, message);
}

/**
 * 409 Conflict 에러
 */
export function createConflictError(statusMessage: string, message: string) {
  return createStandardError(409, statusMessage, message);
}

/**
 * 500 Internal Server Error 에러
 */
export function createInternalError(statusMessage: string, message: string) {
  return createStandardError(500, statusMessage, message);
}
